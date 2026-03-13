import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { AdminAuthGuard } from "./admin-auth.guard";

type AuthenticatedRequest = Request & {
  admin: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  };
  adminSession: {
    expiresAt: string;
  };
};

@Controller("api/admin/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: Record<string, unknown>) {
    return this.authService.login(body);
  }

  @Get("me")
  @UseGuards(AdminAuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    return {
      admin: request.admin,
      expiresAt: request.adminSession.expiresAt,
    };
  }

  @Post("logout")
  @UseGuards(AdminAuthGuard)
  async logout(@Req() request: Request) {
    const [, token] = String(request.headers.authorization || "").split(" ");
    return this.authService.logout(token || "");
  }
}
