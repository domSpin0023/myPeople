import { makeBirthday } from "./birthday";

/** One person offered for import, from any source. */
export interface Candidate {
  key: string;
  name: string;
  birthday: string | null;
  /** A data URL or an image address to make a thumbnail from. */
  photo: string | null;
}

/** Joins folded lines (and quoted-printable soft breaks) back into whole logical lines. */
function logicalLines(text: string): string[] {
  const raw = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    let line = raw[i];
    if (/QUOTED-PRINTABLE/i.test(line)) {
      while (line.endsWith("=") && i + 1 < raw.length) line = line.slice(0, -1) + raw[++i];
    }
    if (/^[ \t]/.test(line) && out.length > 0) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

function decodeQuotedPrintable(s: string): string {
  const bytes: number[] = [];
  const enc = new TextEncoder();
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...enc.encode(s[i]));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

const unescapeText = (s: string) => s.replace(/\\[nN]/g, " ").replace(/\\([,;\\])/g, "$1").trim();

/** Handles 19900304, 1990-03-04, --0304 and --03-04. Apple writes an unknown year as 1604. */
function parseBday(value: string, params: string[]): string | null {
  const s = value.trim().split("T")[0];
  let m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (m) {
    let year: number | null = Number(m[1]);
    if (year < 1700 || params.some((p) => p.startsWith("X-APPLE-OMIT-YEAR"))) year = null;
    return makeBirthday(Number(m[2]), Number(m[3]), year);
  }
  m = s.match(/^--(\d{2})-?(\d{2})$/);
  return m ? makeBirthday(Number(m[1]), Number(m[2]), null) : null;
}

function parsePhoto(params: string[], value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^data:image\//i.test(v) || /^https?:\/\//i.test(v)) return v;
  const encoded = params.some((p) => /^ENCODING=(B|BASE64)$/.test(p)) || params.includes("B") || params.includes("BASE64");
  if (!encoded) return null;
  const typeParam = params.find((p) => p.startsWith("TYPE=")) ?? params.find((p) => ["JPEG", "JPG", "PNG", "GIF"].includes(p)) ?? "JPEG";
  const type = typeParam.replace("TYPE=", "").toLowerCase().replace("jpg", "jpeg");
  return `data:image/${type};base64,${v.replace(/\s+/g, "")}`;
}

/** Reads a .vcf contacts file (vCard 2.1, 3.0 or 4.0) into people you can choose from. */
export function parseVCards(text: string): Candidate[] {
  const people: Candidate[] = [];
  let cur: { fn: string; n: string; birthday: string | null; photo: string | null } | null = null;

  for (const line of logicalLines(text)) {
    if (/^BEGIN:VCARD/i.test(line)) {
      cur = { fn: "", n: "", birthday: null, photo: null };
      continue;
    }
    if (/^END:VCARD/i.test(line)) {
      if (cur) {
        const name = cur.fn || cur.n;
        if (name) people.push({ key: "v:" + people.length, name, birthday: cur.birthday, photo: cur.photo });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon).split(";");
    const prop = head[0].replace(/^.*\./, "").toUpperCase(); // drop a group prefix like "item1."
    const params = head.slice(1).map((p) => p.toUpperCase());
    let value = line.slice(colon + 1);
    if (params.some((p) => p === "ENCODING=QUOTED-PRINTABLE")) value = decodeQuotedPrintable(value);

    if (prop === "FN") cur.fn = unescapeText(value);
    else if (prop === "N") {
      const [family = "", given = "", , prefix = ""] = value.split(";").map(unescapeText);
      cur.n = [prefix, given, family].filter(Boolean).join(" ").trim();
    } else if (prop === "BDAY" && !cur.birthday) cur.birthday = parseBday(value, params);
    else if (prop === "PHOTO" && !cur.photo) cur.photo = parsePhoto(params, value);
  }
  return people;
}
