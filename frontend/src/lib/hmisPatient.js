import { dobFromAgeYmd } from "@/components/Capture";
import { digitsOnly } from "@/lib/phone";

const BLOOD_GROUP_MAP = {
  Unknown: "Not known",
  "Not known": "Not known",
  "A+": "A+",
  "A-": "A-",
  "B+": "B+",
  "B-": "B-",
  "O+": "O+",
  "O-": "O-",
  "AB+": "AB+",
  "AB-": "AB-",
};

/** Digits-only phone for HMIS Joi `/^\+?\d{7,13}$/`. */
export function toHmisPhoneNumber(national) {
  return digitsOnly(national);
}

export function resolveDob(f) {
  if (f?.dob) return String(f.dob).slice(0, 10);
  return dobFromAgeYmd({ y: f?.ageY ?? f?.age, m: f?.ageM, d: f?.ageD }) || "";
}

export function buildDisplayName(f) {
  const first = String(f?.firstName || "").trim();
  const middle = String(f?.middleName || "").trim();
  const last = String(f?.lastName || "").trim();
  // Prefer explicit parts (firstName may be set by patientPayload; form uses `name` as given name)
  if (first || middle || last) {
    return [first, middle, last].filter(Boolean).join(" ");
  }
  return [f?.name, f?.middleName, f?.lastName]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(" ");
}

/** Resolve given / middle / family / display names without doubling displayName into firstName. */
export function resolveNameParts(f) {
  const middleName = String(f?.middleName || "").trim();
  const lastName = String(f?.lastName || "").trim();
  // Prefer explicit firstName; form field `name` is the given name when firstName is absent
  let firstName = String(f?.firstName || "").trim();
  if (!firstName) {
    firstName = String(f?.name || "").trim();
  }
  // If caller passed displayName as `name` AND firstName, ignore the display blob for firstName
  if (f?.firstName && f?.name && String(f.name).trim() !== firstName) {
    const joined = [firstName, middleName, lastName].filter(Boolean).join(" ");
    if (String(f.name).trim() === joined || String(f.name).includes(firstName)) {
      // keep firstName as-is
    }
  }
  // Guard: firstName accidentally contains middle+last (corrupted prior saves)
  if (firstName && (middleName || lastName) && /\s/.test(firstName)) {
    const suffix = [middleName, lastName].filter(Boolean).join(" ");
    if (suffix && firstName.endsWith(` ${suffix}`)) {
      firstName = firstName.slice(0, -(suffix.length + 1)).trim();
    } else {
      firstName = firstName.split(/\s+/)[0];
    }
  }
  const displayName =
    String(f?.displayName || "").trim() ||
    [firstName, middleName, lastName].filter(Boolean).join(" ") ||
    firstName;
  return { firstName, middleName, lastName, displayName };
}

export function mapBloodGroup(value) {
  if (!value) return undefined;
  return BLOOD_GROUP_MAP[value] || (BLOOD_GROUP_MAP[String(value)] ? BLOOD_GROUP_MAP[String(value)] : undefined);
}

/**
 * Map NTD PatientForm state → HMIS POST /patient body.
 * Only includes fields HMIS accepts; required: firstName, displayName, phoneNumber, gender, dob.
 */
export function mapNtdPatientToHmis(f) {
  const { firstName, middleName, lastName, displayName } = resolveNameParts(f);
  const phoneNumber = toHmisPhoneNumber(f?.phone);
  const dob = resolveDob(f);
  const gender = String(f?.gender || "").trim();
  const country = f?.phoneCountry;
  const bloodGroup = mapBloodGroup(f?.bloodGroup);
  const addresses = Array.isArray(f?.addresses)
    ? f.addresses
        .filter((a) => a && (a.country || a.province || a.district || a.village))
        .map((a) => ({
          type: a.type || "By residency",
          country: a.country || "",
          province: a.province || "",
          district: a.district || "",
          village: a.village || "",
        }))
    : [];

  const identifiableInformations = {
    firstName,
    displayName,
    phoneNumber,
  };
  if (middleName) identifiableInformations.middleName = middleName;
  if (lastName) identifiableInformations.lastName = lastName;
  if (f?.email) identifiableInformations.email = String(f.email).trim();
  if (f?.consent) identifiableInformations.consent = f.consent;
  if (f?.registeredAt) identifiableInformations.registeredAt = f.registeredAt;
  if (country?.Code != null) {
    identifiableInformations.countryCode = {
      Country: country.Country,
      Code: String(country.Code).replace(/^\+/, ""),
      ISO: country.ISO,
    };
  }

  const demographics = {
    gender,
    dob,
  };
  if (bloodGroup) demographics.bloodGroup = bloodGroup;
  if (addresses.length) demographics.addresses = addresses;

  return {
    patientDetails: {
      identifiableInformations,
      demographics,
      generalInformations: {},
    },
  };
}

/** Flat PatientDetails sections for HMIS PUT /patient/:id (Apex update shape). */
export function mapNtdPatientToHmisUpdate(f) {
  const { patientDetails } = mapNtdPatientToHmis(f);
  return patientDetails;
}

/** Client-side check before calling HMIS (mirrors Joi required fields). */
export function validateNtdForHmis(f) {
  const { firstName } = resolveNameParts(f);
  const phoneNumber = toHmisPhoneNumber(f?.phone);
  const dob = resolveDob(f);
  const gender = String(f?.gender || "").trim();

  if (!firstName) return "First name is required";
  if (!gender) return "Gender is required";
  if (!dob) return "Date of birth or age is required";
  if (!phoneNumber) return "Phone number is required";
  if (!/^\+?\d{7,13}$/.test(phoneNumber)) {
    return "Phone number must be 7–13 digits (no spaces)";
  }
  return null;
}
