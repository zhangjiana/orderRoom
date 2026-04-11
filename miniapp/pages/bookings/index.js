const api = require("../../utils/api");
const store = require("../../utils/store");

Page({
  data: {
    phone: "",
    loading: false,
    searched: false,
    bookings: [],
  },

  onShow() {
    const phone = store.getLastPhone();
    this.setData({ phone });

    if (phone) {
      this.loadBookings(phone);
    }
  },

  handlePhone(event) {
    this.setData({
      phone: event.detail.value,
    });
  },

  async loadBookings(phone) {
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({
        title: "请输入正确手机号",
        icon: "none",
      });
      return;
    }

    try {
      this.setData({ loading: true });
      const bookings = await api.getBookingsByPhone(phone);

      this.setData({
        loading: false,
        searched: true,
        bookings,
      });
    } catch (_error) {
      this.setData({ loading: false });
      wx.showToast({
        title: "订单加载失败",
        icon: "none",
      });
    }
  },

  searchBookings() {
    this.loadBookings(this.data.phone.trim());
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
