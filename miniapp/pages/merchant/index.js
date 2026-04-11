const api = require("../../utils/api");

Page({
  data: {
    loading: true,
    merchant: null,
    markers: [],
    showMap: false,
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({
        title: "缺少商家信息",
        icon: "none",
      });
      return;
    }

    this.loadMerchant(options.id);
  },

  async loadMerchant(id) {
    try {
      const merchant = await api.getMerchantDetail(id);
      this.setData({
        merchant,
        markers: [
          {
            id: 1,
            latitude: merchant.latitude,
            longitude: merchant.longitude,
            title: merchant.name,
            width: 28,
            height: 28,
          },
        ],
        loading: false,
      });
    } catch (_error) {
      this.setData({ loading: false });
      wx.showToast({
        title: "商家详情加载失败",
        icon: "none",
      });
    }
  },

  toggleMap() {
    this.setData({ showMap: !this.data.showMap });
  },

  openLocation() {
    const { merchant } = this.data;

    if (!merchant) {
      return;
    }

    wx.openLocation({
      latitude: merchant.latitude,
      longitude: merchant.longitude,
      name: merchant.name,
      address: merchant.address,
      scale: 16,
    });
  },

  goReserve(event) {
    const { roomId } = event.currentTarget.dataset;
    const { merchant } = this.data;
    wx.navigateTo({
      url: `/pages/reserve/index?merchantId=${merchant.id}&roomId=${roomId}`,
    });
  },
});
