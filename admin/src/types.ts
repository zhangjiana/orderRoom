export type MerchantApplicationStatus = "pending" | "approved" | "rejected";

export type MerchantApplication = {
  id: string;
  merchantName: string;
  applicantName: string;
  phone: string;
  address: string;
  province: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  businessHours: string;
  contactPhone: string;
  coverImage: string;
  status: MerchantApplicationStatus;
  createdAt: string;
  reviewedAt: string;
  reviewRemark: string;
};

export type Room = {
  id: string;
  merchantId: string;
  name: string;
  capacityMin: number;
  capacityMax: number;
  minSpend: number;
  description: string;
  tags: string[];
  status: string;
  createdAt: string;
};

export type Merchant = {
  id: string;
  applicationId: string;
  name: string;
  ownerName: string;
  phone: string;
  contactPhone: string;
  address: string;
  province: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  businessHours: string;
  status: string;
  createdAt: string;
  roomCount: number;
  rooms: Room[];
};

export type AdminDashboard = {
  summary: {
    totalApplications: number;
    pendingApplications: number;
    approvedApplications: number;
    activeMerchants: number;
    totalRooms: number;
  };
};

export type RoomFormState = {
  name: string;
  capacityMin: string;
  capacityMax: string;
  minSpend: string;
  description: string;
  tags: string;
};

export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "completed";

export type Booking = {
  id: string;
  merchantId: string;
  merchantName: string;
  merchantAddress: string;
  merchantLatitude: number | null;
  merchantLongitude: number | null;
  roomId: string;
  roomName: string;
  minSpend: number;
  diningDate: string;
  diningTime: string;
  guestCount: number;
  contactName: string;
  contactPhone: string;
  remarks: string;
  occasion: string;
  budget: number;
  status: BookingStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
};

export type AdminAuthResponse = {
  token: string;
  expiresAt: string;
  admin: AdminUser;
};
