const LAST_PHONE_KEY = "yanqing_last_phone";
const MERCHANT_TOKEN_KEY = "yanqing_merchant_token";

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getLastPhone() {
  return wx.getStorageSync(LAST_PHONE_KEY) || "";
}

function saveLastPhone(phone) {
  if (phone) {
    wx.setStorageSync(LAST_PHONE_KEY, phone);
  }
}

function getMerchantToken() {
  return wx.getStorageSync(MERCHANT_TOKEN_KEY) || "";
}

function saveMerchantToken(token) {
  if (token) {
    wx.setStorageSync(MERCHANT_TOKEN_KEY, token);
  }
}

function clearMerchantToken() {
  wx.removeStorageSync(MERCHANT_TOKEN_KEY);
}

function getBookingStatusClass(status) {
  const classMap = {
    待确认: "status-pending",
    已确认: "status-confirmed",
    已拒绝: "status-cancelled",
    已完成: "status-done",
    已取消: "status-cancelled",
  };

  return classMap[status] || "status-pending";
}

function mapRoom(room) {
  return {
    id: room.id,
    name: room.name,
    capacity: room.capacityMax,
    capacityMin: room.capacityMin,
    capacityMax: room.capacityMax,
    minSpend: room.minSpend,
    style: room.tags && room.tags.length ? room.tags[0] : "包间",
    floor: "店内包间",
    recommendedFor: room.description || "适合预订用餐",
    features: room.tags || [],
    status: room.status,
    level: room.status === "available" ? "available" : "warm",
    levelClass: room.status === "available" ? "status-available" : "status-warm",
    availability: room.status === "available" ? "可预订" : "需确认",
    nextBooking: "请以商家确认为准",
    activeCount: 0,
  };
}

function mapMerchant(merchant) {
  return {
    ...merchant,
    distanceText:
      merchant.distanceKm === null || merchant.distanceKm === undefined
        ? "待定位"
        : `${merchant.distanceKm} km`,
    roomSummary: `${merchant.roomCount || merchant.rooms.length} 个包间`,
    featuredTags:
      merchant.rooms && merchant.rooms.length
        ? Array.from(
            new Set(
              merchant.rooms
                .flatMap((room) => room.tags || [])
                .filter(Boolean),
            ),
          ).slice(0, 4)
        : [],
  };
}

function mapBooking(booking) {
  return {
    id: booking.id,
    merchantId: booking.merchantId,
    roomId: booking.roomId,
    roomName: booking.roomName,
    roomFloor: "店内包间",
    merchantName: booking.merchantName,
    merchantAddress: booking.merchantAddress,
    merchantLatitude: booking.merchantLatitude,
    merchantLongitude: booking.merchantLongitude,
    contactName: booking.contactName,
    phone: booking.contactPhone,
    date: booking.diningDate,
    time: booking.diningTime,
    guests: booking.guestCount,
    occasion: booking.occasion || "未填写",
    budget: booking.budget || booking.minSpend,
    remarks: booking.remarks,
    status: booking.statusLabel,
    rawStatus: booking.rawStatus || booking.status,
    statusClass: getBookingStatusClass(booking.statusLabel),
    estimateFee: booking.minSpend,
    createdAt: booking.createdAt,
  };
}

module.exports = {
  formatDate,
  getLastPhone,
  saveLastPhone,
  getMerchantToken,
  saveMerchantToken,
  clearMerchantToken,
  getBookingStatusClass,
  mapRoom,
  mapMerchant,
  mapBooking,
};
