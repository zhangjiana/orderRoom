const api = require("../../utils/api");
const store = require("../../utils/store");

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待确认" },
  { key: "confirmed", label: "已确认" },
  { key: "rejected", label: "已拒绝" },
];

function loginWithWechat() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject,
    });
  });
}

function openConfirmModal(options) {
  return new Promise((resolve) => {
    wx.showModal({
      ...options,
      success: resolve,
      fail() {
        resolve({ confirm: false, cancel: true });
      },
    });
  });
}

Page({
  data: {
    authLoading: true,
    loggingIn: false,
    loadingBookings: false,
    actionLoading: "",
    loggedIn: false,
    token: "",
    merchant: null,
    staff: null,
    rooms: [],
    allBookings: [],
    bookings: [],
    filters: FILTERS,
    activeFilter: "all",
    loadingRooms: false,
    summary: {
      total: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
    },
    roomSummary: {
      total: 0,
      available: 0,
      paused: 0,
    },
  },

  onShow() {
    this.restoreSession();
  },

  onPullDownRefresh() {
    if (this.data.loggedIn && this.data.token) {
      Promise.all([
        this.loadBookings(this.data.token),
        this.loadRooms(this.data.token),
      ]).then(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      wx.stopPullDownRefresh();
    }
  },

  async restoreSession() {
    const token = store.getMerchantToken();
    if (!token) {
      this.resetMerchantState();
      return;
    }

    this.setData({ authLoading: true });

    try {
      const session = await api.getMerchantSession(token);
      this.setData({
        authLoading: false,
        loggedIn: true,
        token,
        merchant: session.merchant,
        staff: session.staff,
      });
      await Promise.all([
        this.loadBookings(token),
        this.loadRooms(token),
      ]);
    } catch (error) {
      this.resetMerchantState();
      wx.showToast({
        title: error.message || "商家登录已失效",
        icon: "none",
      });
    }
  },

  resetMerchantState() {
    store.clearMerchantToken();
    this.setData({
      authLoading: false,
      loggingIn: false,
      loadingBookings: false,
      actionLoading: "",
      loggedIn: false,
      token: "",
      merchant: null,
      staff: null,
      rooms: [],
      allBookings: [],
      bookings: [],
      activeFilter: "all",
      loadingRooms: false,
      summary: {
        total: 0,
        pending: 0,
        confirmed: 0,
        rejected: 0,
      },
      roomSummary: {
        total: 0,
        available: 0,
        paused: 0,
      },
    });
  },

  async handleMerchantLogin(event) {
    const phoneCode = event.detail.code;

    if (!phoneCode) {
      wx.showToast({
        title: "需要先授权手机号",
        icon: "none",
      });
      return;
    }

    this.setData({ loggingIn: true });

    try {
      const loginResult = await loginWithWechat();
      if (!loginResult.code) {
        throw new Error("微信登录失败");
      }

      const session = await api.merchantWxLogin({
        loginCode: loginResult.code,
        phoneCode,
      });

      this.setData({
        loggingIn: false,
        loggedIn: true,
        token: session.token,
        merchant: session.merchant,
        staff: session.staff,
      });

      await Promise.all([
        this.loadBookings(session.token),
        this.loadRooms(session.token),
      ]);
      wx.showToast({
        title: "商家登录成功",
        icon: "success",
      });
    } catch (error) {
      this.setData({ loggingIn: false });
      wx.showToast({
        title: error.message || "商家登录失败",
        icon: "none",
      });
    }
  },

  async loadBookings(token = this.data.token) {
    if (!token) {
      return;
    }

    this.setData({ loadingBookings: true });

    try {
      const bookings = await api.getMerchantBookings(token);
      const summary = {
        total: bookings.length,
        pending: bookings.filter((item) => item.rawStatus === "pending").length,
        confirmed: bookings.filter((item) => item.rawStatus === "confirmed").length,
        rejected: bookings.filter((item) => item.rawStatus === "rejected").length,
      };

      this.setData({
        loadingBookings: false,
        allBookings: bookings,
        summary,
      });
      this.applyFilter(this.data.activeFilter, bookings);
    } catch (error) {
      this.setData({ loadingBookings: false });
      wx.showToast({
        title: error.message || "订单加载失败",
        icon: "none",
      });
    }
  },

  applyFilter(filterKey, source = this.data.allBookings) {
    const bookings =
      filterKey === "all"
        ? source
        : source.filter((item) => item.rawStatus === filterKey);

    this.setData({
      activeFilter: filterKey,
      bookings,
    });
  },

  changeFilter(event) {
    this.applyFilter(event.currentTarget.dataset.filter);
  },

  async loadRooms(token = this.data.token) {
    if (!token) {
      return;
    }

    this.setData({ loadingRooms: true });

    try {
      const rooms = await api.getMerchantRooms(token);
      this.setData({
        loadingRooms: false,
        rooms,
        roomSummary: {
          total: rooms.length,
          available: rooms.filter((item) => item.level === "available").length,
          paused: rooms.filter((item) => item.level !== "available").length,
        },
      });
    } catch (error) {
      this.setData({ loadingRooms: false });
      wx.showToast({
        title: error.message || "包间加载失败",
        icon: "none",
      });
    }
  },

  goCreateRoom() {
    wx.navigateTo({
      url: "/pages/merchant-room-form/index",
    });
  },

  async toggleRoomStatus(event) {
    const { id, status } = event.currentTarget.dataset;
    const nextStatus = status === "available" ? "paused" : "available";

    try {
      await api.updateMerchantRoom(id, { status: nextStatus }, this.data.token);
      await this.loadRooms(this.data.token);
      wx.showToast({
        title: nextStatus === "available" ? "已上架" : "已下架",
        icon: "success",
      });
    } catch (error) {
      wx.showToast({
        title: error.message || "操作失败",
        icon: "none",
      });
    }
  },

  async updateStatus(event) {
    const { id, status } = event.currentTarget.dataset;
    const booking = this.data.allBookings.find((item) => item.id === id);

    if (!booking || booking.rawStatus !== "pending") {
      return;
    }

    const modal = await openConfirmModal({
      title: status === "confirmed" ? "确认订单" : "拒绝订单",
      content:
        status === "confirmed"
          ? `确认 ${booking.contactName} 的预订？`
          : `确认拒绝 ${booking.contactName} 的预订？`,
      confirmText: status === "confirmed" ? "确认" : "拒绝",
      confirmColor: status === "confirmed" ? "#9c6b36" : "#b54d32",
    });

    if (!modal.confirm) {
      return;
    }

    this.setData({ actionLoading: id });

    try {
      await api.updateMerchantBookingStatus(id, status, this.data.token);
      await this.loadBookings(this.data.token);
      wx.showToast({
        title: status === "confirmed" ? "已确认" : "已拒绝",
        icon: "success",
      });
    } catch (error) {
      wx.showToast({
        title: error.message || "处理失败",
        icon: "none",
      });
    } finally {
      this.setData({ actionLoading: "" });
    }
  },

  callCustomer(event) {
    wx.makePhoneCall({
      phoneNumber: event.currentTarget.dataset.phone,
    });
  },

  goApply() {
    wx.navigateTo({ url: "/pages/apply/index" });
  },

  async logout() {
    try {
      await api.merchantLogout(this.data.token);
    } catch (_error) {
      store.clearMerchantToken();
    }

    this.resetMerchantState();
  },
});
