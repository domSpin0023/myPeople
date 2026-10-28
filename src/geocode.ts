import type { PersonPlace, PlaceLevel, PlaceNode } from "./types";

/** A search result: a real place, before you give it a nickname. */
export type GeoResult = Omit<PersonPlace, "nickname">;

const CACHE_KEY = "mypeople.geocache.v1";

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  addresstype?: string;
  address?: Record<string, string>;
}

const COUNTRY_TYPES = ["country"];
const STATE_TYPES = ["state", "region", "province", "state_district", "county"];
const CITY_TYPES = ["city", "town", "village", "hamlet", "municipality", "suburb", "neighbourhood", "city_district", "borough", "quarter"];

const first = (a: Record<string, string>, keys: string[]) => keys.map((k) => a[k]).find(Boolean);

/** Turns one OpenStreetMap result into a nested place chain (country > state > city) and a precision. */
export function toResult(item: NominatimItem): GeoResult {
  const a = item.address ?? {};
  const type = item.addresstype ?? "";
  const precision: GeoResult["precision"] = COUNTRY_TYPES.includes(type)
    ? "country"
    : STATE_TYPES.includes(type)
      ? "state"
      : CITY_TYPES.includes(type)
        ? "city"
        : "address";
  const lead = item.display_name.split(",")[0].trim();

  const chain: PlaceNode[] = [];
  const country = a.country ?? (precision === "country" ? lead : undefined);
  if (country) chain.push({ level: "country", name: country });

  if (precision !== "country") {
    const state = first(a, ["state", "region", "province", "state_district"]) ?? (precision === "state" ? lead : undefined);
    if (state) chain.push({ level: "state", name: state });
  }

  if (precision === "city" || precision === "address") {
    let city = first(a, ["city", "town", "village", "hamlet", "municipality"]);
    if (!city && precision === "city") city = first(a, ["suburb", "neighbourhood", "city_district", "borough", "quarter"]) ?? lead;
    if (city) chain.push({ level: "city", name: city });
  }

  return { name: item.display_name, lat: parseFloat(item.lat), lon: parseFloat(item.lon), precision, chain };
}

function readCache(): Record<string, GeoResult[]> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, GeoResult[]>;
  } catch {
    return {};
  }
}

/**
 * Looks a place up on OpenStreetMap's Nominatim. Only the text you type is sent. Results are cached
 * so the same search never hits the server twice (Nominatim asks for light use).
 */
export async function searchPlaces(query: string): Promise<GeoResult[]> {
  const key = query.trim().toLowerCase();
  if (!key) return [];
  const cache = readCache();
  if (cache[key]) return cache[key];

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&accept-language=en&q=${encodeURIComponent(query.trim())}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const results = ((await res.json()) as NominatimItem[]).map(toResult);

  try {
    cache[key] = results;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // cache is only an optimization
  }
  return results;
}

export const PRECISION_LABEL: Record<PlaceLevel | "address", string> = {
  country: "Country",
  state: "State or region",
  city: "City",
  address: "Exact address",
};
