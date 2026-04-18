export type BookingFilter = "all" | "pending" | "confirmed" | "rejected";

// --- Merchant ---

export type MerchantInfo = {
  id: string;
  name: string;
  address: string;
  contactPhone: string;
  businessHours: string;
};

export type MerchantStaff = {
  id: string;
  username: string;
  displayName: string;
  phone: string;
};

export type MerchantSession = {
  expiresAt: string;
  merchant: MerchantInfo;
  staff: MerchantStaff;
};

export type MerchantAuthResponse = MerchantSession & {
  token: string;
};

export type MerchantBooking = {
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
  rawStatus: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

// --- Admin ---

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
};

export type AdminSession = {
  admin: AdminUser;
  expiresAt: string;
};

export type AdminAuthResponse = AdminSession & {
  token: string;
};

export type AdminDashboard = {
  summary: {
    totalApplications: number;
    pendingApplications: number;
    approvedApplications: number;
    activeMerchants: number;
    totalRooms: number;
    totalBookings: number;
    pendingBookings: number;
  };
};

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
  status: string;
  createdAt: string;
  reviewedAt: string;
  reviewRemark: string;
  merchantStaff?: {
    username: string;
    phone: string;
    displayName: string;
    initialPassword?: string;
  };
};

export type AdminRoom = {
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

export type AdminMerchant = {
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
  rooms: AdminRoom[];
};
