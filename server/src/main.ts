import "reflect-metadata";
import "dotenv/config";
import express from "express";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { BadRequestException, ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: false,
  });

  const configService = app.get(ConfigService);
  const bodyLimit = configService.get<string>("app.bodyLimit", "1mb");
  const trustProxy = configService.get<string>("cors.trustProxy", "loopback");
  const allowedOrigins = configService.get<string[]>("cors.allowedOrigins", []);
  const rateLimitWindowMs = configService.get<number>("rateLimit.windowMs", 15 * 60 * 1000);
  const rateLimitMax = configService.get<number>("rateLimit.max", 300);
  const port = configService.get<number>("app.port", 3001);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set("trust proxy", trustProxy);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new BadRequestException("CORS origin denied"), false);
    },
  });
  app.use(
    rateLimit({
      windowMs: rateLimitWindowMs,
      max: rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: bodyLimit }));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidUnknownValues: false,
    }),
  );

  await app.listen(port);
  console.log(`Yanqing Binpeng Nest backend listening on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap Nest backend", error);
  process.exit(1);
});
