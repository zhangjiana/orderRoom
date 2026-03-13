import { Injectable, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import mysql, { Pool, PoolConnection } from "mysql2/promise";
import { createId } from "../common/utils/id.util";
import { nowString } from "../common/utils/time.util";
import { hashPassword } from "../common/security/password.util";

type MysqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
};

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private pool: Pool | null = null;
  private readonly legacyDbPath = join(process.cwd(), "server", "data", "db.json");

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  get mysqlConfig(): MysqlConfig {
    return this.configService.getOrThrow<MysqlConfig>("mysql");
  }

  async queryRows<T = unknown[]>(
    sql: string,
    params: unknown[] = [],
    connection?: Pool | PoolConnection,
  ): Promise<T> {
    const [rows] = await (connection || this.getPool()).query(sql, params as any[]);
    return rows as T;
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    connection?: Pool | PoolConnection,
  ): Promise<T | null> {
    const rows = await this.queryRows<T[]>(sql, params, connection);
    return rows[0] || null;
  }

  async execute(
    sql: string,
    params: unknown[] = [],
    connection?: Pool | PoolConnection,
  ): Promise<void> {
    await (connection || this.getPool()).execute(sql, params as any[]);
  }

  async withTransaction<T>(handler: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.getPool().getConnection();

    try {
      await connection.beginTransaction();
      const result = await handler(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private getPool(): Pool {
    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    return this.pool;
  }

  private async initialize(): Promise<void> {
    if (this.pool) {
      return;
    }

    await this.createDatabaseIfNeeded();

    this.pool = mysql.createPool({
      ...this.mysqlConfig,
      waitForConnections: true,
      queueLimit: 0,
      charset: "utf8mb4",
      decimalNumbers: true,
    });

    await this.createSchema();
    await this.seedAdminIfNeeded();
    await this.seedBusinessDataIfNeeded();
  }

  private async createDatabaseIfNeeded(): Promise<void> {
    const baseConnection = await mysql.createConnection({
      host: this.mysqlConfig.host,
      port: this.mysqlConfig.port,
      user: this.mysqlConfig.user,
      password: this.mysqlConfig.password,
      decimalNumbers: true,
    });

    try {
      await baseConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${this.mysqlConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    } finally {
      await baseConnection.end();
    }
  }

  private async createSchema(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS merchant_applications (
        id VARCHAR(40) PRIMARY KEY,
        merchant_name VARCHAR(120) NOT NULL,
        applicant_name VARCHAR(60) NOT NULL,
        phone VARCHAR(32) NOT NULL,
        address VARCHAR(255) NOT NULL,
        province VARCHAR(60) NOT NULL,
        city VARCHAR(60) NOT NULL,
        district VARCHAR(60) NOT NULL,
        latitude DECIMAL(10, 6) NOT NULL,
        longitude DECIMAL(10, 6) NOT NULL,
        business_hours VARCHAR(60) NOT NULL,
        contact_phone VARCHAR(32) NOT NULL,
        cover_image VARCHAR(255) NOT NULL DEFAULT '',
        status VARCHAR(24) NOT NULL,
        created_at DATETIME NOT NULL,
        reviewed_at VARCHAR(32) NOT NULL DEFAULT '',
        review_remark VARCHAR(255) NOT NULL DEFAULT '',
        INDEX idx_application_status (status),
        INDEX idx_application_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS merchants (
        id VARCHAR(40) PRIMARY KEY,
        application_id VARCHAR(40) NOT NULL,
        name VARCHAR(120) NOT NULL,
        owner_name VARCHAR(60) NOT NULL,
        phone VARCHAR(32) NOT NULL,
        contact_phone VARCHAR(32) NOT NULL,
        address VARCHAR(255) NOT NULL,
        province VARCHAR(60) NOT NULL,
        city VARCHAR(60) NOT NULL,
        district VARCHAR(60) NOT NULL,
        latitude DECIMAL(10, 6) NOT NULL,
        longitude DECIMAL(10, 6) NOT NULL,
        business_hours VARCHAR(60) NOT NULL,
        status VARCHAR(24) NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE KEY uk_merchant_application_id (application_id),
        INDEX idx_merchant_status (status),
        INDEX idx_merchant_city (city)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(40) PRIMARY KEY,
        merchant_id VARCHAR(40) NOT NULL,
        name VARCHAR(120) NOT NULL,
        capacity_min INT NOT NULL,
        capacity_max INT NOT NULL,
        min_spend INT NOT NULL,
        description TEXT NOT NULL,
        tags_json JSON NOT NULL,
        status VARCHAR(24) NOT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_room_merchant_id (merchant_id),
        INDEX idx_room_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(40) PRIMARY KEY,
        merchant_id VARCHAR(40) NOT NULL,
        merchant_name VARCHAR(120) NOT NULL,
        merchant_address VARCHAR(255) NOT NULL,
        merchant_latitude DECIMAL(10, 6) NULL,
        merchant_longitude DECIMAL(10, 6) NULL,
        room_id VARCHAR(40) NOT NULL,
        room_name VARCHAR(120) NOT NULL,
        min_spend INT NOT NULL,
        dining_date DATE NOT NULL,
        dining_time TIME NOT NULL,
        guest_count INT NOT NULL,
        contact_name VARCHAR(60) NOT NULL,
        contact_phone VARCHAR(32) NOT NULL,
        remarks VARCHAR(255) NOT NULL DEFAULT '',
        occasion VARCHAR(60) NOT NULL DEFAULT '',
        budget INT NOT NULL DEFAULT 0,
        status VARCHAR(24) NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        INDEX idx_booking_status (status),
        INDEX idx_booking_merchant_id (merchant_id),
        INDEX idx_booking_contact_phone (contact_phone),
        INDEX idx_booking_room_slot (room_id, dining_date, dining_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id VARCHAR(40) PRIMARY KEY,
        username VARCHAR(60) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(80) NOT NULL,
        role VARCHAR(40) NOT NULL,
        created_at DATETIME NOT NULL,
        last_login_at VARCHAR(32) NOT NULL DEFAULT ''
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id VARCHAR(40) PRIMARY KEY,
        user_id VARCHAR(40) NOT NULL,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        created_at DATETIME NOT NULL,
        last_active_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        INDEX idx_session_user_id (user_id),
        INDEX idx_session_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  private async seedAdminIfNeeded(): Promise<void> {
    const row = await this.queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM admin_users");
    if (row && row.total > 0) {
      return;
    }

    const adminUsername = this.configService.get<string>("seed.adminUsername", "admin");
    const adminPassword = this.configService.get<string>("seed.adminPassword", "Admin@123456");

    await this.execute(
      `INSERT INTO admin_users (
        id, username, password_hash, display_name, role, created_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        createId("admin"),
        adminUsername,
        hashPassword(adminPassword),
        "平台管理员",
        "super_admin",
        nowString(),
        "",
      ],
    );
  }

  private async seedBusinessDataIfNeeded(): Promise<void> {
    const row = await this.queryOne<{
      applicationCount: number;
      merchantCount: number;
      roomCount: number;
      bookingCount: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM merchant_applications) AS applicationCount,
        (SELECT COUNT(*) FROM merchants) AS merchantCount,
        (SELECT COUNT(*) FROM rooms) AS roomCount,
        (SELECT COUNT(*) FROM bookings) AS bookingCount`,
    );

    if (
      row &&
      (row.applicationCount > 0 || row.merchantCount > 0 || row.roomCount > 0 || row.bookingCount > 0)
    ) {
      return;
    }

    if (!existsSync(this.legacyDbPath)) {
      return;
    }

    const snapshot = JSON.parse(readFileSync(this.legacyDbPath, "utf8")) as {
      merchantApplications?: Array<Record<string, unknown>>;
      merchants?: Array<Record<string, unknown>>;
      rooms?: Array<Record<string, unknown>>;
      bookings?: Array<Record<string, unknown>>;
    };

    await this.withTransaction(async (connection) => {
      for (const item of snapshot.merchantApplications || []) {
        await this.execute(
          `INSERT INTO merchant_applications (
            id, merchant_name, applicant_name, phone, address, province, city, district,
            latitude, longitude, business_hours, contact_phone, cover_image, status,
            created_at, reviewed_at, review_remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.merchantName,
            item.applicantName,
            item.phone,
            item.address,
            item.province,
            item.city,
            item.district,
            item.latitude,
            item.longitude,
            item.businessHours,
            item.contactPhone,
            item.coverImage || "",
            item.status,
            item.createdAt,
            item.reviewedAt || "",
            item.reviewRemark || "",
          ],
          connection,
        );
      }

      for (const item of snapshot.merchants || []) {
        await this.execute(
          `INSERT INTO merchants (
            id, application_id, name, owner_name, phone, contact_phone, address, province,
            city, district, latitude, longitude, business_hours, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.applicationId,
            item.name,
            item.ownerName,
            item.phone,
            item.contactPhone,
            item.address,
            item.province,
            item.city,
            item.district,
            item.latitude,
            item.longitude,
            item.businessHours,
            item.status,
            item.createdAt,
          ],
          connection,
        );
      }

      for (const item of snapshot.rooms || []) {
        await this.execute(
          `INSERT INTO rooms (
            id, merchant_id, name, capacity_min, capacity_max, min_spend, description,
            tags_json, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?)`,
          [
            item.id,
            item.merchantId,
            item.name,
            item.capacityMin,
            item.capacityMax,
            item.minSpend,
            item.description || "",
            JSON.stringify(item.tags || []),
            item.status,
            item.createdAt,
          ],
          connection,
        );
      }

      for (const item of snapshot.bookings || []) {
        await this.execute(
          `INSERT INTO bookings (
            id, merchant_id, merchant_name, merchant_address, merchant_latitude,
            merchant_longitude, room_id, room_name, min_spend, dining_date, dining_time,
            guest_count, contact_name, contact_phone, remarks, occasion, budget, status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.merchantId,
            item.merchantName,
            item.merchantAddress,
            item.merchantLatitude,
            item.merchantLongitude,
            item.roomId,
            item.roomName,
            item.minSpend,
            item.diningDate,
            item.diningTime,
            item.guestCount,
            item.contactName,
            item.contactPhone,
            item.remarks || "",
            item.occasion || "",
            item.budget || 0,
            item.status,
            item.createdAt,
            item.updatedAt,
          ],
          connection,
        );
      }
    });
  }
}
