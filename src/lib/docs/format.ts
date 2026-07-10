// Pure formatting helpers for the docs vault. No "use server" — used in both
// server (page/route) and client components.

/** Bytes -> human string, e.g. 184320 -> "180 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value < 10 && unitIndex > 0 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

const docDateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Amsterdam",
});

/** Date -> Dutch short date, e.g. "10 jul 2026". */
export function formatDocDate(date: Date): string {
  return docDateFormatter.format(date);
}
