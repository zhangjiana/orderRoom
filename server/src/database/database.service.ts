import { Injectable, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
    const mysqlConfig = this.configService?.get<MysqlConfig>("mysql");

    return (
      mysqlConfig || {
        host: process.env.MYSQL_HOST || "127.0.0.1",
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE || "yanqing_binpeng",
        connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      }
    );
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
    await this.bootstrapAdminIfConfigured();
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

    await this.execute(`
      CREATE TABLE IF NOT EXISTS merchant_staff (
        id VARCHAR(40) PRIMARY KEY,
        merchant_id VARCHAR(40) NOT NULL,
        username VARCHAR(60) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(80) NOT NULL,
        phone VARCHAR(32) NOT NULL,
        wx_openid VARCHAR(100) NULL DEFAULT NULL,
        status VARCHAR(24) NOT NULL,
        created_at DATETIME NOT NULL,
        last_login_at VARCHAR(32) NOT NULL DEFAULT '',
        INDEX idx_merchant_staff_merchant_id (merchant_id),
        INDEX idx_merchant_staff_phone (phone),
        UNIQUE KEY uk_merchant_staff_wx_openid (wx_openid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS merchant_sessions (
        id VARCHAR(40) PRIMARY KEY,
        staff_id VARCHAR(40) NOT NULL,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        client_type VARCHAR(24) NOT NULL,
        created_at DATETIME NOT NULL,
        last_active_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        INDEX idx_merchant_session_staff_id (staff_id),
        INDEX idx_merchant_session_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  private async bootstrapAdminIfConfigured(): Promise<void> {
    const adminUsername = this.configService?.get<string>("bootstrap.adminUsername", "").trim() || "";
    const adminPassword = this.configService?.get<string>("bootstrap.adminPassword", "").trim() || "";

    if (!adminUsername || !adminPassword) {
      return;
    }

    const row = await this.queryOne<{ id: string }>(
      "SELECT id FROM admin_users WHERE username = ? LIMIT 1",
      [adminUsername],
    );

    if (row) {
      return;
    }

    await this.execute(
      `INSERT INTO admin_users (
        id, username, password_hash, display_name, role, created_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        createId("admin"),
        adminUsername,
        hashPassword(adminPassword),
        "系统管理员",
        "super_admin",
        nowString(),
        "",
      ],
    );
  }
}
