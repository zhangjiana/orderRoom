import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { nowString } from "../common/utils/time.util";

@Controller("api")
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get("health")
  health() {
    return {
      ok: true,
      service: "yanqing-binpeng-backend",
      env: this.configService.get<string>("app.env", "development"),
      time: nowString(),
    };
  }
}
