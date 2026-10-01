import { localISODate } from "@/mock/specs";

/** YYYY-MM-DD from encounter / appointment date strings. */
export function visitDay(dateStr) {
  if (!dateStr) return "";
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return localISODate(d);
}

/** @returns {"past"|"today"|"future"|null} */
export function visitDateRelation(dateStr, today = localISODate()) {
  const day = visitDay(dateStr);
  if (!day) return null;
  if (day < today) return "past";
  if (day > today) return "future";
  return "today";
}
