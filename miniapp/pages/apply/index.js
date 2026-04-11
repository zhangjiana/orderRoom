const api = require("../../utils/api");

const BUSINESS_HOURS_OPTIONS = [
  "10:00-14:00, 17:00-21:00",
  "10:00-22:00",
  "11:00-14:00, 17:00-21:30",
  "11:00-21:00",
];

Page({
  data: {
    submitting: false,
    submitted: false,
    businessHoursOptions: BUSINESS_HOURS_OPTIONS,
    businessHoursIndex: 0,
    form: {
      merchantName: "",
      applicantName: "",
      phone: "",
      address: "",
      province: "",
      city: "",
      district: "",
      latitude: 0,
      longitude: 0,
      businessHours: BUSINESS_HOURS_OPTIONS[0],
      contactPhone: "",
    },
  },

  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  handleBusinessHoursChange(event) {
    const index = Number(event.detail.value);
    this.setData({
      businessHoursIndex: index,
      "form.businessHours": BUSINESS_HOURS_OPTIONS[index],
    });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (result) => {
        this.setData({
          "form.address": result.address || result.name || "",
          "form.latitude": result.latitude,
          "form.longitude": result.longitude,
        });

        if (result.address) {
          this.parseAddress(result.address);
        }
      },
      fail() {
        wx.showToast({ title: "请允许使用定位", icon: "none" });
      },
    });
  },

  parseAddress(address) {
    const provinceMatch = address.match(/^(.+?[省市区])/);
    const cityMatch = address.match(/[省](.+?市)/);
    const districtMatch = address.match(/市(.+?[区县])/);

    if (provinceMatch) {
      this.setData({ "form.province": provinceMatch[1] });
    }
    if (cityMatch) {
      this.setData({ "form.city": cityMatch[1] });
    }
    if (districtMatch) {
      this.setData({ "form.district": districtMatch[1] });
    }
  },

  fillRegion(event) {
    const [province, city, district] = event.detail.value;
    this.setData({
      "form.province": province || "",
      "form.city": city || "",
      "form.district": district || "",
    });
  },

  async submitApplication() {
    const { form } = this.data;

    if (!form.merchantName.trim()) {
      wx.showToast({ title: "请填写商家名称", icon: "none" });
      return;
    }
    if (!form.applicantName.trim()) {
      wx.showToast({ title: "请填写申请人姓名", icon: "none" });
      return;
    }
    if (!/^1\d{10}$/.test(form.phone)) {
      wx.showToast({ title: "请填写正确手机号", icon: "none" });
      return;
    }
    if (!form.address.trim()) {
      wx.showToast({ title: "请选择门店地址", icon: "none" });
      return;
    }
    if (!form.contactPhone.trim()) {
      wx.showToast({ title: "请填写门店联系电话", icon: "none" });
      return;
    }

    if (!form.province || !form.city || !form.district) {
      wx.showToast({ title: "请选择省市区", icon: "none" });
      return;
    }

    this.setData({ submitting: true });

    try {
      await api.createMerchantApplication({
        merchantName: form.merchantName.trim(),
        applicantName: form.applicantName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        province: form.province,
        city: form.city,
        district: form.district,
        latitude: form.latitude,
        longitude: form.longitude,
        businessHours: form.businessHours,
        contactPhone: form.contactPhone.trim(),
      });

      this.setData({ submitting: false, submitted: true });
      wx.showToast({ title: "申请已提交", icon: "success" });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },
});
