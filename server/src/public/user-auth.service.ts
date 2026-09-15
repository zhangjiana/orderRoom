import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/database.service";
import { createSessionToken, hashToken } from "../common/security/password.util";
import { createId } from "../common/utils/id.util";
import { formatDateTime, nowString } from "../common/utils/time.util";
import { validateRequired } from "../common/utils/validation.util";

const USER_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class UserAuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async login(payload: Record<string, unknown>) {
    const missing = validateRequired(["loginCode"], payload);
    if (missing.length) {
      throw new BadRequestException({ message: "缺少微信登录参数", missing });
    }

    const openid = await this.fetchOpenId(String(payload.loginCode));
    const now = nowString();
    let user = await this.databaseService.queryOne<{ id: string; wxOpenid: string }>(
      "SELECT id, wx_openid AS wxOpenid FROM users WHERE wx_openid = ? LIMIT 1",
      [openid],
    );

    if (!user) {
      user = { id: createId("user"), wxOpenid: openid };
      await this.databaseService.execute(
        `INSERT INTO users (id, wx_openid, created_at, last_login_at)
        VALUES (?, ?, ?, ?)`,
        [user.id, openid, now, now],
      );
    } else {
      await this.databaseService.execute(
        "UPDATE users SET last_login_at = ? WHERE id = ?",
        [now, user.id],
      );
    }

    return this.issueSession(user.id);
  }

  async getSessionFromToken(token: string) {
    if (!token) {
      throw new UnauthorizedException("请先登录");
    }

    const tokenHash = hashToken(token);
    const session = await this.databaseService.queryOne<{
      userId: string;
      expiresAt: string | Date;
    }>(
      `SELECT user_id AS userId, expires_at AS expiresAt
      FROM user_sessions
      WHERE token_hash = ?
      LIMIT 1`,
      [tokenHash],
    );

    if (!session) {
      throw new UnauthorizedException("登录状态无效，请重新登录");
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.databaseService.execute(
        "DELETE FROM user_sessions WHERE token_hash = ?",
        [tokenHash],
      );
      throw new UnauthorizedException("登录已过期，请重新登录");
    }

    await this.databaseService.execute(
      "UPDATE user_sessions SET last_active_at = ? WHERE token_hash = ?",
      [nowString(), tokenHash],
    );

    return {
      user: { id: session.userId },
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  async logout(token: string) {
    if (token) {
      await this.databaseService.execute(
        "DELETE FROM user_sessions WHERE token_hash = ?",
        [hashToken(token)],
      );
    }
    return { ok: true };
  }

  private async issueSession(userId: string) {
    const token = createSessionToken();
    const now = nowString();
    const expiresAt = new Date(Date.now() + USER_SESSION_DURATION_MS);

    await this.databaseService.execute("DELETE FROM user_sessions WHERE expires_at <= ?", [now]);
    await this.databaseService.execute(
      `INSERT INTO user_sessions (
        id, user_id, token_hash, created_at, last_active_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        createId("user_session"),
        userId,
        hashToken(token),
        now,
        now,
        formatDateTime(expiresAt),
      ],
    );

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: userId },
    };
  }

  private async fetchOpenId(loginCode: string) {
    const appId = this.configService.get<string>("wechatMiniapp.appId", "");
    const appSecret = this.configService.get<string>("wechatMiniapp.appSecret", "");
    if (!appId || !appSecret) {
      throw new InternalServerErrorException("未配置微信小程序登录凭据");
    }

    const url =
      `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(appSecret)}` +
      `&js_code=${encodeURIComponent(loginCode)}` +
      "&grant_type=authorization_code";
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new InternalServerErrorException("微信登录服务暂时不可用");
    }

    const result = await response.json() as {
      openid?: string;
      errcode?: number;
      errmsg?: string;
    };
    if (!result.openid) {
      throw new UnauthorizedException(result.errmsg || "微信登录失败");
    }
    return result.openid;
  }
}
