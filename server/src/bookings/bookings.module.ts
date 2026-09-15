import { Module } from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { BookingNotificationService } from "./booking-notification.service";

@Module({
  providers: [BookingsService, BookingNotificationService],
  exports: [BookingsService],
})
export class BookingsModule {}
