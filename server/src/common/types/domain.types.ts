export type MerchantApplicationStatus = "pending" | "approved" | "rejected";
export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "completed";

export type AdminSessionAdmin = {
  id: string;
  username: string;
  displayName: string;
  role: string;
};
