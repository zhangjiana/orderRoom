import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';

function loadPage(name: string, api: Record<string, unknown>) {
  let page: any;
  const toasts: any[] = [];
  runInNewContext(readFileSync(resolve(`miniapp/pages/${name}/index.js`), 'utf8'), {
    require: (path: string) => path.endsWith('/api') ? api : {
      formatDate: () => '2099-01-01',
      getLastPhone: () => '13800138000',
    },
    Page: (value: any) => { page = value; },
    wx: { showToast: (value: any) => toasts.push(value) },
    setTimeout,
  });
  page.setData = (patch: any) => Object.assign(page.data, patch);
  return { page, toasts };
}

it('keeps the reservation form and does not submit when login fails', async () => {
  let submissions = 0;
  const { page } = loadPage('reserve', {
    ensureUserLogin: async () => { throw new Error('登录失败'); },
    requestBookingSubscription: async () => ({ acceptedTemplateId: '' }),
    createBooking: async () => { submissions++; throw new Error('unexpected booking'); },
  });
  Object.assign(page.data.form, { contactName: '测试', phone: '13800138000', roomId: 'room_1' });
  await page.submitBooking();
  assert.equal(submissions, 0);
  assert.equal(page.data.form.contactName, '测试');
  assert.equal(page.data.submitting, false);
});

it('clears stale orders on login failure and allows a successful retry', async () => {
  let fail = true;
  const { page } = loadPage('bookings', {
    ensureUserLogin: async () => { if (fail) throw new Error('登录失败'); },
    getMyBookings: async () => [{ id: 'own_order' }],
    getBookingsByPhone: async () => { throw new Error('phone access must not run'); },
  });
  page.data.bookings = [{ id: 'stale_order' }];
  await page.onShow();
  assert.equal(page.data.bookings.length, 0);
  assert.equal(page.data.errorMessage, '登录失败');
  fail = false;
  await page.loadMyBookings();
  assert.equal(page.data.bookings[0].id, 'own_order');
  assert.equal(page.data.errorMessage, '');
});

it('uses account ownership for old detail links containing a phone number', async () => {
  const { page } = loadPage('booking-detail', {
    ensureUserLogin: async () => {},
    getMyBookingDetail: async (id: string) => ({ id }),
    getBookingDetail: async () => { throw new Error('phone access must not run'); },
  });
  page.onLoad({ id: 'own_order', phone: '13800138000' });
  await page.onShow();
  assert.equal(page.data.booking.id, 'own_order');
});
