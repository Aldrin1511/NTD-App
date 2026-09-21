import { COUNTRY_CODES, DEFAULT_COUNTRY } from "@/lib/countryCodes";

export { COUNTRY_CODES, DEFAULT_COUNTRY };

export const COUNTRY_PHONE_MAX_LENGTH = {
  1: 10,
  27: 9,
  33: 9,
  34: 9,
  39: 10,
  44: 10,
  49: 11,
  55: 11,
  60: 10,
  61: 9,
  62: 11,
  63: 10,
  64: 9,
  65: 8,
  66: 9,
  81: 10,
  82: 10,
  84: 10,
  86: 11,
  91: 10,
  92: 10,
  94: 9,
  95: 10,
  880: 10,
  966: 9,
  971: 9,
  977: 10,
  675: 8,
};

export const DEFAULT_PHONE_MAX_LENGTH = 15;

export function getPhoneMaxLength(countryDialCode) {
  if (countryDialCode == null || countryDialCode === "") return DEFAULT_PHONE_MAX_LENGTH;
  return COUNTRY_PHONE_MAX_LENGTH[String(countryDialCode)] ?? DEFAULT_PHONE_MAX_LENGTH;
}

export function flagEmoji(iso) {
  const s = String(iso || "").toLowerCase();
  if (!/^[a-z]{2}$/.test(s)) return "🏳️";
  return String.fromCodePoint(...[...s.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function resolveCountryCodeFromFacility(facilityCountryCode) {
  if (!facilityCountryCode) return DEFAULT_COUNTRY;

  if (typeof facilityCountryCode === "object") {
    const iso = facilityCountryCode.ISO?.toLowerCase();
    const code = String(facilityCountryCode.Code || "").replace(/^\+/, "");
    const name = facilityCountryCode.Country;
    return (
      COUNTRY_CODES.find((c) => iso && c.ISO === iso) ||
      COUNTRY_CODES.find((c) => code && c.Code === code) ||
      COUNTRY_CODES.find((c) => name && c.Country.toLowerCase() === String(name).toLowerCase()) ||
      DEFAULT_COUNTRY
    );
  }

  const raw = String(facilityCountryCode).trim();
  const withoutPlus = raw.replace(/^\+/, "");
  const iso = raw.toLowerCase();
  return (
    COUNTRY_CODES.find((c) => c.ISO === iso) ||
    COUNTRY_CODES.find((c) => c.Code === withoutPlus) ||
    COUNTRY_CODES.find((c) => c.Country.toLowerCase() === raw.toLowerCase()) ||
    DEFAULT_COUNTRY
  );
}

/** Default dial country from the user's facility (or the programme facility list), same as the webapp. */
export function defaultPhoneCountryFromFacilities(user, facilities = []) {
  const list = Array.isArray(facilities) ? facilities : [];
  const byUserFacility = user?.facility
    ? list.find((f) => f.name === user.facility || f.id === user.facility)
    : null;
  const byProvince = user?.province ? list.find((f) => f.province === user.province) : null;
  const countries = [...new Set(list.map((f) => f.country).filter(Boolean))];
  const uniqueCountry = countries.length === 1 ? countries[0] : null;
  const source = byUserFacility || byProvince || (uniqueCountry ? { country: uniqueCountry } : list[0]);
  return resolveCountryCodeFromFacility(source?.country);
}

const DIAL_CODES = [...COUNTRY_CODES]
  .map((c) => ({ ...c, digits: String(c.Code).replace(/\D/g, "") }))
  .filter((c) => c.digits)
  .sort((a, b) => b.digits.length - a.digits.length);

export function parseStoredPhone(phone, storedCountry, fallback = DEFAULT_COUNTRY) {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  const fromStored = storedCountry ? resolveCountryCodeFromFacility(storedCountry) : null;

  if (!digits) return { country: fromStored || fallback, national: "" };

  if (fromStored) {
    const codeDigits = String(fromStored.Code).replace(/\D/g, "");
    if (codeDigits && digits.startsWith(codeDigits) && digits.length > codeDigits.length) {
      return { country: fromStored, national: digits.slice(codeDigits.length) };
    }
    if (!raw.startsWith("+") && !raw.startsWith("00")) {
      return { country: fromStored, national: digits };
    }
  }

  if (raw.startsWith("+") || raw.startsWith("00")) {
    const match = DIAL_CODES.find((c) => digits.startsWith(c.digits) && digits.length > c.digits.length);
    if (match) return { country: match, national: digits.slice(match.digits.length) };
  }

  return { country: fromStored || fallback, national: digits };
}

export function formatInternational(country, national) {
  const digits = String(national || "").replace(/\D/g, "");
  if (!digits) return "";
  const code = String(country?.Code || DEFAULT_COUNTRY.Code).replace(/^\+/, "");
  return `+${code} ${digits}`;
}

export function digitsOnly(value, maxLen) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLen ?? DEFAULT_PHONE_MAX_LENGTH);
}
