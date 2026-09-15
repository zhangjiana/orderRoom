import { BadRequestException, ConflictException, UnauthorizedException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { createId } from "../common/utils/id.util";
import { formatDate, formatDateTime, formatTime, nowString } from "../common/utils/time.util";
import { toNumber } from "../common/utils/number.util";
import {
  isIsoDate,
  isMainlandMobile,
  isTimeOfDay,
  normalizeText,
  todayString,
  validateRequired,
} from "../common/utils/validation.util";
import {
  canAccessBooking,
  createInvitationToken,
  doBookingSlotsOverlap,
  isInvitationTokenValid,
  isBookingDateTimeInFuture,
  isBookingTransitionAllowed,
} from "./booking-policy";
import { BookingNotificationService } from "./booking-notification.service";

function mapStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "待确认",
    confirmed: "已确认",
    rejected: "已拒绝",
    cancelled: "已取消",
    completed: "已完成",
  };

  return labels[status] || status;
}

function assertBookingDateTime(diningDate: string, diningTime: string) {
  if (!isIsoDate(diningDate)) {
    throw new BadRequestException("用餐日期格式不正确");
  }

  if (!isTimeOfDay(diningTime)) {
    throw new BadRequestException("用餐时间格式不正确");
  }

  if (diningDate < todayString() || !isBookingDateTimeInFuture(diningDate, diningTime)) {
    throw new BadRequestException("请选择尚未开始的用餐时间");
  }
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly bookingNotificationService: BookingNotificationService,
  ) {}

  async listAdminBookings(status = "all", merchantId = "") {
    const filters: string[] = [];
    const params: unknown[] = [];

    if (status !== "all") {
      filters.push("status = ?");
      params.push(status);
    }

    if (merchantId) {
      filters.push("merchant_id = ?");
      params.push(merchantId);
    }

    const rows = await this.databaseService.queryRows<any[]>(
      `SELECT
        id,
        merchant_id AS merchantId,
        merchant_name AS merchantName,
        merchant_address AS merchantAddress,
        merchant_latitude AS merchantLatitude,
        merchant_longitude AS merchantLongitude,
        room_id AS roomId,
        room_name AS roomName,
        min_spend AS minSpend,
        dining_date AS diningDate,
        dining_time AS diningTime,
        guest_count AS guestCount,
        contact_name AS contactName,
        contact_phone AS contactPhone,
        remarks,
        occasion,
        budget,
        invitation_token AS invitationToken,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM bookings
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY dining_date DESC, dining_time DESC, created_at DESC`,
      params,
    );

    return { items: rows.map((row) => this.mapBooking(row)) };
  }

  async listMerchantBookings(merchantId: string, status = "all") {
    return this.listAdminBookings(status, merchantId);
  }

  async getMerchantBooking(merchantId: string, id: string) {
    const booking = await this.findBookingById(id, merchantId);
    if (!booking) {
      throw new NotFoundException("订单不存在");
    }

    return this.mapBooking(booking);
  }

  async updateBookingStatus(id: string, payload: Record<string, unknown>) {
    const status = String(payload.status || "");
    if (!["confirmed", "rejected", "cancelled", "completed"].includes(status)) {
      throw new BadRequestException("不支持的订单状态");
    }

    const booking = await this.findBookingById(id);
    if (!booking) {
      throw new NotFoundException("订单不存在");
    }

    if (!isBookingTransitionAllowed("admin", booking.status, status)) {
      throw new BadRequestException(`订单当前状态「${mapStatusLabel(booking.status)}」不允许变更为「${mapStatusLabel(status)}」`);
    }

    await this.databaseService.execute("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?", [
      status,
      nowString(),
      id,
    ]);

    const updated = await this.findBookingById(id);
    const mapped = this.mapBooking(updated!);
    await this.bookingNotificationService.sendStatusUpdate(mapped);
    return mapped;
  }

  async updateMerchantBookingStatus(merchantId: string, id: string, payload: Record<string, unknown>) {
    const status = String(payload.status || "");
    if (!["confirmed", "rejected", "completed", "cancelled"].includes(status)) {
      throw new BadRequestException("不支持的商家订单状态");
    }

    const booking = await this.findBookingById(id, merchantId);
    if (!booking) {
      throw new NotFoundException("订单不存在");
    }

    if (!isBookingTransitionAllowed("merchant", booking.status, status)) {
      throw new BadRequestException(
        `订单当前状态「${mapStatusLabel(booking.status)}」不允许变更为「${mapStatusLabel(status)}」`,
      );
    }

    await this.databaseService.execute(
      "UPDATE bookings SET status = ?, updated_at = ? WHERE id = ? AND merchant_id = ?",
      [status, nowString(), id, merchantId],
    );

    const updated = await this.findBookingById(id, merchantId);
    if (!updated) {
      throw new NotFoundException("订单不存在");
    }

    const mapped = this.mapBooking(updated);
    await this.bookingNotificationService.sendStatusUpdate(mapped);
    return mapped;
  }

  async createBooking(payload: Record<string, unknown>, userId = "") {
    if (!userId) throw new UnauthorizedException("请先登录后提交预订");
    const missing = validateRequired(
      ["merchantId", "roomId", "diningDate", "diningTime", "guestCount", "contactName", "contactPhone"],
      payload,
    );

    if (missing.length) {
      throw new BadRequestException({ message: "缺少必要字段", missing });
    }

    const booking = {
      id: createId("booking"),
      userId,
      merchantId: normalizeText(payload.merchantId),
      roomId: normalizeText(payload.roomId),
      diningDate: normalizeText(payload.diningDate),
      diningTime: normalizeText(payload.diningTime),
      guestCount: toNumber(payload.guestCount),
      contactName: normalizeText(payload.contactName),
      contactPhone: normalizeText(payload.contactPhone),
      remarks: payload.remarks ? normalizeText(payload.remarks) : "",
      occasion: payload.occasion ? normalizeText(payload.occasion) : "",
      budget: toNumber(payload.budget),
      invitationToken: createInvitationToken(),
      subscriptionTemplateId: normalizeText(payload.subscriptionTemplateId || ""),
      status: "pending",
      createdAt: nowString(),
      updatedAt: nowString(),
    };

    if (!isMainlandMobile(booking.contactPhone)) {
      throw new BadRequestException("联系电话格式不正确");
    }

    if (!Number.isInteger(booking.guestCount) || booking.guestCount < 1 || booking.guestCount > 1000) {
      throw new BadRequestException("用餐人数不合法");
    }

    if (!Number.isInteger(booking.budget) || booking.budget < 0) {
      throw new BadRequestException("预算金额不合法");
    }

    assertBookingDateTime(booking.diningDate, booking.diningTime);

    return this.databaseService.withTransaction(async (connection) => {
      const room = await this.databaseService.queryOne<any>(
        `SELECT
          rooms.id,
          rooms.merchant_id AS merchantId,
          rooms.name,
          rooms.capacity_min AS capacityMin,
          rooms.capacity_max AS capacityMax,
          rooms.min_spend AS minSpend,
          rooms.status AS roomStatus,
          merchants.name AS merchantName,
          merchants.address AS merchantAddress,
          merchants.latitude AS merchantLatitude,
          merchants.longitude AS merchantLongitude
        FROM rooms
        INNER JOIN merchants ON merchants.id = rooms.merchant_id
        WHERE rooms.id = ? AND rooms.merchant_id = ? AND rooms.status = 'available' AND merchants.status = 'active'
        LIMIT 1
        FOR UPDATE`,
        [booking.roomId, booking.merchantId],
        connection,
      );

      if (!room) {
        throw new NotFoundException("商家或包间不存在");
      }

      if (booking.guestCount < Number(room.capacityMin) || booking.guestCount > Number(room.capacityMax)) {
        throw new BadRequestException(`用餐人数需在 ${room.capacityMin}-${room.capacityMax} 位之间`);
      }

      const activeBookings = await this.databaseService.queryRows<Array<{
        id: string;
        diningDate: string | Date;
        diningTime: string | Date;
      }>>(
        `SELECT
          id,
          dining_date AS diningDate,
          dining_time AS diningTime
        FROM bookings
        WHERE room_id = ? AND dining_date = ? AND status IN ('pending', 'confirmed')
        FOR UPDATE`,
        [booking.roomId, booking.diningDate],
        connection,
      );

      const conflict = activeBookings.find((item) =>
        doBookingSlotsOverlap(
          formatDate(item.diningDate),
          formatTime(item.diningTime),
          booking.diningDate,
          booking.diningTime,
        ),
      );

      if (conflict) {
        throw new ConflictException("该包间前后两小时内已有预订，请更换时间或包间");
      }

      await this.databaseService.execute(
        `INSERT INTO bookings (
          id, user_id, merchant_id, merchant_name, merchant_address, merchant_latitude,
          merchant_longitude, room_id, room_name, min_spend, dining_date, dining_time,
          guest_count, contact_name, contact_phone, remarks, occasion, budget, status,
          invitation_token, subscription_template_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          booking.id,
          booking.userId || null,
          booking.merchantId,
          room.merchantName,
          room.merchantAddress,
          room.merchantLatitude,
          room.merchantLongitude,
          booking.roomId,
          room.name,
          room.minSpend,
          booking.diningDate,
          booking.diningTime,
          booking.guestCount,
          booking.contactName,
          booking.contactPhone,
          booking.remarks,
          booking.occasion,
          booking.budget,
          booking.status,
          booking.invitationToken,
          booking.subscriptionTemplateId,
          booking.createdAt,
          booking.updatedAt,
        ],
        connection,
      );

      return this.mapBooking({
        ...booking,
        merchantName: room.merchantName,
        merchantAddress: room.merchantAddress,
        merchantLatitude: room.merchantLatitude,
        merchantLongitude: room.merchantLongitude,
        roomName: room.name,
        minSpend: room.minSpend,
      }, true);
    });
  }

  async listPublicBookings(_contactPhone = "") {
    throw new UnauthorizedException("手机号查询已停用，请登录查看账号订单；历史订单请联系商家");
  }

  async getPublicBooking(_id: string, _contactPhone = "") {
    throw new UnauthorizedException("手机号查询已停用，请登录查看账号订单；历史订单请联系商家");
  }

  async listUserBookings(userId: string) {
    const rows = await this.databaseService.queryRows<any[]>(
      `${this.bookingSelectSql} WHERE user_id = ?
      ORDER BY dining_date DESC, dining_time DESC, created_at DESC`,
      [userId],
    );
    return { items: rows.map((row) => this.mapBooking(row, true)) };
  }

  async getUserBooking(userId: string, id: string) {
    const booking = await this.findBookingById(id);
    if (
      !booking ||
      !canAccessBooking(booking.userId || "", userId, booking.contactPhone, "")
    ) {
      throw new NotFoundException("订单不存在");
    }
    return this.mapBooking(booking, true);
  }

  async cancelUserBooking(userId: string, id: string) {
    const booking = await this.findBookingById(id);
    if (
      !booking ||
      !canAccessBooking(booking.userId || "", userId, booking.contactPhone, "")
    ) {
      throw new NotFoundException("订单不存在");
    }

    if (!isBookingTransitionAllowed("user", booking.status, "cancelled")) {
      throw new BadRequestException(`订单当前状态「${mapStatusLabel(booking.status)}」不能取消`);
    }

    await this.databaseService.execute(
      "UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ? AND user_id = ?",
      [nowString(), id, userId],
    );
    const updated = await this.findBookingById(id);
    return this.mapBooking(updated!, true);
  }

  async cancelPublicBooking(_id: string, _contactPhone = "") {
    throw new UnauthorizedException("手机号查询已停用，请登录查看账号订单；历史订单请联系商家");
  }

  async getPublicInvitation(id: string, invitationToken = "") {
    const booking = await this.findBookingById(id);
    if (!booking) {
      throw new NotFoundException("邀请函不存在");
    }

    if (!isInvitationTokenValid(booking.invitationToken || "", invitationToken)) {
      throw new NotFoundException("邀请函不存在");
    }

    if (!["confirmed", "completed"].includes(booking.status)) {
      throw new BadRequestException("订单确认后才能生成邀请函");
    }

    const mapped = this.mapBooking(booking);
    return {
      id: mapped.id,
      merchantName: mapped.merchantName,
      merchantAddress: mapped.merchantAddress,
      merchantLatitude: mapped.merchantLatitude,
      merchantLongitude: mapped.merchantLongitude,
      roomName: mapped.roomName,
      diningDate: mapped.diningDate,
      diningTime: mapped.diningTime,
      guestCount: mapped.guestCount,
      occasion: mapped.occasion,
      hostName: mapped.contactName,
      statusLabel: mapped.statusLabel,
    };
  }

  private async findBookingById(id: string, merchantId = "") {
    return this.databaseService.queryOne<any>(
      `SELECT
        id,
        user_id AS userId,
        merchant_id AS merchantId,
        merchant_name AS merchantName,
        merchant_address AS merchantAddress,
        merchant_latitude AS merchantLatitude,
        merchant_longitude AS merchantLongitude,
        room_id AS roomId,
        room_name AS roomName,
        min_spend AS minSpend,
        dining_date AS diningDate,
        dining_time AS diningTime,
        guest_count AS guestCount,
        contact_name AS contactName,
        contact_phone AS contactPhone,
        remarks,
        occasion,
        budget,
        invitation_token AS invitationToken,
        subscription_template_id AS subscriptionTemplateId,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM bookings
      WHERE id = ?
      ${merchantId ? "AND merchant_id = ?" : ""}
      LIMIT 1`,
      merchantId ? [id, merchantId] : [id],
    );
  }

  private mapBooking(row: any, includeInvitationToken = false) {
    return {
      id: row.id,
      userId: row.userId || "",
      merchantId: row.merchantId,
      merchantName: row.merchantName,
      merchantAddress: row.merchantAddress,
      merchantLatitude: row.merchantLatitude === null ? null : Number(row.merchantLatitude),
      merchantLongitude: row.merchantLongitude === null ? null : Number(row.merchantLongitude),
      roomId: row.roomId,
      roomName: row.roomName,
      minSpend: Number(row.minSpend),
      diningDate: formatDate(row.diningDate),
      diningTime: formatTime(row.diningTime),
      guestCount: Number(row.guestCount),
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      remarks: row.remarks || "",
      occasion: row.occasion || "",
      budget: Number(row.budget || 0),
      ...(includeInvitationToken ? { invitationToken: row.invitationToken || "" } : {}),
      subscriptionTemplateId: row.subscriptionTemplateId || "",
      status: row.status,
      rawStatus: row.status,
      statusLabel: mapStatusLabel(row.status),
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    };
  }

  private get bookingSelectSql() {
    return `SELECT
      id,
      user_id AS userId,
      merchant_id AS merchantId,
      merchant_name AS merchantName,
      merchant_address AS merchantAddress,
      merchant_latitude AS merchantLatitude,
      merchant_longitude AS merchantLongitude,
      room_id AS roomId,
      room_name AS roomName,
      min_spend AS minSpend,
      dining_date AS diningDate,
      dining_time AS diningTime,
      guest_count AS guestCount,
      contact_name AS contactName,
      contact_phone AS contactPhone,
      remarks,
      occasion,
      budget,
      invitation_token AS invitationToken,
      subscription_template_id AS subscriptionTemplateId,
      status,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM bookings`;
  }
}
