const api = require("../../utils/api");

Page({
  data: {
    keyword: "",
    merchants: [],
    loading: true,
    location: null,
  },

  onShow() {
    this.loadMerchants();
  },

  async loadMerchants(keyword = this.data.keyword) {
    this.setData({ loading: true });

    try {
      const location = await api.getLocation().catch(() => null);
      const merchants = await api.getNearbyMerchants(keyword, location);

      this.setData({
        merchants,
        location,
        loading: false,
      });
    } catch (_error) {
      this.setData({ loading: false });
      wx.showToast({
        title: "商家加载失败",
        icon: "none",
      });
    }
  },

  handleKeyword(event) {
    this.setData({
      keyword: event.detail.value,
    });
  },

  searchMerchants() {
    this.loadMerchants(this.data.keyword.trim());
  },

  openMerchant(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/merchant/index?id=${id}`,
    });
  },
});
