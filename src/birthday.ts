// A birthday is stored as "YYYY-MM-DD", or "--MM-DD" when the year is not known (the vCard way of writing it).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface BirthdayParts {
  month: number;
  day: number;
  year: number | null;
}

/** Valid only if the month and day exist (Feb 30 is not a day). */
export function makeBirthday(month: number, day: number, year: number | null): string | null {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) return null;
  // With no year, Feb 29 is allowed (use a leap year); with a year, the day must exist in that exact year.
  const longest = new Date(year ?? 2000, month, 0).getDate();
  if (day > longest) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  if (year === null) return `--${mm}-${dd}`;
  if (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear()) return null;
  return `${String(year).padStart(4, "0")}-${mm}-${dd}`;
}

export function parseBirthday(b: string | null | undefined): BirthdayParts | null {
  if (!b) return null;
  const m = b.match(/^(?:(\d{4})-|--)(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: m[1] ? Number(m[1]) : null, month: Number(m[2]), day: Number(m[3]) };
}

/** "Mar 4" or "Mar 4, 1990". */
export function formatBirthday(b: string | null | undefined): string {
  const p = parseBirthday(b);
  if (!p) return "";
  return `${MONTHS[p.month - 1]} ${p.day}${p.year ? `, ${p.year}` : ""}`;
}
