import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { createId } from "../common/utils/id.util";
import { createSessionToken, hashToken, verifyPassword } from "../common/security/password.util";
import { formatDateTime, nowString } from "../common/utils/time.util";
import { validateRequired } from "../common/utils/validation.util";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async login(payload: Record<string, unknown>) {
    const missing = validateRequired(["username", "password"], payload);

    if (missing.length) {
      throw new BadRequestException({ message: "请输入账号和密码", missing });
    }

    const admin = await this.databaseService.queryOne<{
      id: string;
      username: string;
      passwordHash: string;
      displayName: string;
      role: string;
    }>(
      `SELECT
        id,
        username,
        password_hash AS passwordHash,
        display_name AS displayName,
        role
      FROM admin_users
      WHERE username = ?
      LIMIT 1`,
      [String(payload.username).trim()],
    );

    if (!admin || !verifyPassword(String(payload.password), admin.passwordHash)) {
      throw new UnauthorizedException("账号或密码错误");
    }

    const token = createSessionToken();
    const tokenHash = hashToken(token);
    const now = nowString();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.databaseService.execute("DELETE FROM admin_sessions WHERE expires_at <= ?", [now]);
    await this.databaseService.execute(
      `INSERT INTO admin_sessions (
        id, user_id, token_hash, created_at, last_active_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [createId("session"), admin.id, tokenHash, now, now, formatDateTime(expiresAt)],
    );
    await this.databaseService.execute("UPDATE admin_users SET last_login_at = ? WHERE id = ?", [
      now,
      admin.id,
    ]);

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
      },
    };
  }

  async getSessionFromToken(token: string) {
    if (!token) {
      throw new UnauthorizedException("请先登录后台");
    }

    const tokenHash = hashToken(token);
    const session = await this.databaseService.queryOne<{
      id: string;
      userId: string;
      expiresAt: string | Date;
      username: string;
      displayName: string;
      role: string;
    }>(
      `SELECT
        sessions.id,
        sessions.user_id AS userId,
        sessions.expires_at AS expiresAt,
        users.username,
        users.display_name AS displayName,
        users.role
      FROM admin_sessions AS sessions
      INNER JOIN admin_users AS users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
      LIMIT 1`,
      [tokenHash],
    );

    if (!session) {
      throw new UnauthorizedException("登录状态无效，请重新登录");
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.databaseService.execute("DELETE FROM admin_sessions WHERE token_hash = ?", [tokenHash]);
      throw new UnauthorizedException("登录已过期，请重新登录");
    }

    await this.databaseService.execute("UPDATE admin_sessions SET last_active_at = ? WHERE token_hash = ?", [
      nowString(),
      tokenHash,
    ]);

    return {
      admin: {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
        role: session.role,
      },
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  async logout(token: string) {
    if (!token) {
      return { ok: true };
    }

    await this.databaseService.execute("DELETE FROM admin_sessions WHERE token_hash = ?", [hashToken(token)]);
    return { ok: true };
  }
}
