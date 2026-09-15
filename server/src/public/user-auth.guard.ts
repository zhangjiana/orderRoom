import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { UserAuthService } from "./user-auth.service";

export type UserAuthenticatedRequest = Request & {
  user?: { id: string };
  userSession?: { expiresAt: string };
};

function bearerToken(request: Request): string {
  const [type, token] = String(request.headers.authorization || "").split(" ");
  return type === "Bearer" ? token || "" : "";
}

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly userAuthService: UserAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<UserAuthenticatedRequest>();
    const token = bearerToken(request);
    if (!token) throw new UnauthorizedException("请先登录");

    const session = await this.userAuthService.getSessionFromToken(token);
    request.user = session.user;
    request.userSession = { expiresAt: session.expiresAt };
    return true;
  }
}

@Injectable()
export class OptionalUserAuthGuard implements CanActivate {
  constructor(private readonly userAuthService: UserAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<UserAuthenticatedRequest>();
    const token = bearerToken(request);
    if (!token) return true;

    const session = await this.userAuthService.getSessionFromToken(token);
    request.user = session.user;
    request.userSession = { expiresAt: session.expiresAt };
    return true;
  }
}
