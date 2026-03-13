import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AuthModule } from "../auth/auth.module";
import { MerchantsModule } from "../merchants/merchants.module";
import { BookingsModule } from "../bookings/bookings.module";

@Module({
  imports: [AuthModule, MerchantsModule, BookingsModule],
  controllers: [AdminController],
})
export class AdminModule {}
