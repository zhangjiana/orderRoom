import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { createId } from "../common/utils/id.util";
import { distanceKm } from "../common/utils/distance.util";
import { nowString, formatDateTime } from "../common/utils/time.util";
import { toNumber } from "../common/utils/number.util";
import { validateRequired } from "../common/utils/validation.util";

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

@Injectable()
export class MerchantsService {
  constructor(private readonly databaseService: DatabaseService) {}

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
      merchantName: String(payload.merchantName).trim(),
      applicantName: String(payload.applicantName).trim(),
      phone: String(payload.phone).trim(),
      address: String(payload.address).trim(),
      province: String(payload.province).trim(),
      city: String(payload.city).trim(),
      district: String(payload.district).trim(),
      latitude: toNumber(payload.latitude),
      longitude: toNumber(payload.longitude),
      businessHours: String(payload.businessHours).trim(),
      contactPhone: String(payload.contactPhone).trim(),
      coverImage: payload.coverImage ? String(payload.coverImage) : "",
      status: "pending",
      createdAt: nowString(),
      reviewedAt: "",
      reviewRemark: "",
    };

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
    const reviewRemark = String(payload.reviewRemark || "");

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
        created_at AS createdAt
      FROM merchant_applications
      WHERE id = ?
      LIMIT 1`,
      [id],
    );

    if (!application) {
      throw new NotFoundException("商家入驻申请不存在");
    }

    const reviewedAt = nowString();

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

        if (!existingMerchant) {
          await this.databaseService.execute(
            `INSERT INTO merchants (
              id, application_id, name, owner_name, phone, contact_phone, address, province,
              city, district, latitude, longitude, business_hours, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              createId("merchant"),
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
    };
  }

  async listMerchants() {
    return {
      items: await this.loadMerchants(),
    };
  }

  async getMerchant(id: string, activeOnly = false) {
    const merchants = await this.loadMerchants(id, activeOnly);
    const merchant = merchants[0];

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

    const room = {
      id: createId("room"),
      merchantId,
      name: String(payload.name).trim(),
      capacityMin: toNumber(payload.capacityMin),
      capacityMax: toNumber(payload.capacityMax),
      minSpend: toNumber(payload.minSpend),
      description: payload.description ? String(payload.description) : "",
      tags: Array.isArray(payload.tags)
        ? payload.tags.map((item) => String(item).trim()).filter(Boolean)
        : String(payload.tags || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
      status: payload.status ? String(payload.status) : "available",
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
}
