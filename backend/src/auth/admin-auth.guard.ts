import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";

type AuthenticatedRequest = Request & {
  admin?: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  };
  adminSession?: {
    expiresAt: string;
  };
};

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = String(request.headers.authorization || "");
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("请先登录后台");
    }

    const session = await this.authService.getSessionFromToken(token);
    request.admin = session.admin;
    request.adminSession = { expiresAt: session.expiresAt };
    return true;
  }
}
