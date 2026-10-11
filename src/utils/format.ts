/** "urban_park" -> "Urban park" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  const text = value.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDate(iso)} · ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function formatPlace(p: { place_name: string | null; region: string | null; country: string | null }): string {
  const parts = [p.place_name, p.region, p.country].filter((x): x is string => !!x);
  return parts.length ? parts.join(", ") : "Unknown place";
}

export function percent(value: number | null | undefined): string {
  return value == null ? "–" : `${Math.round(value * 100)}%`;
}

export function num(value: number | null | undefined, unit: string, digits = 0): string {
  return value == null ? "–" : `${value.toFixed(digits)}${unit}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}
