export function validateRequired(fields: string[], payload: Record<string, unknown>): string[] {
  return fields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
}
