export function validateRequired(fields: string[], payload: Record<string, unknown>): string[] {
  return fields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
}

export function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function isMainlandMobile(value: unknown): boolean {
  return /^1\d{10}$/.test(normalizeText(value));
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isIsoDate(value: unknown): boolean {
  const text = normalizeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }

  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return text === [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isTimeOfDay(value: unknown): boolean {
  const text = normalizeText(value);
  if (!/^\d{2}:\d{2}$/.test(text)) {
    return false;
  }

  const [hour, minute] = text.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function todayString(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
