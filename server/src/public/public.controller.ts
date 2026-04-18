import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { MerchantsService } from "../merchants/merchants.service";
import { BookingsService } from "../bookings/bookings.service";

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
  async createBooking(@Body() body: Record<string, unknown>) {
    return this.bookingsService.createBooking(body);
  }

  @Get("bookings")
  async bookings(@Query("contactPhone") contactPhone = "") {
    return this.bookingsService.listPublicBookings(contactPhone);
  }

  @Get("bookings/:id")
  async booking(@Param("id") id: string, @Query("contactPhone") contactPhone = "") {
    return this.bookingsService.getPublicBooking(id, contactPhone);
  }

  @Get("bookings/:id/invitation")
  async invitation(@Param("id") id: string) {
    return this.bookingsService.getPublicInvitation(id);
  }
}
