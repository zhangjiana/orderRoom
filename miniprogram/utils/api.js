const store = require("./store");

function getBaseUrl() {
  const app = getApp();
  return app.globalData.apiBaseUrl;
}

function request({ url, method = "GET", data }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getBaseUrl()}${url}`,
      method,
      data,
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

async function createBooking(payload) {
  const result = await request({
    url: "/api/public/bookings",
    method: "POST",
    data: payload,
  });

  store.saveLastPhone(payload.contactPhone);
  return store.mapBooking(result);
}

async function getBookingsByPhone(phone) {
  const result = await request({
    url: `/api/public/bookings?contactPhone=${encodeURIComponent(phone)}`,
  });

  return (result.items || []).map(store.mapBooking);
}

module.exports = {
  request,
  getLocation,
  getNearbyMerchants,
  getMerchantDetail,
  createBooking,
  getBookingsByPhone,
};
