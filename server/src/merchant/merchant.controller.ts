import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { BookingsService } from "../bookings/bookings.service";
import { MerchantAuthGuard, MerchantAuthenticatedRequest } from "./merchant-auth.guard";

@Controller("api/merchant")
@UseGuards(MerchantAuthGuard)
export class MerchantController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get("bookings")
  async bookings(
    @Req() request: MerchantAuthenticatedRequest,
    @Query("status") status = "all",
  ) {
    return this.bookingsService.listMerchantBookings(request.merchant?.id || "", status);
  }

  @Get("bookings/:id")
  async booking(@Req() request: MerchantAuthenticatedRequest, @Param("id") id: string) {
    return this.bookingsService.getMerchantBooking(request.merchant?.id || "", id);
  }

  @Patch("bookings/:id/status")
  async updateBooking(
    @Req() request: MerchantAuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.bookingsService.updateMerchantBookingStatus(request.merchant?.id || "", id, body);
  }
}
