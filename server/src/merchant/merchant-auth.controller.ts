import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { MerchantAuthService } from "./merchant-auth.service";
import { MerchantAuthGuard, MerchantAuthenticatedRequest } from "./merchant-auth.guard";

@Controller("api/merchant/auth")
export class MerchantAuthController {
  constructor(private readonly merchantAuthService: MerchantAuthService) {}

  @Post("web-login")
  async webLogin(@Body() body: Record<string, unknown>) {
    return this.merchantAuthService.webLogin(body);
  }

  @Post("wx-login")
  async wxLogin(@Body() body: Record<string, unknown>) {
    return this.merchantAuthService.wechatLogin(body);
  }

  @Get("me")
  @UseGuards(MerchantAuthGuard)
  async me(@Req() request: MerchantAuthenticatedRequest) {
    return {
      merchant: request.merchant,
      staff: request.merchantStaff,
      expiresAt: request.merchantSession?.expiresAt || "",
    };
  }

  @Post("logout")
  @UseGuards(MerchantAuthGuard)
  async logout(@Req() request: Request) {
    const [, token] = String(request.headers.authorization || "").split(" ");
    return this.merchantAuthService.logout(token || "");
  }
}
