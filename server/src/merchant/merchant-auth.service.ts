import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/database.service";
import { createId } from "../common/utils/id.util";
import { createSessionToken, hashToken, verifyPassword } from "../common/security/password.util";
import { formatDateTime, nowString } from "../common/utils/time.util";
import { validateRequired } from "../common/utils/validation.util";

const DEFAULT_MERCHANT_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type MerchantStaffRow = {
  id: string;
  merchantId: string;
  username: string;
  passwordHash: string;
  displayName: string;
  phone: string;
  wxOpenid: string | null;
  status: string;
  merchantName: string;
  merchantAddress: string;
  merchantContactPhone: string;
  merchantBusinessHours: string;
};

type MerchantSessionPayload = {
  token: string;
  expiresAt: string;
  merchant: {
    id: string;
    name: string;
    address: string;
    contactPhone: string;
    businessHours: string;
  };
  staff: {
    id: string;
    username: string;
    displayName: string;
    phone: string;
  };
};

@Injectable()
export class MerchantAuthService {
  private accessTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async webLogin(payload: Record<string, unknown>): Promise<MerchantSessionPayload> {
    const missing = validateRequired(["username", "password"], payload);
    if (missing.length) {
      throw new BadRequestException({ message: "请输入账号和密码", missing });
    }

    const staff = await this.loadActiveStaff("staff.username = ?", [String(payload.username).trim()]);
    if (!staff || !verifyPassword(String(payload.password), staff.passwordHash)) {
      throw new UnauthorizedException("账号或密码错误");
    }

    return this.issueSession(staff, "web");
  }

  async wechatLogin(payload: Record<string, unknown>): Promise<MerchantSessionPayload> {
    const missing = validateRequired(["loginCode", "phoneCode"], payload);
    if (missing.length) {
      throw new BadRequestException({ message: "缺少微信登录参数", missing });
    }

    const { openid } = await this.fetchOpenId(String(payload.loginCode));
    const phone = await this.fetchPhoneNumber(String(payload.phoneCode));
    const staff = await this.loadActiveStaff("staff.phone = ?", [phone]);

    if (!staff) {
      throw new UnauthorizedException("当前手机号未开通商家权限");
    }

    if (!staff.wxOpenid || staff.wxOpenid !== openid) {
      await this.databaseService.execute("UPDATE merchant_staff SET wx_openid = ? WHERE id = ?", [
        openid,
        staff.id,
      ]);
      staff.wxOpenid = openid;
    }

    return this.issueSession(staff, "miniapp");
  }

  async getSessionFromToken(token: string) {
    if (!token) {
      throw new UnauthorizedException("请先登录商家端");
    }

    const tokenHash = hashToken(token);
    const session = await this.databaseService.queryOne<
      MerchantStaffRow & { expiresAt: string | Date; sessionId: string }
    >(
      `SELECT
        sessions.id AS sessionId,
        sessions.expires_at AS expiresAt,
        staff.id,
        staff.merchant_id AS merchantId,
        staff.username,
        staff.password_hash AS passwordHash,
        staff.display_name AS displayName,
        staff.phone,
        staff.wx_openid AS wxOpenid,
        staff.status,
        merchants.name AS merchantName,
        merchants.address AS merchantAddress,
        merchants.contact_phone AS merchantContactPhone,
        merchants.business_hours AS merchantBusinessHours
      FROM merchant_sessions AS sessions
      INNER JOIN merchant_staff AS staff ON staff.id = sessions.staff_id
      INNER JOIN merchants ON merchants.id = staff.merchant_id
      WHERE sessions.token_hash = ?
      LIMIT 1`,
      [tokenHash],
    );

    if (!session) {
      throw new UnauthorizedException("商家登录状态无效，请重新登录");
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.databaseService.execute("DELETE FROM merchant_sessions WHERE token_hash = ?", [tokenHash]);
      throw new UnauthorizedException("商家登录已过期，请重新登录");
    }

    await this.databaseService.execute(
      "UPDATE merchant_sessions SET last_active_at = ? WHERE token_hash = ?",
      [nowString(), tokenHash],
    );

    return {
      expiresAt: new Date(session.expiresAt).toISOString(),
      merchant: this.mapMerchant(session),
      staff: this.mapStaff(session),
    };
  }

  async logout(token: string) {
    if (!token) {
      return { ok: true };
    }

    await this.databaseService.execute("DELETE FROM merchant_sessions WHERE token_hash = ?", [hashToken(token)]);
    return { ok: true };
  }

  private async issueSession(
    staff: MerchantStaffRow,
    clientType: "web" | "miniapp",
  ): Promise<MerchantSessionPayload> {
    const token = createSessionToken();
    const tokenHash = hashToken(token);
    const now = nowString();
    const expiresAt = new Date(Date.now() + this.merchantSessionDurationMs);

    await this.databaseService.execute("DELETE FROM merchant_sessions WHERE expires_at <= ?", [now]);
    await this.databaseService.execute(
      `INSERT INTO merchant_sessions (
        id, staff_id, token_hash, client_type, created_at, last_active_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        createId("merchant_session"),
        staff.id,
        tokenHash,
        clientType,
        now,
        now,
        formatDateTime(expiresAt),
      ],
    );
    await this.databaseService.execute("UPDATE merchant_staff SET last_login_at = ? WHERE id = ?", [now, staff.id]);

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      merchant: this.mapMerchant(staff),
      staff: this.mapStaff(staff),
    };
  }

  private async loadActiveStaff(whereClause: string, params: unknown[]) {
    return this.databaseService.queryOne<MerchantStaffRow>(
      `SELECT
        staff.id,
        staff.merchant_id AS merchantId,
        staff.username,
        staff.password_hash AS passwordHash,
        staff.display_name AS displayName,
        staff.phone,
        staff.wx_openid AS wxOpenid,
        staff.status,
        merchants.name AS merchantName,
        merchants.address AS merchantAddress,
        merchants.contact_phone AS merchantContactPhone,
        merchants.business_hours AS merchantBusinessHours
      FROM merchant_staff AS staff
      INNER JOIN merchants ON merchants.id = staff.merchant_id
      WHERE staff.status = 'active'
        AND merchants.status = 'active'
        AND ${whereClause}
      LIMIT 1`,
      params,
    );
  }

  private mapStaff(row: MerchantStaffRow) {
    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      phone: row.phone,
    };
  }

  private mapMerchant(row: MerchantStaffRow) {
    return {
      id: row.merchantId,
      name: row.merchantName,
      address: row.merchantAddress,
      contactPhone: row.merchantContactPhone,
      businessHours: row.merchantBusinessHours,
    };
  }

  private get merchantSessionDurationMs() {
    return this.configService.get<number>(
      "merchantAuth.sessionDurationMs",
      DEFAULT_MERCHANT_SESSION_DURATION_MS,
    );
  }

  private get wechatConfig() {
    const appId = this.configService.get<string>("wechatMiniapp.appId", "");
    const appSecret = this.configService.get<string>("wechatMiniapp.appSecret", "");

    if (!appId || !appSecret) {
      throw new InternalServerErrorException("未配置微信小程序登录凭据");
    }

    return { appId, appSecret };
  }

  private async fetchOpenId(loginCode: string) {
    const { appId, appSecret } = this.wechatConfig;
    const url =
      `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(appSecret)}` +
      `&js_code=${encodeURIComponent(loginCode)}` +
      "&grant_type=authorization_code";
    const result = await this.fetchWechatJson<{
      openid?: string;
      errcode?: number;
      errmsg?: string;
    }>(url, { method: "GET" });

    if (!result.openid) {
      throw new UnauthorizedException(result.errmsg || "微信登录失败");
    }

    return { openid: result.openid };
  }

  private async fetchPhoneNumber(phoneCode: string) {
    const accessToken = await this.getWechatAccessToken();
    const result = await this.fetchWechatJson<{
      phone_info?: {
        phoneNumber?: string;
        purePhoneNumber?: string;
      };
      errcode?: number;
      errmsg?: string;
    }>(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: phoneCode }),
      },
    );

    const phone =
      result.phone_info?.purePhoneNumber ||
      result.phone_info?.phoneNumber ||
      "";

    if (!phone) {
      throw new UnauthorizedException(result.errmsg || "获取微信手机号失败");
    }

    return phone;
  }

  private async getWechatAccessToken() {
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > Date.now() + 60_000) {
      return this.accessTokenCache.token;
    }

    const { appId, appSecret } = this.wechatConfig;
    const url =
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(appSecret)}`;
    const result = await this.fetchWechatJson<{
      access_token?: string;
      expires_in?: number;
      errcode?: number;
      errmsg?: string;
    }>(url, { method: "GET" });

    if (!result.access_token) {
      throw new InternalServerErrorException(result.errmsg || "获取微信 access token 失败");
    }

    this.accessTokenCache = {
      token: result.access_token,
      expiresAt: Date.now() + Number(result.expires_in || 7200) * 1000,
    };
    return result.access_token;
  }

  private async fetchWechatJson<T>(url: string, init: RequestInit) {
    const response = await fetch(url, init);
    const result = (await response.json()) as T & { errcode?: number; errmsg?: string };

    if (!response.ok) {
      throw new InternalServerErrorException("微信接口调用失败");
    }

    if (result.errcode) {
      throw new UnauthorizedException(result.errmsg || "微信接口返回错误");
    }

    return result;
  }
}
