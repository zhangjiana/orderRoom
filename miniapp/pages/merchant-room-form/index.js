const api = require("../../utils/api");

Page({
  data: {
    submitting: false,
    form: {
      name: "",
      capacityMin: "",
      capacityMax: "",
      minSpend: "",
      description: "",
      tags: "",
    },
  },

  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: event.detail.value,
    });
  },

  async submitRoom() {
    const form = this.data.form;
    const capacityMin = Number(form.capacityMin);
    const capacityMax = Number(form.capacityMax);
    const minSpend = Number(form.minSpend);

    if (!form.name.trim()) {
      wx.showToast({ title: "请填写包间名称", icon: "none" });
      return;
    }

    if (!Number.isInteger(capacityMin) || !Number.isInteger(capacityMax) || capacityMin < 1 || capacityMax < capacityMin) {
      wx.showToast({ title: "人数范围不正确", icon: "none" });
      return;
    }

    if (!Number.isInteger(minSpend) || minSpend < 0) {
      wx.showToast({ title: "最低消费不正确", icon: "none" });
      return;
    }

    this.setData({ submitting: true });

    try {
      await api.createMerchantRoom({
        name: form.name.trim(),
        capacityMin,
        capacityMax,
        minSpend,
        description: form.description.trim(),
        tags: form.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });

      wx.showToast({ title: "包间已创建", icon: "success" });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (error) {
      wx.showToast({ title: error.message || "创建失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
