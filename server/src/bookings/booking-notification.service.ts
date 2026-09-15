import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class BookingNotificationService {
  private accessTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async sendStatusUpdate(booking: Record<string, any>) {
    const templateId = this.configService.get<string>(
      "wechatMiniapp.bookingStatusTemplateId",
      "",
    );
    if (
      !booking.userId ||
      !templateId ||
      booking.subscriptionTemplateId !== templateId
    ) {
      return { skipped: true };
    }

    const user = await this.databaseService.queryOne<{ wxOpenid: string }>(
      "SELECT wx_openid AS wxOpenid FROM users WHERE id = ? LIMIT 1",
      [booking.userId],
    );
    if (!user?.wxOpenid) return { skipped: true };

    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5_000),
          body: JSON.stringify({
            touser: user.wxOpenid,
            template_id: templateId,
            page: this.configService.get<string>(
              "wechatMiniapp.bookingStatusPage",
              "pages/bookings/index",
            ),
            data: {
              thing1: { value: String(booking.merchantName || "").slice(0, 20) },
              phrase2: { value: String(booking.statusLabel || "").slice(0, 5) },
              time3: {
                value: `${booking.diningDate || ""} ${booking.diningTime || ""}`.slice(0, 20),
              },
              thing4: { value: String(booking.roomName || "").slice(0, 20) },
            },
          }),
        },
      );
      const result = await response.json() as { errcode?: number };
      if (!response.ok || result.errcode) {
        console.warn("Booking subscription message was not delivered", {
          errcode: result.errcode || response.status,
        });
        return { delivered: false };
      }
      return { delivered: true };
    } catch (error) {
      console.warn("Booking subscription message failed", {
        reason: error instanceof Error ? error.name : "unknown",
      });
      return { delivered: false };
    }
  }

  private async getAccessToken() {
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > Date.now() + 60_000) {
      return this.accessTokenCache.token;
    }

    const appId = this.configService.get<string>("wechatMiniapp.appId", "");
    const appSecret = this.configService.get<string>("wechatMiniapp.appSecret", "");
    if (!appId || !appSecret) throw new Error("wechat credentials missing");

    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`,
      { method: "GET", signal: AbortSignal.timeout(5_000) },
    );
    const result = await response.json() as {
      access_token?: string;
      expires_in?: number;
    };
    if (!response.ok || !result.access_token) throw new Error("wechat access token failed");

    this.accessTokenCache = {
      token: result.access_token,
      expiresAt: Date.now() + Number(result.expires_in || 7200) * 1000,
    };
    return result.access_token;
  }
}
