import { Module } from "@nestjs/common";
import { PublicController } from "./public.controller";
import { MerchantsModule } from "../merchants/merchants.module";
import { BookingsModule } from "../bookings/bookings.module";
import { UserAuthController } from "./user-auth.controller";
import { OptionalUserAuthGuard, UserAuthGuard } from "./user-auth.guard";
import { UserAuthService } from "./user-auth.service";

@Module({
  imports: [MerchantsModule, BookingsModule],
  controllers: [PublicController, UserAuthController],
  providers: [UserAuthService, UserAuthGuard, OptionalUserAuthGuard],
})
export class PublicModule {}
