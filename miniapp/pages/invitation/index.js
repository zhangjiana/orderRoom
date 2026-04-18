const api = require("../../utils/api");

Page({
  data: {
    loading: true,
    invitation: null,
  },

  onLoad(options) {
    if (!options.id) {
      this.setData({ loading: false });
      wx.showToast({ title: "缺少邀请函信息", icon: "none" });
      return;
    }

    this.loadInvitation(options.id);
  },

  async loadInvitation(id) {
    try {
      const invitation = await api.getBookingInvitation(id);
      this.setData({ loading: false, invitation });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || "邀请函加载失败", icon: "none" });
    }
  },

  openLocation() {
    const invitation = this.data.invitation;
    if (!invitation || !invitation.merchantLatitude || !invitation.merchantLongitude) {
      return;
    }

    wx.openLocation({
      latitude: Number(invitation.merchantLatitude),
      longitude: Number(invitation.merchantLongitude),
      name: invitation.merchantName,
      address: invitation.merchantAddress,
      scale: 16,
    });
  },

  onShareAppMessage() {
    const invitation = this.data.invitation;
    return {
      title: invitation
        ? `${invitation.hostName} 邀请你参加${invitation.occasion || "宴请"}`
        : "宴请宾朋邀请函",
      path: invitation ? `/pages/invitation/index?id=${invitation.id}` : "/pages/rooms/index",
    };
  },
});
