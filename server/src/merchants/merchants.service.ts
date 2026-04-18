import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { DatabaseService } from "../database/database.service";
import { hashPassword } from "../common/security/password.util";
import { createId } from "../common/utils/id.util";
import { distanceKm } from "../common/utils/distance.util";
import { nowString, formatDateTime } from "../common/utils/time.util";
import { toNumber } from "../common/utils/number.util";
import {
  isMainlandMobile,
  isValidLatitude,
  isValidLongitude,
  normalizeText,
  validateRequired,
} from "../common/utils/validation.util";

const ROOM_STATUSES = ["available", "paused"] as const;

type MerchantRow = {
  id: string;
  applicationId: string;
  name: string;
  ownerName: string;
  phone: string;
  contactPhone: string;
  address: string;
  province: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  businessHours: string;
  status: string;
  createdAt: string | Date;
};

type RoomRow = {
  id: string;
  merchantId: string;
  name: string;
  capacityMin: number;
  capacityMax: number;
  minSpend: number;
  description: string;
  tagsJson: string;
  status: string;
  createdAt: string | Date;
};

type NormalizedRoomPayload = {
  name: string;
  capacityMin: number;
  capacityMax: number;
  minSpend: number;
  description: string;
  tags: string[];
  status: string;
};

type MerchantStaffBootstrap = {
  username: string;
  phone: string;
  displayName: string;
  initialPassword?: string;
};

function parseTags(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : normalizeText(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function assertRoomPayload(payload: Record<string, unknown>, fallback?: Partial<RoomRow>): NormalizedRoomPayload {
  const name = payload.name === undefined ? normalizeText(fallback?.name) : normalizeText(payload.name);
  const capacityMin = payload.capacityMin === undefined ? Number(fallback?.capacityMin) : toNumber(payload.capacityMin);
  const capacityMax = payload.capacityMax === undefined ? Number(fallback?.capacityMax) : toNumber(payload.capacityMax);
  const minSpend = payload.minSpend === undefined ? Number(fallback?.minSpend) : toNumber(payload.minSpend);
  const description =
    payload.description === undefined ? normalizeText(fallback?.description) : normalizeText(payload.description);
  const tags = payload.tags === undefined ? JSON.parse(String(fallback?.tagsJson || "[]")) : parseTags(payload.tags);
  const status = payload.status === undefined ? normalizeText(fallback?.status || "available") : normalizeText(payload.status);

  if (!name) {
    throw new BadRequestException("包间名称不能为空");
  }

  if (!Number.isInteger(capacityMin) || !Number.isInteger(capacityMax) || capacityMin < 1 || capacityMax < capacityMin) {
    throw new BadRequestException("包间人数范围不合法");
  }

  if (!Number.isInteger(minSpend) || minSpend < 0) {
    throw new BadRequestException("最低消费金额不合法");
  }

  if (!ROOM_STATUSES.includes(status as (typeof ROOM_STATUSES)[number])) {
    throw new BadRequestException("包间状态仅支持 available 或 paused");
  }

  return { name, capacityMin, capacityMax, minSpend, description, tags, status };
}

function createInitialPassword(): string {
  return randomBytes(5).toString("hex");
}

@Injectable()
export class MerchantsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async getDashboard() {
    const summary = await this.databaseService.queryOne<{
      totalApplications: number;
      pendingApplications: number;
      approvedApplications: number;
      activeMerchants: number;
      totalRooms: number;
      totalBookings: number;
      pendingBookings: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM merchant_applications) AS totalApplications,
        (SELECT COUNT(*) FROM merchant_applications WHERE status = 'pending') AS pendingApplications,
        (SELECT COUNT(*) FROM merchant_applications WHERE status = 'approved') AS approvedApplications,
        (SELECT COUNT(*) FROM merchants WHERE status = 'active') AS activeMerchants,
        (SELECT COUNT(*) FROM rooms) AS totalRooms,
        (SELECT COUNT(*) FROM bookings) AS totalBookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pendingBookings`,
    );

    return { summary };
  }

  async listApplications(status = "all") {
    const rows = await this.databaseService.queryRows<Array<{
      id: string;
      merchantName: string;
      applicantName: string;
      phone: string;
      address: string;
      province: string;
      city: string;
      district: string;
      latitude: number;
      longitude: number;
      businessHours: string;
      contactPhone: string;
      coverImage: string;
      status: string;
      createdAt: string | Date;
      reviewedAt: string;
      reviewRemark: string;
    }>>(
      `SELECT
        id,
        merchant_name AS merchantName,
        applicant_name AS applicantName,
        phone,
        address,
        province,
        city,
        district,
        latitude,
        longitude,
        business_hours AS businessHours,
        contact_phone AS contactPhone,
        cover_image AS coverImage,
        status,
        created_at AS createdAt,
        reviewed_at AS reviewedAt,
        review_remark AS reviewRemark
      FROM merchant_applications
      ${status === "all" ? "" : "WHERE status = ?"}
      ORDER BY created_at DESC`,
      status === "all" ? [] : [status],
    );

    return {
      items: rows.map((row) => ({
        ...row,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        createdAt: formatDateTime(row.createdAt),
        reviewedAt: row.reviewedAt || "",
      })),
    };
  }

  async createApplication(payload: Record<string, unknown>) {
    const missing = validateRequired(
      [
        "merchantName",
        "applicantName",
        "phone",
        "address",
        "province",
        "city",
        "district",
        "latitude",
        "longitude",
        "businessHours",
        "contactPhone",
      ],
      payload,
    );

    if (missing.length) {
      throw new BadRequestException({ message: "缺少必要字段", missing });
    }

    const application = {
      id: createId("apply"),
      merchantName: normalizeText(payload.merchantName),
      applicantName: normalizeText(payload.applicantName),
      phone: normalizeText(payload.phone),
      address: normalizeText(payload.address),
      province: normalizeText(payload.province),
      city: normalizeText(payload.city),
      district: normalizeText(payload.district),
      latitude: toNumber(payload.latitude),
      longitude: toNumber(payload.longitude),
      businessHours: normalizeText(payload.businessHours),
      contactPhone: normalizeText(payload.contactPhone),
      coverImage: payload.coverImage ? normalizeText(payload.coverImage) : "",
      status: "pending",
      createdAt: nowString(),
      reviewedAt: "",
      reviewRemark: "",
    };

    if (!isMainlandMobile(application.phone) || !isMainlandMobile(application.contactPhone)) {
      throw new BadRequestException("手机号格式不正确");
    }

    if (!isValidLatitude(application.latitude) || !isValidLongitude(application.longitude)) {
      throw new BadRequestException("经纬度不合法");
    }

    await this.databaseService.execute(
      `INSERT INTO merchant_applications (
        id, merchant_name, applicant_name, phone, address, province, city, district,
        latitude, longitude, business_hours, contact_phone, cover_image, status,
        created_at, reviewed_at, review_remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        application.id,
        application.merchantName,
        application.applicantName,
        application.phone,
        application.address,
        application.province,
        application.city,
        application.district,
        application.latitude,
        application.longitude,
        application.businessHours,
        application.contactPhone,
        application.coverImage,
        application.status,
        application.createdAt,
        application.reviewedAt,
        application.reviewRemark,
      ],
    );

    return application;
  }

  async reviewApplication(id: string, payload: Record<string, unknown>) {
    const status = String(payload.status || "");
    const reviewRemark = normalizeText(payload.reviewRemark);

    if (!["approved", "rejected"].includes(status)) {
      throw new BadRequestException("status 仅支持 approved 或 rejected");
    }

    const application = await this.databaseService.queryOne<{
      id: string;
      merchantName: string;
      applicantName: string;
      phone: string;
      address: string;
      province: string;
      city: string;
      district: string;
      latitude: number;
      longitude: number;
      businessHours: string;
      contactPhone: string;
      coverImage: string;
      status: string;
      createdAt: string | Date;
    }>(
      `SELECT
        id,
        merchant_name AS merchantName,
        applicant_name AS applicantName,
        phone,
        address,
        province,
        city,
        district,
        latitude,
        longitude,
        business_hours AS businessHours,
        contact_phone AS contactPhone,
        cover_image AS coverImage,
        status,
        created_at AS createdAt
      FROM merchant_applications
      WHERE id = ?
      LIMIT 1`,
      [id],
    );

    if (!application) {
      throw new NotFoundException("商家入驻申请不存在");
    }

    if (application.status !== "pending") {
      throw new BadRequestException("该申请已审核，不能重复操作");
    }

    const reviewedAt = nowString();
    let merchantStaff: MerchantStaffBootstrap | undefined;

    await this.databaseService.withTransaction(async (connection) => {
      await this.databaseService.execute(
        "UPDATE merchant_applications SET status = ?, reviewed_at = ?, review_remark = ? WHERE id = ?",
        [status, reviewedAt, reviewRemark, id],
        connection,
      );

      if (status === "approved") {
        const existingMerchant = await this.databaseService.queryOne<{ id: string }>(
          "SELECT id FROM merchants WHERE application_id = ? LIMIT 1",
          [id],
          connection,
        );
        let merchantId = existingMerchant?.id || "";

        if (!existingMerchant) {
          merchantId = createId("merchant");
          await this.databaseService.execute(
            `INSERT INTO merchants (
              id, application_id, name, owner_name, phone, contact_phone, address, province,
              city, district, latitude, longitude, business_hours, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              merchantId,
              id,
              application.merchantName,
              application.applicantName,
              application.phone,
              application.contactPhone,
              application.address,
              application.province,
              application.city,
              application.district,
              application.latitude,
              application.longitude,
              application.businessHours,
              "active",
              nowString(),
            ],
            connection,
          );
        }

        merchantStaff = await this.ensureMerchantStaff(
          merchantId,
          {
            username: application.phone,
            phone: application.phone,
            displayName: application.applicantName,
          },
          connection,
        );
      }
    });

    return {
      ...application,
      latitude: Number(application.latitude),
      longitude: Number(application.longitude),
      createdAt: formatDateTime(application.createdAt),
      reviewedAt,
      reviewRemark,
      status,
      merchantStaff,
    };
  }

  async listMerchants() {
    return {
      items: await this.loadMerchants(),
    };
  }

  async getMerchant(id: string, activeOnly = false) {
    const merchants = await this.loadMerchants(id, activeOnly);
    const merchant = merchants[0]
      ? {
          ...merchants[0],
          rooms: activeOnly
            ? merchants[0].rooms.filter((room: any) => room.status === "available")
            : merchants[0].rooms,
        }
      : undefined;

    if (!merchant) {
      throw new NotFoundException("商家不存在");
    }

    return merchant;
  }

  async createRoom(merchantId: string, payload: Record<string, unknown>) {
    const missing = validateRequired(["name", "capacityMin", "capacityMax", "minSpend"], payload);
    if (missing.length) {
      throw new BadRequestException({ message: "缺少必要字段", missing });
    }

    const merchant = await this.databaseService.queryOne<{ id: string }>(
      "SELECT id FROM merchants WHERE id = ? LIMIT 1",
      [merchantId],
    );

    if (!merchant) {
      throw new NotFoundException("商家不存在");
    }

    const normalizedRoom = assertRoomPayload(payload);
    const room = {
      id: createId("room"),
      merchantId,
      ...normalizedRoom,
      createdAt: nowString(),
    };

    await this.databaseService.execute(
      `INSERT INTO rooms (
        id, merchant_id, name, capacity_min, capacity_max, min_spend, description, tags_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?)`,
      [
        room.id,
        room.merchantId,
        room.name,
        room.capacityMin,
        room.capacityMax,
        room.minSpend,
        room.description,
        JSON.stringify(room.tags),
        room.status,
        room.createdAt,
      ],
    );

    return room;
  }

  async listMerchantRooms(merchantId: string) {
    const merchant = await this.databaseService.queryOne<{ id: string }>(
      "SELECT id FROM merchants WHERE id = ? LIMIT 1",
      [merchantId],
    );

    if (!merchant) {
      throw new NotFoundException("商家不存在");
    }

    return {
      items: await this.loadRoomsForMerchant(merchantId),
    };
  }

  async updateMerchantRoom(merchantId: string, roomId: string, payload: Record<string, unknown>) {
    const room = await this.databaseService.queryOne<RoomRow>(
      `SELECT
        id,
        merchant_id AS merchantId,
        name,
        capacity_min AS capacityMin,
        capacity_max AS capacityMax,
        min_spend AS minSpend,
        description,
        CAST(tags_json AS CHAR) AS tagsJson,
        status,
        created_at AS createdAt
      FROM rooms
      WHERE id = ? AND merchant_id = ?
      LIMIT 1`,
      [roomId, merchantId],
    );

    if (!room) {
      throw new NotFoundException("包间不存在");
    }

    const normalizedRoom = assertRoomPayload(payload, room);
    await this.databaseService.execute(
      `UPDATE rooms
      SET name = ?, capacity_min = ?, capacity_max = ?, min_spend = ?, description = ?, tags_json = CAST(? AS JSON), status = ?
      WHERE id = ? AND merchant_id = ?`,
      [
        normalizedRoom.name,
        normalizedRoom.capacityMin,
        normalizedRoom.capacityMax,
        normalizedRoom.minSpend,
        normalizedRoom.description,
        JSON.stringify(normalizedRoom.tags),
        normalizedRoom.status,
        roomId,
        merchantId,
      ],
    );

    const [updated] = await this.loadRoomsForMerchant(merchantId, roomId);
    return updated;
  }

  async getMerchantProfile(merchantId: string) {
    return this.getMerchant(merchantId);
  }

  async updateMerchantProfile(merchantId: string, payload: Record<string, unknown>) {
    const merchant = await this.databaseService.queryOne<MerchantRow>(
      `SELECT
        id,
        application_id AS applicationId,
        name,
        owner_name AS ownerName,
        phone,
        contact_phone AS contactPhone,
        address,
        province,
        city,
        district,
        latitude,
        longitude,
        business_hours AS businessHours,
        status,
        created_at AS createdAt
      FROM merchants
      WHERE id = ?
      LIMIT 1`,
      [merchantId],
    );

    if (!merchant) {
      throw new NotFoundException("商家不存在");
    }

    const name = payload.name === undefined ? merchant.name : normalizeText(payload.name);
    const contactPhone = payload.contactPhone === undefined ? merchant.contactPhone : normalizeText(payload.contactPhone);
    const address = payload.address === undefined ? merchant.address : normalizeText(payload.address);
    const businessHours = payload.businessHours === undefined ? merchant.businessHours : normalizeText(payload.businessHours);
    const latitude = payload.latitude === undefined ? Number(merchant.latitude) : toNumber(payload.latitude);
    const longitude = payload.longitude === undefined ? Number(merchant.longitude) : toNumber(payload.longitude);

    if (!name || !address || !businessHours) {
      throw new BadRequestException("门店名称、地址和营业时间不能为空");
    }

    if (!isMainlandMobile(contactPhone)) {
      throw new BadRequestException("联系电话格式不正确");
    }

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      throw new BadRequestException("经纬度不合法");
    }

    await this.databaseService.execute(
      `UPDATE merchants
      SET name = ?, contact_phone = ?, address = ?, latitude = ?, longitude = ?, business_hours = ?
      WHERE id = ?`,
      [name, contactPhone, address, latitude, longitude, businessHours, merchantId],
    );

    return this.getMerchant(merchantId);
  }

  async listPublicMerchants(keyword = "", latitude?: string, longitude?: string) {
    const normalizedKeyword = String(keyword || "").trim().toLowerCase();
    const params: unknown[] = [];
    let whereClause = "WHERE status = 'active'";

    if (normalizedKeyword) {
      whereClause += " AND LOWER(CONCAT(name, ' ', address, ' ', city, ' ', district)) LIKE ?";
      params.push(`%${normalizedKeyword}%`);
    }

    const merchants = await this.loadMerchants(undefined, false, whereClause, params);
    const lat = latitude === undefined ? null : Number(latitude);
    const lng = longitude === undefined ? null : Number(longitude);

    return {
      items: merchants
        .map((merchant) => {
          const distance = distanceKm(lat, lng, merchant.latitude, merchant.longitude);
          return {
            ...merchant,
            rooms: merchant.rooms.filter((room: any) => room.status === "available"),
            distanceKm: distance === null ? null : Number(distance.toFixed(2)),
          };
        })
        .sort((left, right) => {
          if (left.distanceKm === null && right.distanceKm === null) {
            return 0;
          }
          if (left.distanceKm === null) {
            return 1;
          }
          if (right.distanceKm === null) {
            return -1;
          }
          return left.distanceKm - right.distanceKm;
        }),
    };
  }

  private async loadMerchants(
    merchantId?: string,
    activeOnly = false,
    customWhere?: string,
    customParams: unknown[] = [],
  ) {
    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (customWhere) {
      const stripped = customWhere.replace(/^WHERE\s+/i, "");
      if (stripped) {
        whereParts.push(stripped);
      }
      params.push(...customParams);
    }

    if (merchantId) {
      whereParts.push("id = ?");
      params.push(merchantId);
    }

    if (activeOnly) {
      whereParts.push("status = 'active'");
    }

    const merchantRows = await this.databaseService.queryRows<MerchantRow[]>(
      `SELECT
        id,
        application_id AS applicationId,
        name,
        owner_name AS ownerName,
        phone,
        contact_phone AS contactPhone,
        address,
        province,
        city,
        district,
        latitude,
        longitude,
        business_hours AS businessHours,
        status,
        created_at AS createdAt
      FROM merchants
      ${whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : ""}
      ORDER BY created_at DESC`,
      params,
    );

    if (!merchantRows.length) {
      return [];
    }

    const roomRows = await this.databaseService.queryRows<RoomRow[]>(
      `SELECT
        id,
        merchant_id AS merchantId,
        name,
        capacity_min AS capacityMin,
        capacity_max AS capacityMax,
        min_spend AS minSpend,
        description,
        CAST(tags_json AS CHAR) AS tagsJson,
        status,
        created_at AS createdAt
      FROM rooms
      WHERE merchant_id IN (?)
      ORDER BY created_at DESC`,
      [merchantRows.map((item) => item.id)],
    );

    const roomsByMerchant = roomRows.reduce<Record<string, Array<Record<string, unknown>>>>((accumulator, row) => {
      const mapped = {
        id: row.id,
        merchantId: row.merchantId,
        name: row.name,
        capacityMin: Number(row.capacityMin),
        capacityMax: Number(row.capacityMax),
        minSpend: Number(row.minSpend),
        description: row.description || "",
        tags: JSON.parse(row.tagsJson || "[]"),
        status: row.status,
        createdAt: formatDateTime(row.createdAt),
      };

      accumulator[row.merchantId] = accumulator[row.merchantId] || [];
      accumulator[row.merchantId].push(mapped);
      return accumulator;
    }, {});

    return merchantRows.map((row) => ({
      id: row.id,
      applicationId: row.applicationId,
      name: row.name,
      ownerName: row.ownerName,
      phone: row.phone,
      contactPhone: row.contactPhone,
      address: row.address,
      province: row.province,
      city: row.city,
      district: row.district,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      businessHours: row.businessHours,
      status: row.status,
      createdAt: formatDateTime(row.createdAt),
      roomCount: (roomsByMerchant[row.id] || []).length,
      rooms: roomsByMerchant[row.id] || [],
    }));
  }

  private async loadRoomsForMerchant(merchantId: string, roomId = "") {
    const rows = await this.databaseService.queryRows<RoomRow[]>(
      `SELECT
        id,
        merchant_id AS merchantId,
        name,
        capacity_min AS capacityMin,
        capacity_max AS capacityMax,
        min_spend AS minSpend,
        description,
        CAST(tags_json AS CHAR) AS tagsJson,
        status,
        created_at AS createdAt
      FROM rooms
      WHERE merchant_id = ?
      ${roomId ? "AND id = ?" : ""}
      ORDER BY created_at DESC`,
      roomId ? [merchantId, roomId] : [merchantId],
    );

    return rows.map((row) => this.mapRoom(row));
  }

  private mapRoom(row: RoomRow) {
    return {
      id: row.id,
      merchantId: row.merchantId,
      name: row.name,
      capacityMin: Number(row.capacityMin),
      capacityMax: Number(row.capacityMax),
      minSpend: Number(row.minSpend),
      description: row.description || "",
      tags: JSON.parse(row.tagsJson || "[]"),
      status: row.status,
      createdAt: formatDateTime(row.createdAt),
    };
  }

  private async ensureMerchantStaff(
    merchantId: string,
    staff: { username: string; phone: string; displayName: string },
    connection: Parameters<DatabaseService["execute"]>[2],
  ): Promise<MerchantStaffBootstrap> {
    const existingStaff = await this.databaseService.queryOne<{
      username: string;
      phone: string;
      displayName: string;
    }>(
      "SELECT username, phone, display_name AS displayName FROM merchant_staff WHERE merchant_id = ? LIMIT 1",
      [merchantId],
      connection,
    );

    if (existingStaff) {
      return existingStaff;
    }

    let username = staff.username;
    const duplicatedUsername = await this.databaseService.queryOne<{ id: string }>(
      "SELECT id FROM merchant_staff WHERE username = ? LIMIT 1",
      [username],
      connection,
    );

    if (duplicatedUsername) {
      username = `${staff.username}_${merchantId.slice(-4)}`;
    }

    const configuredPassword = normalizeText(this.configService.get<string>("merchantAuth.initialPassword", ""));
    const initialPassword = configuredPassword || createInitialPassword();

    await this.databaseService.execute(
      `INSERT INTO merchant_staff (
        id, merchant_id, username, password_hash, display_name, phone, wx_openid, status, created_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createId("merchant_staff"),
        merchantId,
        username,
        hashPassword(initialPassword),
        staff.displayName,
        staff.phone,
        null,
        "active",
        nowString(),
        "",
      ],
      connection,
    );

    return {
      username,
      phone: staff.phone,
      displayName: staff.displayName,
      initialPassword,
    };
  }
}
