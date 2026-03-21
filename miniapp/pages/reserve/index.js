const api = require("../../utils/api");
const store = require("../../utils/store");

const OCCASIONS = ["商务宴请", "家庭聚餐", "生日聚会", "团队庆功", "朋友小聚"];

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return store.formatDate(date);
}

Page({
  data: {
    loading: true,
    occasions: OCCASIONS,
    merchant: null,
    rooms: [],
    suitableRooms: [],
    roomOptions: [],
    selectedRoomText: "",
    selectedRoom: null,
    roomIndex: 0,
    form: {
      merchantId: "",
      contactName: "",
      phone: "",
      date: tomorrow(),
      time: "18:30",
      guests: "8",
      roomId: "",
      occasion: OCCASIONS[0],
      budget: "",
      remarks: "",
    },
  },

  onLoad(options) {
    if (!options.merchantId) {
      wx.showToast({
        title: "缺少商家信息",
        icon: "none",
      });
      return;
    }

    this.loadMerchant(options.merchantId, options.roomId || "");
  },

  async loadMerchant(merchantId, preferredRoomId) {
    try {
      const merchant = await api.getMerchantDetail(merchantId);
      const rooms = merchant.rooms || [];
      const roomOptions = rooms.map((item) => `${item.name} · ${item.capacityMax}位 · ¥${item.minSpend}起`);
      const selectedIndex = Math.max(
        rooms.findIndex((item) => item.id === preferredRoomId),
        0,
      );

      this.setData({
        loading: false,
        merchant,
        rooms,
        roomOptions,
        suitableRooms: this.getSuitableRooms(Number(this.data.form.guests), rooms),
        roomIndex: selectedIndex,
        selectedRoom: rooms[selectedIndex] || null,
        selectedRoomText: roomOptions[selectedIndex] || "请选择包间",
        "form.merchantId": merchant.id,
        "form.roomId": rooms[selectedIndex] ? rooms[selectedIndex].id : "",
        "form.phone": store.getLastPhone(),
      });
    } catch (_error) {
      this.setData({ loading: false });
      wx.showToast({
        title: "加载预订信息失败",
        icon: "none",
      });
    }
  },

  getSuitableRooms(guestCount, rooms) {
    if (!guestCount) {
      return rooms.slice(0, 3);
    }

    const matched = rooms.filter((item) => item.capacityMax >= guestCount);
    return (matched.length ? matched : rooms).slice(0, 3);
  },

  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    const value = event.detail.value;

    this.setData({
      [`form.${field}`]: value,
    });

    if (field === "guests") {
      this.setData({
        suitableRooms: this.getSuitableRooms(Number(value), this.data.rooms),
      });
    }
  },

  chooseOccasion(event) {
    this.setData({
      "form.occasion": event.currentTarget.dataset.value,
    });
  },

  handleDateChange(event) {
    this.setData({
      "form.date": event.detail.value,
    });
  },

  handleTimeChange(event) {
    this.setData({
      "form.time": event.detail.value,
    });
  },

  handleRoomChange(event) {
    const roomIndex = Number(event.detail.value);
    const room = this.data.rooms[roomIndex];

    this.setData({
      roomIndex,
      selectedRoom: room || null,
      selectedRoomText: this.data.roomOptions[roomIndex] || "请选择包间",
      "form.roomId": room ? room.id : "",
    });
  },

  selectRecommendedRoom(event) {
    const roomIndex = this.data.rooms.findIndex((item) => item.id === event.currentTarget.dataset.roomId);

    if (roomIndex === -1) {
      return;
    }

    this.setData({
      roomIndex,
      selectedRoom: this.data.rooms[roomIndex],
      selectedRoomText: this.data.roomOptions[roomIndex] || "请选择包间",
      "form.roomId": this.data.rooms[roomIndex].id,
    });
  },

  async submitBooking() {
    const form = this.data.form;

    if (!form.contactName.trim()) {
      wx.showToast({ title: "请填写联系人", icon: "none" });
      return;
    }

    if (!/^1\d{10}$/.test(form.phone)) {
      wx.showToast({ title: "请填写正确手机号", icon: "none" });
      return;
    }

    if (!Number(form.guests)) {
      wx.showToast({ title: "请填写用餐人数", icon: "none" });
      return;
    }

    if (!form.roomId) {
      wx.showToast({ title: "请选择包间", icon: "none" });
      return;
    }

    try {
      await api.createBooking({
        merchantId: form.merchantId,
        roomId: form.roomId,
        diningDate: form.date,
        diningTime: form.time,
        guestCount: Number(form.guests),
        contactName: form.contactName,
        contactPhone: form.phone,
        occasion: form.occasion,
        budget: Number(form.budget || 0),
        remarks: form.remarks,
      });

      wx.showToast({
        title: "预订已提交",
        icon: "success",
      });

      setTimeout(() => {
        wx.switchTab({
          url: "/pages/bookings/index",
        });
      }, 500);
    } catch (error) {
      wx.showToast({
        title: error.message || "预订失败",
        icon: "none",
      });
    }
  },
});
