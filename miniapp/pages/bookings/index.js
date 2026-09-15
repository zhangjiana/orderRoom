const api = require("../../utils/api");

Page({
  data: {
    loading: false,
    searched: false,
    bookings: [],
    authenticated: false,
    errorMessage: "",
  },

  async onShow() {
    await this.loadMyBookings();
  },

  async loadMyBookings() {
    if (this.data.loading) return;
    this.setData({ loading: true, errorMessage: "", bookings: [], searched: false });
    try {
      await api.ensureUserLogin();
      this.setData({ authenticated: true });
      const bookings = await api.getMyBookings();
      this.setData({ bookings, searched: true });
    } catch (error) {
      this.setData({
        authenticated: false,
        errorMessage: error.message || "暂时无法加载订单，请重试",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  viewBooking(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/booking-detail/index?id=${id}&mode=account` });
  },

  openInvitation(event) {
    const { id } = event.currentTarget.dataset;
    const booking = this.data.bookings.find((item) => item.id === id);
    wx.navigateTo({
      url: `/pages/invitation/index?id=${id}&token=${encodeURIComponent(booking ? booking.invitationToken : "")}`,
    });
  },

  cancelBooking(event) {
    const { id } = event.currentTarget.dataset;

    wx.showModal({
      title: "取消预订",
      content: "确定取消这笔预订吗？取消后需要重新提交。",
      confirmText: "确认取消",
      confirmColor: "#b05b45",
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await api.cancelMyBooking(id);
          wx.showToast({ title: "预订已取消", icon: "success" });
          await this.loadMyBookings();
        } catch (error) {
          wx.showToast({ title: error.message || "取消失败", icon: "none" });
        }
      },
    });
  },

  openLocation(event) {
    const { latitude, longitude, name, address } = event.currentTarget.dataset;

    if (!latitude || !longitude) {
      return;
    }

    wx.openLocation({
      latitude: Number(latitude),
      longitude: Number(longitude),
      name,
      address,
      scale: 16,
    });
  },
});
