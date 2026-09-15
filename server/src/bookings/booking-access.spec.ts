import 'reflect-metadata';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { canAccessBooking } from './booking-policy';

it('does not treat a matching phone as proof of ownership', () => {
  assert.equal(canAccessBooking('', '', '13800138000', '13800138000'), false);
  assert.equal(canAccessBooking('', 'user_a', '13800138000', '13800138000'), false);
});

it('rejects anonymous booking creation before touching storage', async () => {
  const service = new BookingsService({} as any, {} as any);
  await assert.rejects(service.createBooking({}), UnauthorizedException);
});

it('rejects legacy phone access without reading or changing orders', async () => {
  const service = new BookingsService({} as any, {} as any);
  await assert.rejects(service.listPublicBookings('13800138000'), UnauthorizedException);
  await assert.rejects(service.getPublicBooking('booking_1', '13800138000'), UnauthorizedException);
  await assert.rejects(service.cancelPublicBooking('booking_1', '13800138000'), UnauthorizedException);
});

it('allows the owner and rejects other users and anonymous historical orders', async () => {
  const row = {
    id: 'booking_1', userId: 'user_a', contactPhone: '13800138000',
    diningDate: '2099-01-01', diningTime: '18:30', status: 'confirmed',
    createdAt: '2026-01-01 00:00:00', updatedAt: '2026-01-01 00:00:00',
  };
  const service = new BookingsService({ queryOne: async () => row } as any, {} as any);
  assert.equal((await service.getUserBooking('user_a', 'booking_1')).id, 'booking_1');
  await assert.rejects(service.getUserBooking('user_b', 'booking_1'), { status: 404 });
  await assert.rejects(service.cancelUserBooking('user_b', 'booking_1'), { status: 404 });
  row.userId = '';
  await assert.rejects(service.getUserBooking('user_a', 'booking_1'), { status: 404 });
});

it('keeps confirmed invitation access scoped to its secret token', async () => {
  const row = {
    id: 'booking_1', userId: 'user_a', contactName: '邀请人', contactPhone: '13800138000',
    diningDate: '2099-01-01', diningTime: '18:30', status: 'confirmed',
    invitationToken: 'a'.repeat(48),
    createdAt: '2026-01-01 00:00:00', updatedAt: '2026-01-01 00:00:00',
  };
  const service = new BookingsService({ queryOne: async () => row } as any, {} as any);
  const invitation = await service.getPublicInvitation('booking_1', row.invitationToken);
  assert.equal(invitation.hostName, '邀请人');
  assert.equal('contactPhone' in invitation, false);
  await assert.rejects(service.getPublicInvitation('booking_1', 'b'.repeat(48)), { status: 404 });
});
