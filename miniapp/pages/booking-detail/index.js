const api = require("../../utils/api");

Page({
  data: {
    loading: true,
    booking: null,
    bookingId: "",
    errorMessage: "",
  },

  onLoad(options) {
    this.setData({ bookingId: options.id || "" });
  },

  onShow() {
    return this.loadBooking();
  },

  async loadBooking() {
    const id = this.data.bookingId;
    if (!id) {
      this.setData({ loading: false, errorMessage: "缺少订单信息" });
      return;
    }
    this.setData({ loading: true, booking: null, errorMessage: "" });
    try {
      await api.ensureUserLogin();
      const booking = await api.getMyBookingDetail(id);
      this.setData({ booking });
    } catch (error) {
      this.setData({ errorMessage: error.message || "订单加载失败，请重试" });
    } finally {
      this.setData({ loading: false });
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
      url: `/pages/invitation/index?id=${booking.id}&token=${encodeURIComponent(booking.invitationToken)}`,
    });
  },

  cancelBooking() {
    const booking = this.data.booking;
    if (!booking) return;

    wx.showModal({
      title: "取消预订",
      content: "确定取消这笔预订吗？",
      confirmText: "确认取消",
      confirmColor: "#b05b45",
      success: async (result) => {
        if (!result.confirm) return;
        try {
          const updated = await api.cancelMyBooking(booking.id);
          this.setData({ booking: updated });
          wx.showToast({ title: "预订已取消", icon: "success" });
        } catch (error) {
          wx.showToast({ title: error.message || "取消失败", icon: "none" });
        }
      },
    });
  },
});
