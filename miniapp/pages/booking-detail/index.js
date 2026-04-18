const api = require("../../utils/api");
const store = require("../../utils/store");

Page({
  data: {
    loading: true,
    booking: null,
    phone: "",
  },

  onLoad(options) {
    const phone = options.phone || store.getLastPhone();
    this.setData({ phone });

    if (!options.id) {
      this.setData({ loading: false });
      wx.showToast({ title: "缺少订单信息", icon: "none" });
      return;
    }

    this.loadBooking(options.id, phone);
  },

  async loadBooking(id, phone) {
    if (!/^1\d{10}$/.test(phone)) {
      this.setData({ loading: false });
      wx.showToast({ title: "手机号不正确", icon: "none" });
      return;
    }

    try {
      const booking = await api.getBookingDetail(id, phone);
      this.setData({ loading: false, booking });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || "订单加载失败", icon: "none" });
    }
  },

  openLocation() {
    const booking = this.data.booking;
    if (!booking || !booking.merchantLatitude || !booking.merchantLongitude) {
      return;
    }

    wx.openLocation({
      latitude: Number(booking.merchantLatitude),
      longitude: Number(booking.merchantLongitude),
      name: booking.merchantName,
      address: booking.merchantAddress,
      scale: 16,
    });
  },

  openInvitation() {
    const booking = this.data.booking;
    if (!booking) return;

    wx.navigateTo({
      url: `/pages/invitation/index?id=${booking.id}`,
    });
  },
});
