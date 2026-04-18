import { Module } from "@nestjs/common";
import { BookingsModule } from "../bookings/bookings.module";
import { MerchantsModule } from "../merchants/merchants.module";
import { MerchantAuthController } from "./merchant-auth.controller";
import { MerchantAuthGuard } from "./merchant-auth.guard";
import { MerchantAuthService } from "./merchant-auth.service";
import { MerchantController } from "./merchant.controller";

@Module({
  imports: [BookingsModule, MerchantsModule],
  controllers: [MerchantAuthController, MerchantController],
  providers: [MerchantAuthService, MerchantAuthGuard],
  exports: [MerchantAuthService, MerchantAuthGuard],
})
export class MerchantModule {}
