import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { MerchantAuthService } from "./merchant-auth.service";

export type MerchantAuthenticatedRequest = Request & {
  merchant?: {
    id: string;
    name: string;
    address: string;
    contactPhone: string;
    businessHours: string;
  };
  merchantStaff?: {
    id: string;
    username: string;
    displayName: string;
    phone: string;
  };
  merchantSession?: {
    expiresAt: string;
  };
};

@Injectable()
export class MerchantAuthGuard implements CanActivate {
  constructor(private readonly merchantAuthService: MerchantAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MerchantAuthenticatedRequest>();
    const header = String(request.headers.authorization || "");
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("请先登录商家端");
    }

    const session = await this.merchantAuthService.getSessionFromToken(token);
    request.merchant = session.merchant;
    request.merchantStaff = session.staff;
    request.merchantSession = { expiresAt: session.expiresAt };
    return true;
  }
}
