import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { MerchantsService } from "../merchants/merchants.service";
import { BookingsService } from "../bookings/bookings.service";

@Controller("api/admin")
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Get("dashboard")
  async dashboard() {
    return this.merchantsService.getDashboard();
  }

  @Get("merchant-applications")
  async applications(@Query("status") status = "all") {
    return this.merchantsService.listApplications(status);
  }

  @Patch("merchant-applications/:id/status")
  async reviewApplication(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.merchantsService.reviewApplication(id, body);
  }

  @Get("merchants")
  async merchants() {
    return this.merchantsService.listMerchants();
  }

  @Get("merchants/:id")
  async merchant(@Param("id") id: string) {
    return this.merchantsService.getMerchant(id);
  }

  @Post("merchants/:id/rooms")
  async createRoom(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.merchantsService.createRoom(id, body);
  }

  @Get("bookings")
  async bookings(
    @Query("status") status = "all",
    @Query("merchantId") merchantId = "",
  ) {
    return this.bookingsService.listAdminBookings(status, merchantId);
  }

  @Patch("bookings/:id/status")
  async updateBooking(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.bookingsService.updateBookingStatus(id, body);
  }
}
