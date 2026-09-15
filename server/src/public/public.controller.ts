import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { MerchantsService } from "../merchants/merchants.service";
import { BookingsService } from "../bookings/bookings.service";
import { UserAuthGuard, UserAuthenticatedRequest } from "./user-auth.guard";

@Controller("api/public")
export class PublicController {
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Post("merchant-applications")
  async createApplication(@Body() body: Record<string, unknown>) {
    return this.merchantsService.createApplication(body);
  }

  @Get("merchants")
  async merchants(
    @Query("keyword") keyword = "",
    @Query("latitude") latitude?: string,
    @Query("longitude") longitude?: string,
  ) {
    return this.merchantsService.listPublicMerchants(keyword, latitude, longitude);
  }

  @Get("merchants/:id")
  async merchant(@Param("id") id: string) {
    return this.merchantsService.getMerchant(id, true);
  }

  @Post("bookings")
  @UseGuards(UserAuthGuard)
  async createBooking(
    @Body() body: Record<string, unknown>,
    @Req() request: UserAuthenticatedRequest,
  ) {
    return this.bookingsService.createBooking(body, request.user?.id || "");
  }

  @Get("bookings")
  async bookings(@Query("contactPhone") contactPhone = "") {
    return this.bookingsService.listPublicBookings(contactPhone);
  }

  @Get("bookings/:id")
  async booking(@Param("id") id: string, @Query("contactPhone") contactPhone = "") {
    return this.bookingsService.getPublicBooking(id, contactPhone);
  }

  @Patch("bookings/:id/cancel")
  async cancelBooking(@Param("id") id: string, @Body("contactPhone") contactPhone = "") {
    return this.bookingsService.cancelPublicBooking(id, contactPhone);
  }

  @Get("me/bookings")
  @UseGuards(UserAuthGuard)
  async myBookings(@Req() request: UserAuthenticatedRequest) {
    return this.bookingsService.listUserBookings(request.user?.id || "");
  }

  @Get("me/bookings/:id")
  @UseGuards(UserAuthGuard)
  async myBooking(
    @Param("id") id: string,
    @Req() request: UserAuthenticatedRequest,
  ) {
    return this.bookingsService.getUserBooking(request.user?.id || "", id);
  }

  @Patch("me/bookings/:id/cancel")
  @UseGuards(UserAuthGuard)
  async cancelMyBooking(
    @Param("id") id: string,
    @Req() request: UserAuthenticatedRequest,
  ) {
    return this.bookingsService.cancelUserBooking(request.user?.id || "", id);
  }

  @Get("bookings/:id/invitation")
  async invitation(@Param("id") id: string, @Query("token") token = "") {
    return this.bookingsService.getPublicInvitation(id, token);
  }
}
