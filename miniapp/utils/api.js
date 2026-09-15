const store = require("./store");
const config = require("../config");

function getBaseUrl() {
  const app = getApp();
  return app.globalData.apiBaseUrl;
}

function request({ url, method = "GET", data, token }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getBaseUrl()}${url}`,
      method,
      data,
      header: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data);
          return;
        }

        reject(response.data || { message: "请求失败" });
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

function getLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: "gcj02",
      success: resolve,
      fail: reject,
    });
  });
}

async function getNearbyMerchants(keyword = "", location) {
  const query = [];

  if (keyword) {
    query.push(`keyword=${encodeURIComponent(keyword)}`);
  }

  if (location) {
    query.push(`latitude=${location.latitude}`);
    query.push(`longitude=${location.longitude}`);
  }

  const suffix = query.length ? `?${query.join("&")}` : "";
  const result = await request({
    url: `/api/public/merchants${suffix}`,
  });

  return (result.items || []).map(store.mapMerchant);
}

async function getMerchantDetail(id) {
  const result = await request({
    url: `/api/public/merchants/${id}`,
  });

  return {
    ...store.mapMerchant(result),
    rooms: (result.rooms || []).map(store.mapRoom),
  };
}

async function createBooking(payload, token = store.getUserToken()) {
  const result = await request({
    url: "/api/public/bookings",
    method: "POST",
    data: payload,
    token,
  });

  store.saveLastPhone(payload.contactPhone);
  return store.mapBooking(result);
}

function wxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result.code) resolve(result.code);
        else reject(new Error("微信登录失败"));
      },
      fail: reject,
    });
  });
}

async function userLogin() {
  const loginCode = await wxLoginCode();
  const result = await request({
    url: "/api/public/auth/login",
    method: "POST",
    data: { loginCode },
  });
  store.saveUserToken(result.token);
  return result;
}

async function ensureUserLogin() {
  const token = store.getUserToken();
  if (token) {
    try {
      await request({ url: "/api/public/auth/me", token });
      return token;
    } catch (_error) {
      store.clearUserToken();
    }
  }

  const result = await userLogin();
  return result.token;
}

async function getMyBookings(token = store.getUserToken()) {
  const result = await request({ url: "/api/public/me/bookings", token });
  return (result.items || []).map(store.mapBooking);
}

async function getMyBookingDetail(id, token = store.getUserToken()) {
  const result = await request({ url: `/api/public/me/bookings/${id}`, token });
  return store.mapBooking(result);
}

async function cancelMyBooking(id, token = store.getUserToken()) {
  const result = await request({
    url: `/api/public/me/bookings/${id}/cancel`,
    method: "PATCH",
    token,
  });
  return store.mapBooking(result);
}

async function getBookingsByPhone(phone) {
  const result = await request({
    url: `/api/public/bookings?contactPhone=${encodeURIComponent(phone)}`,
  });

  return (result.items || []).map(store.mapBooking);
}

async function getBookingDetail(id, phone) {
  const result = await request({
    url: `/api/public/bookings/${id}?contactPhone=${encodeURIComponent(phone)}`,
  });

  return store.mapBooking(result);
}

async function getBookingInvitation(id, invitationToken) {
  return request({
    url: `/api/public/bookings/${id}/invitation?token=${encodeURIComponent(invitationToken)}`,
  });
}

async function cancelBooking(id, contactPhone) {
  const result = await request({
    url: `/api/public/bookings/${id}/cancel`,
    method: "PATCH",
    data: { contactPhone },
  });

  return store.mapBooking(result);
}

function requestBookingSubscription() {
  const tmplIds = (config.subscriptionTemplates && config.subscriptionTemplates.bookingStatus) || [];

  if (!tmplIds.length || !wx.requestSubscribeMessage) {
    return Promise.resolve({ acceptedTemplateId: "" });
  }

  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds,
      success(result) {
        const acceptedTemplateId =
          tmplIds.find((templateId) => result[templateId] === "accept") || "";
        resolve({ acceptedTemplateId });
      },
      fail() {
        resolve({ acceptedTemplateId: "" });
      },
    });
  });
}

async function merchantWxLogin(payload) {
  const result = await request({
    url: "/api/merchant/auth/wx-login",
    method: "POST",
    data: payload,
  });

  store.saveMerchantToken(result.token);
  return result;
}

async function getMerchantSession(token = store.getMerchantToken()) {
  return request({
    url: "/api/merchant/auth/me",
    token,
  });
}

async function getMerchantBookings(token = store.getMerchantToken()) {
  const result = await request({
    url: "/api/merchant/bookings",
    token,
  });

  return (result.items || []).map(store.mapBooking);
}

async function getMerchantRooms(token = store.getMerchantToken()) {
  const result = await request({
    url: "/api/merchant/rooms",
    token,
  });

  return (result.items || []).map(store.mapRoom);
}

async function createMerchantRoom(payload, token = store.getMerchantToken()) {
  const result = await request({
    url: "/api/merchant/rooms",
    method: "POST",
    data: payload,
    token,
  });

  return store.mapRoom(result);
}

async function updateMerchantRoom(id, payload, token = store.getMerchantToken()) {
  const result = await request({
    url: `/api/merchant/rooms/${id}`,
    method: "PATCH",
    data: payload,
    token,
  });

  return store.mapRoom(result);
}

async function updateMerchantBookingStatus(id, status, token = store.getMerchantToken()) {
  const result = await request({
    url: `/api/merchant/bookings/${id}/status`,
    method: "PATCH",
    data: { status },
    token,
  });

  return store.mapBooking(result);
}

async function merchantLogout(token = store.getMerchantToken()) {
  const result = await request({
    url: "/api/merchant/auth/logout",
    method: "POST",
    token,
  });

  store.clearMerchantToken();
  return result;
}

async function createMerchantApplication(payload) {
  return request({
    url: "/api/public/merchant-applications",
    method: "POST",
    data: payload,
  });
}

module.exports = {
  request,
  getLocation,
  getNearbyMerchants,
  getMerchantDetail,
  createBooking,
  userLogin,
  ensureUserLogin,
  getMyBookings,
  getMyBookingDetail,
  cancelMyBooking,
  getBookingsByPhone,
  getBookingDetail,
  getBookingInvitation,
  cancelBooking,
  requestBookingSubscription,
  merchantWxLogin,
  getMerchantSession,
  getMerchantBookings,
  getMerchantRooms,
  createMerchantRoom,
  updateMerchantRoom,
  updateMerchantBookingStatus,
  merchantLogout,
  createMerchantApplication,
};
