import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { BookingsService } from "../bookings/bookings.service";
import { MerchantsService } from "../merchants/merchants.service";
import { MerchantAuthGuard, MerchantAuthenticatedRequest } from "./merchant-auth.guard";

@Controller("api/merchant")
@UseGuards(MerchantAuthGuard)
export class MerchantController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly merchantsService: MerchantsService,
  ) {}

  @Get("profile")
  async profile(@Req() request: MerchantAuthenticatedRequest) {
    return this.merchantsService.getMerchantProfile(request.merchant?.id || "");
  }

  @Patch("profile")
  async updateProfile(
    @Req() request: MerchantAuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.merchantsService.updateMerchantProfile(request.merchant?.id || "", body);
  }

  @Get("rooms")
  async rooms(@Req() request: MerchantAuthenticatedRequest) {
    return this.merchantsService.listMerchantRooms(request.merchant?.id || "");
  }

  @Post("rooms")
  async createRoom(
    @Req() request: MerchantAuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.merchantsService.createRoom(request.merchant?.id || "", body);
  }

  @Patch("rooms/:id")
  async updateRoom(
    @Req() request: MerchantAuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.merchantsService.updateMerchantRoom(request.merchant?.id || "", id, body);
  }

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
