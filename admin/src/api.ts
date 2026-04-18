import type {
  AdminAuthResponse,
  AdminSession,
  AdminDashboard,
  MerchantApplication,
  AdminRoom,
  AdminMerchant,
  MerchantAuthResponse,
  MerchantBooking,
  MerchantSession,
} from "./types";

const MERCHANT_TOKEN_KEY = "yanqing_merchant_web_token";
const ADMIN_TOKEN_KEY = "yanqing_admin_web_token";
const ROLE_KEY = "yanqing_web_role";
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

type RequestOptions = {
  method?: string;
  token?: string;
  data?: Record<string, unknown>;
};

function buildUrl(path: string) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.data ? JSON.stringify(options.data) : undefined,
  });

  const payload = await response
    .json()
    .catch(async () => ({ message: await response.text() }));

  if (!response.ok) {
    throw new Error(payload.message || "请求失败");
  }

  return payload as T;
}

// --- Role ---

export type WebRole = "admin" | "merchant";

export function getStoredRole(): WebRole {
  return (window.localStorage.getItem(ROLE_KEY) as WebRole) || "merchant";
}

export function setStoredRole(role: WebRole) {
  window.localStorage.setItem(ROLE_KEY, role);
}

// --- Merchant Auth ---

export function getMerchantToken() {
  return window.localStorage.getItem(MERCHANT_TOKEN_KEY) || "";
}

export function clearMerchantToken() {
  window.localStorage.removeItem(MERCHANT_TOKEN_KEY);
}

export async function merchantWebLogin(username: string, password: string) {
  const result = await request<MerchantAuthResponse>("/api/merchant/auth/web-login", {
    method: "POST",
    data: { username, password },
  });
  window.localStorage.setItem(MERCHANT_TOKEN_KEY, result.token);
  return result;
}

export async function loadMerchantSession(token: string) {
  return request<MerchantSession>("/api/merchant/auth/me", { token });
}

export async function logoutMerchant(token: string) {
  const result = await request<{ ok: boolean }>("/api/merchant/auth/logout", {
    method: "POST",
    token,
  });
  clearMerchantToken();
  return result;
}

export async function listMerchantBookings(token: string, status: string) {
  const suffix = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return request<{ items: MerchantBooking[] }>(`/api/merchant/bookings${suffix}`, { token });
}

export async function updateMerchantBookingStatus(
  token: string,
  bookingId: string,
  status: "confirmed" | "rejected",
) {
  return request<MerchantBooking>(`/api/merchant/bookings/${bookingId}/status`, {
    method: "PATCH",
    token,
    data: { status },
  });
}

export async function listMerchantRooms(token: string) {
  return request<{ items: AdminRoom[] }>("/api/merchant/rooms", { token });
}

export async function createMerchantRoom(token: string, data: Record<string, unknown>) {
  return request<AdminRoom>("/api/merchant/rooms", {
    method: "POST",
    token,
    data,
  });
}

export async function updateMerchantRoom(token: string, roomId: string, data: Record<string, unknown>) {
  return request<AdminRoom>(`/api/merchant/rooms/${roomId}`, {
    method: "PATCH",
    token,
    data,
  });
}

// --- Admin Auth ---

export function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

export function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function adminLogin(username: string, password: string) {
  const result = await request<AdminAuthResponse>("/api/admin/auth/login", {
    method: "POST",
    data: { username, password },
  });
  window.localStorage.setItem(ADMIN_TOKEN_KEY, result.token);
  return result;
}

export async function loadAdminSession(token: string) {
  return request<AdminSession>("/api/admin/auth/me", { token });
}

export async function logoutAdmin(token: string) {
  const result = await request<{ ok: boolean }>("/api/admin/auth/logout", {
    method: "POST",
    token,
  });
  clearAdminToken();
  return result;
}

// --- Admin Dashboard ---

export async function getAdminDashboard(token: string) {
  return request<AdminDashboard>("/api/admin/dashboard", { token });
}

// --- Admin Merchant Applications ---

export async function listApplications(token: string, status = "all") {
  const suffix = status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return request<{ items: MerchantApplication[] }>(`/api/admin/merchant-applications${suffix}`, { token });
}

export async function reviewApplication(
  token: string,
  id: string,
  status: "approved" | "rejected",
  reviewRemark = "",
) {
  return request<MerchantApplication>(`/api/admin/merchant-applications/${id}/status`, {
    method: "PATCH",
    token,
    data: { status, reviewRemark },
  });
}

// --- Admin Merchants ---

export async function listAdminMerchants(token: string) {
  return request<{ items: AdminMerchant[] }>("/api/admin/merchants", { token });
}

export async function getAdminMerchant(token: string, id: string) {
  return request<AdminMerchant>(`/api/admin/merchants/${id}`, { token });
}

export async function createRoom(
  token: string,
  merchantId: string,
  data: Record<string, unknown>,
) {
  return request<Record<string, unknown>>(`/api/admin/merchants/${merchantId}/rooms`, {
    method: "POST",
    token,
    data,
  });
}

// --- Admin Bookings ---

export async function listAdminBookings(token: string, status = "all", merchantId = "") {
  const params: string[] = [];
  if (status !== "all") params.push(`status=${encodeURIComponent(status)}`);
  if (merchantId) params.push(`merchantId=${encodeURIComponent(merchantId)}`);
  const suffix = params.length ? `?${params.join("&")}` : "";
  return request<{ items: MerchantBooking[] }>(`/api/admin/bookings${suffix}`, { token });
}

export async function updateAdminBookingStatus(
  token: string,
  bookingId: string,
  status: string,
) {
  return request<MerchantBooking>(`/api/admin/bookings/${bookingId}/status`, {
    method: "PATCH",
    token,
    data: { status },
  });
}
