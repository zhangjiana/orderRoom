import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { UserAuthGuard, UserAuthenticatedRequest } from "./user-auth.guard";
import { UserAuthService } from "./user-auth.service";

@Controller("api/public/auth")
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post("login")
  async login(@Body() body: Record<string, unknown>) {
    return this.userAuthService.login(body);
  }

  @Get("me")
  @UseGuards(UserAuthGuard)
  async me(@Req() request: UserAuthenticatedRequest) {
    return {
      user: request.user,
      expiresAt: request.userSession?.expiresAt || "",
    };
  }

  @Post("logout")
  @UseGuards(UserAuthGuard)
  async logout(@Req() request: Request) {
    const [, token] = String(request.headers.authorization || "").split(" ");
    return this.userAuthService.logout(token || "");
  }
}
