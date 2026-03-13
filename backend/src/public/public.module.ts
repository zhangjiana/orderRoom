import { Module } from "@nestjs/common";
import { PublicController } from "./public.controller";
import { MerchantsModule } from "../merchants/merchants.module";
import { BookingsModule } from "../bookings/bookings.module";

@Module({
  imports: [MerchantsModule, BookingsModule],
  controllers: [PublicController],
})
export class PublicModule {}
