export type BookingActor = "user" | "merchant" | "admin";

const SLOT_DURATION_MINUTES = 120;

function bookingDateTime(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime();
}

export function isBookingDateTimeInFuture(
  date: string,
  time: string,
  now = new Date(),
): boolean {
  const timestamp = bookingDateTime(date, time);
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}

export function doBookingSlotsOverlap(
  leftDate: string,
  leftTime: string,
  rightDate: string,
  rightTime: string,
): boolean {
  const leftStart = bookingDateTime(leftDate, leftTime);
  const rightStart = bookingDateTime(rightDate, rightTime);
  const duration = SLOT_DURATION_MINUTES * 60 * 1000;

  return leftStart < rightStart + duration && rightStart < leftStart + duration;
}

export function isBookingTransitionAllowed(
  actor: BookingActor,
  currentStatus: string,
  nextStatus: string,
): boolean {
  const transitions: Record<BookingActor, Record<string, string[]>> = {
    user: {
      pending: ["cancelled"],
      confirmed: ["cancelled"],
    },
    merchant: {
      pending: ["confirmed", "rejected"],
      confirmed: ["completed", "cancelled"],
    },
    admin: {
      pending: ["confirmed", "rejected", "cancelled"],
      confirmed: ["completed", "cancelled"],
    },
  };

  return (transitions[actor][currentStatus] || []).includes(nextStatus);
}

export function createInvitationToken(): string {
  return randomBytes(24).toString("hex");
}

export function isInvitationTokenValid(expected: string, supplied: string): boolean {
  if (
    !/^[a-f0-9]{48}$/.test(expected) ||
    !/^[a-f0-9]{48}$/.test(supplied)
  ) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export function canAccessBooking(
  ownerUserId: string,
  sessionUserId: string,
  bookingPhone: string,
  providedPhone: string,
): boolean {
  if (ownerUserId) {
    return Boolean(sessionUserId) && ownerUserId === sessionUserId;
  }

  return false;
}
import { randomBytes, timingSafeEqual } from "node:crypto";
