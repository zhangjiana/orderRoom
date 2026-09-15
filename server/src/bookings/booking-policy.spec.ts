import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessBooking,
  createInvitationToken,
  doBookingSlotsOverlap,
  isInvitationTokenValid,
  isBookingDateTimeInFuture,
  isBookingTransitionAllowed,
} from "./booking-policy";

describe("booking policy", () => {
  it("rejects a time earlier than now on the same date", () => {
    const now = new Date("2026-07-23T19:00:00+08:00");

    assert.equal(isBookingDateTimeInFuture("2026-07-23", "18:30", now), false);
    assert.equal(isBookingDateTimeInFuture("2026-07-23", "19:30", now), true);
  });

  it("treats partially overlapping two-hour dining slots as conflicts", () => {
    assert.equal(
      doBookingSlotsOverlap("2026-07-24", "18:30", "2026-07-24", "19:00"),
      true,
    );
    assert.equal(
      doBookingSlotsOverlap("2026-07-24", "18:30", "2026-07-24", "20:30"),
      false,
    );
  });

  it("allows each actor only the transitions it owns", () => {
    assert.equal(isBookingTransitionAllowed("user", "pending", "cancelled"), true);
    assert.equal(isBookingTransitionAllowed("user", "confirmed", "cancelled"), true);
    assert.equal(isBookingTransitionAllowed("user", "confirmed", "completed"), false);
    assert.equal(isBookingTransitionAllowed("merchant", "pending", "confirmed"), true);
    assert.equal(isBookingTransitionAllowed("merchant", "confirmed", "completed"), true);
    assert.equal(isBookingTransitionAllowed("merchant", "rejected", "confirmed"), false);
  });

  it("uses an unguessable invitation token and rejects the wrong token", () => {
    const token = createInvitationToken();

    assert.match(token, /^[a-f0-9]{48}$/);
    assert.equal(isInvitationTokenValid(token, token), true);
    assert.equal(isInvitationTokenValid(token, `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`), false);
    assert.equal(isInvitationTokenValid(token, ""), false);
    assert.doesNotThrow(() => isInvitationTokenValid(token, "宴".repeat(48)));
    assert.equal(isInvitationTokenValid(token, "宴".repeat(48)), false);
  });

  it("does not allow one signed-in user to access another user's booking", () => {
    assert.equal(canAccessBooking("user_a", "user_a", "13800138000", ""), true);
    assert.equal(canAccessBooking("user_a", "user_b", "13800138000", "13800138000"), false);
    assert.equal(canAccessBooking("", "", "13800138000", "13800138000"), false);
    assert.equal(canAccessBooking("", "", "13800138000", "13900139000"), false);
  });
});
