const api = require("../../utils/api");

Page({
  data: {
    loading: true,
    locationLabel: "正在定位",
    locationMode: "guest",
    permissionHint: "不登录也可以先浏览商家和包间。",
    stats: {
      merchantCount: 0,
      nearbyCount: 0,
      roomCount: 0,
    },
    featuredMerchants: [],
    welcomeSteps: [
      {
        title: "先看看附近",
        desc: "首次进入不用登录，先浏览附近餐厅和包间。",
      },
      {
        title: "再决定预订",
        desc: "确认商家后再填写时间、人数和联系人。",
      },
      {
        title: "手机号只在下单时用",
        desc: "用于商家确认预订和你后续查询订单。",
      },
    ],
  },

  onShow() {
    this.loadHome();
  },

  async loadHome() {
    this.setData({ loading: true });

    try {
      const location = await api.getLocation().catch(() => null);
      const merchants = await api.getNearbyMerchants("", location);
      const roomCount = merchants.reduce((count, merchant) => count + (merchant.roomCount || 0), 0);

      this.setData({
        loading: false,
        locationLabel: location ? "已为你优先展示附近商家" : "未开启定位，当前展示全部已开通商家",
        locationMode: location ? "located" : "guest",
        permissionHint: location
          ? "你可以直接比较距离，挑离你更近的商家。"
          : "不开启定位也能用，只是无法按距离优先排序。",
        stats: {
          merchantCount: merchants.length,
          nearbyCount: merchants.filter((item) => item.distanceKm !== null).length,
          roomCount,
        },
        featuredMerchants: merchants.slice(0, 3),
      });
    } catch (_error) {
      this.setData({
        loading: false,
        locationLabel: "暂时没能加载商家数据",
        locationMode: "error",
        permissionHint: "可以稍后重试，或先检查后台服务是否已启动。",
      });
    }
  },

  goDiscover() {
    wx.switchTab({
      url: "/pages/rooms/index",
    });
  },

  openMerchant(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/merchant/index?id=${id}`,
    });
  },

  goBookings() {
    wx.switchTab({
      url: "/pages/bookings/index",
    });
  },
});
