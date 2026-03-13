export function padTime(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateTime(input: Date | string | null | undefined): string {
  if (!input) {
    return "";
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return String(input);
  }

  return [
    date.getFullYear(),
    padTime(date.getMonth() + 1),
    padTime(date.getDate()),
  ].join("-") + ` ${padTime(date.getHours())}:${padTime(date.getMinutes())}:${padTime(date.getSeconds())}`;
}

export function formatDate(input: Date | string | null | undefined): string {
  if (!input) {
    return "";
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return String(input);
  }

  return `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}`;
}

export function formatTime(input: Date | string | null | undefined): string {
  if (!input) {
    return "";
  }

  if (typeof input === "string" && /^\d{2}:\d{2}/.test(input)) {
    return input.slice(0, 5);
  }

  const date = input instanceof Date ? input : new Date(`1970-01-01T${String(input)}`);
  if (Number.isNaN(date.getTime())) {
    return String(input).slice(0, 5);
  }

  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

export function nowString(): string {
  return formatDateTime(new Date());
}
