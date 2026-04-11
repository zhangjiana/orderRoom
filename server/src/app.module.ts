import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./config/app.config";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { PublicModule } from "./public/public.module";
import { HealthModule } from "./health/health.module";
import { MerchantsModule } from "./merchants/merchants.module";
import { BookingsModule } from "./bookings/bookings.module";
import { MerchantModule } from "./merchant/merchant.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.APP_ENV_FILE || ".env",
      load: [configuration],
    }),
    DatabaseModule,
    AuthModule,
    MerchantsModule,
    BookingsModule,
    AdminModule,
    MerchantModule,
    PublicModule,
    HealthModule,
  ],
})
export class AppModule {}
