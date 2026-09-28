import { memo, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, ChoiceRow, SectionCard, TextField, capitalizeName } from "@/components/Fields";
import PhoneField from "@/components/PhoneField";
import { PhotoCapture, FingerprintCapture, DocumentCapture, ageYmdFromDob, dobFromAgeYmd, dobFromAge } from "@/components/Capture";
import { REGISTERED_ATS, BLOOD_GROUPS } from "@/mock/data";
import { defaultPhoneCountryFromFacilities, digitsOnly, formatInternational, getPhoneMaxLength, parseStoredPhone } from "@/lib/phone";
import { fetchGeoCountries, fetchGeoOptions } from "@/lib/hmisApi";
import { offlineGeoCountries, offlineGeoOptions } from "@/mock/specs";
import { Plus, Trash2 } from "lucide-react";

const registeredAtOptions = REGISTERED_ATS.map((h) => `${h.id} — ${h.name}`);
const DEFAULT_COUNTRY_NAME = "Papua New Guinea";

async function loadGeoCountries() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { list: offlineGeoCountries(), offline: true };
  }
  try {
    const list = await fetchGeoCountries();
    if (Array.isArray(list) && list.length) return { list, offline: false };
  } catch (_) {
    /* fall through */
  }
  return { list: offlineGeoCountries(), offline: true };
}

async function loadGeoOptions(type, parentId, hintName = "") {
  if (!parentId && type !== "Country") return [];
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return offlineGeoOptions(type, parentId, hintName);
  }
  // Parent is an offline-* id — use bundled tree even if online
  if (String(parentId).startsWith("offline-")) {
    return offlineGeoOptions(type, parentId, hintName);
  }
  try {
    const list = await fetchGeoOptions(type, parentId, "");
    if (Array.isArray(list) && list.length) return list;
  } catch (_) {
    /* fall through */
  }
  return offlineGeoOptions(type, parentId, hintName);
}

/** Select options keyed by stable geo id (value), labeled by name (viewValue). */
const geoSelectOptions = (opts) => {
  const seen = new Set();
  const out = [];
  for (const o of Array.isArray(opts) ? opts : []) {
    if (!o?.value || seen.has(o.value)) continue;
    seen.add(o.value);
    out.push({ value: o.value, label: o.viewValue });
  }
  return out;
};
const findOpt = (opts, nameOrId) => {
  if (!nameOrId || !Array.isArray(opts)) return null;
  return opts.find((o) => o.viewValue === nameOrId || o.value === nameOrId) || null;
};
/** Prefer exact Papua New Guinea match (case-insensitive). */
const findPapuaNewGuinea = (opts) => {
  const list = Array.isArray(opts) ? opts : [];
  return (
    list.find((o) => String(o.viewValue || "").toLowerCase() === "papua new guinea") ||
    list.find((o) => /papua\s*new\s*guinea/i.test(String(o.viewValue || ""))) ||
    null
  );
};

export const emptyAddress = (type = "By residency") => ({
  type,
  country: DEFAULT_COUNTRY_NAME,
  countryId: "",
  province: "",
  provinceId: "",
  district: "",
  districtId: "",
  village: "",
  villageId: "",
});

export const emptyPatientForm = (user, facilities = []) => ({
  name: "",
  middleName: "",
  lastName: "",
  dob: "",
  age: "",
  ageY: "",
  ageM: "",
  ageD: "",
  gender: "",
  email: "",
  bloodGroup: "Unknown",
  photo: "",
  fingerprint: {},
  pregnancy: "N/A",
  lactating: "N/A",
  phone: "",
  phoneCountry: defaultPhoneCountryFromFacilities(user, facilities),
  facility: "",
  registeredAt: "",
  consent: "By verbal",
  consentDoc: null,
  addresses: [emptyAddress("By residency")],
});

export const splitPatientName = (p) => {
  let first = String(p?.firstName || "").trim();
  let middle = String(p?.middleName || "").trim();
  let last = String(p?.lastName || "").trim();
  // Repair corrupted rows where firstName already includes middle+last
  if (first && (middle || last) && /\s/.test(first)) {
    const suffix = [middle, last].filter(Boolean).join(" ");
    if (suffix && first.endsWith(` ${suffix}`)) {
      first = first.slice(0, -(suffix.length + 1)).trim();
    } else {
      first = first.split(/\s+/)[0];
    }
  }
  if (first || last) {
    return {
      name: first || String(p?.name || "").split(/\s+/)[0] || "",
      middleName: middle,
      lastName: last,
    };
  }
  const parts = String(p?.name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { name: "", middleName: "", lastName: "" };
  if (parts.length === 1) return { name: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { name: parts[0], middleName: "", lastName: parts[1] };
  return { name: parts[0], middleName: parts.slice(1, -1).join(" "), lastName: parts[parts.length - 1] };
};

export const formFromPatient = (p, user, facilities = []) => {
  const names = splitPatientName(p);
  const addresses = Array.isArray(p.addresses) && p.addresses.length
    ? p.addresses.map((a) => ({
        type: a.type || "By residency",
        country: a.country || "",
        countryId: a.countryId || "",
        province: a.province || "",
        provinceId: a.provinceId || "",
        district: a.district || "",
        districtId: a.districtId || "",
        village: a.village || "",
        villageId: a.villageId || "",
      }))
    : [{
        ...emptyAddress(p.addressType || "By residency"),
        country: p.country || "",
        province: p.province || user?.province || "",
        district: p.district || "",
        village: p.village || "",
      }];
  const parsed = parseStoredPhone(
    p.phone,
    p.countryCode || p.phoneCountry,
    defaultPhoneCountryFromFacilities(user, facilities),
  );
  const dob = p.dob || dobFromAge(p.age, p.createdAt) || "";
  const ymd = ageYmdFromDob(dob);
  const ageY = p.ageY != null && p.ageY !== ""
    ? String(p.ageY)
    : (ymd.y !== "" ? ymd.y : (p.age != null && p.age !== "" ? String(p.age) : ""));
  const ageM = p.ageM != null && p.ageM !== "" ? String(p.ageM) : ymd.m;
  const ageD = p.ageD != null && p.ageD !== "" ? String(p.ageD) : ymd.d;
  return {
    ...emptyPatientForm(user, facilities),
    ...names,
    dob,
    age: ageY,
    ageY,
    ageM,
    ageD,
    gender: p.gender || p.sex || "",
    email: p.email || "",
    bloodGroup: p.bloodGroup || "Unknown",
    photo: p.photo || "",
    fingerprint: p.fingerprint || {},
    pregnancy: p.pregnancy || "N/A",
    lactating: p.lactating || "N/A",
    phone: parsed.national,
    phoneCountry: parsed.country,
    facility: p.facility || "",
    registeredAt: p.registeredAt || "",
    consent: p.consent || "By verbal",
    consentDoc: p.consentDoc || null,
    addresses,
  };
};

export const patientPayload = (f) => {
  const primary = f.addresses[0] || emptyAddress();
  const ageY = f.ageY !== "" && f.ageY != null ? f.ageY : f.age;
  const dob =
    f.dob ||
    dobFromAgeYmd({
      y: ageY,
      m: f.ageM,
      d: f.ageD,
    });
  const firstName = String(f.name || "").trim();
  const middleName = String(f.middleName || "").trim();
  const lastName = String(f.lastName || "").trim();
  const displayName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  return {
    ...f,
    // Keep `name` as given/first name for HMIS mapping; use displayName for full label
    name: firstName,
    firstName,
    middleName,
    lastName,
    displayName,
    dob,
    age: Number(ageY) || 0,
    ageY: ageY !== "" && ageY != null ? String(ageY) : "",
    ageM: f.ageM !== "" && f.ageM != null ? String(f.ageM) : "",
    ageD: f.ageD !== "" && f.ageD != null ? String(f.ageD) : "",
    sex: f.gender,
    gender: f.gender,
    phone: formatInternational(f.phoneCountry, f.phone),
    phoneNational: digitsOnly(f.phone),
    countryCode: f.phoneCountry,
    country: primary.country,
    province: primary.province,
    district: primary.district,
    village: primary.village,
    addressType: primary.type,
  };
};

export { mapNtdPatientToHmis, validateNtdForHmis } from "@/lib/hmisPatient";

/** One address row with cascading country → province → district → village from portal-be/HMIS.
 * Memoized so typing identity fields does not re-render 250+ country select items. */
const AddressGeoFields = memo(function AddressGeoFields({ addr, index, onPatch }) {
  const [countries, setCountries] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [geoError, setGeoError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { list, offline } = await loadGeoCountries();
        if (cancelled) return;
        setCountries(list);
        setGeoError(offline ? "Using offline geography (connect to refresh from HMIS)" : "");

        // Default country only: Papua New Guinea — leave province/district/village empty for the user
        if (!addr.countryId) {
          const preferPng = !addr.country || /papua\s*new\s*guinea/i.test(addr.country);
          const match = preferPng
            ? findPapuaNewGuinea(list) || findOpt(list, addr.country || DEFAULT_COUNTRY_NAME)
            : findOpt(list, addr.country);
          if (match) {
            onPatch(index, {
              country: match.viewValue,
              countryId: match.value,
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          const list = offlineGeoCountries();
          setCountries(list);
          setGeoError(err?.message || "Failed to load countries — using offline list");
          if (!addr.countryId) {
            const match = findPapuaNewGuinea(list);
            if (match) {
              onPatch(index, { country: match.viewValue, countryId: match.value });
            }
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!addr.countryId) {
        setProvinces([]);
        return;
      }
      try {
        const list = await loadGeoOptions("Province", addr.countryId, addr.country);
        if (cancelled) return;
        setProvinces(list);
        if (addr.province && !addr.provinceId) {
          const match = findOpt(list, addr.province);
          if (match) onPatch(index, { provinceId: match.value });
        }
      } catch (_) {
        if (!cancelled) setProvinces(offlineGeoOptions("Province", addr.countryId, addr.country));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr.countryId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!addr.provinceId) {
        setDistricts([]);
        return;
      }
      try {
        const list = await loadGeoOptions("District", addr.provinceId, addr.province);
        if (cancelled) return;
        setDistricts(list);
        if (addr.district && !addr.districtId) {
          const match = findOpt(list, addr.district);
          if (match) onPatch(index, { districtId: match.value });
        }
      } catch (_) {
        if (!cancelled) setDistricts(offlineGeoOptions("District", addr.provinceId, addr.province));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr.provinceId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!addr.districtId) {
        setVillages([]);
        return;
      }
      try {
        const list = await loadGeoOptions("Village", addr.districtId, addr.district);
        if (cancelled) return;
        setVillages(list);
        if (addr.village && !addr.villageId) {
          const match = findOpt(list, addr.village);
          if (match) onPatch(index, { villageId: match.value });
        }
      } catch (_) {
        if (!cancelled) setVillages(offlineGeoOptions("Village", addr.districtId, addr.district));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr.districtId]);

  const selectCountry = (id) => {
    const opt = findOpt(countries, id);
    onPatch(index, {
      country: opt?.viewValue || "",
      countryId: id,
      province: "",
      provinceId: "",
      district: "",
      districtId: "",
      village: "",
      villageId: "",
    });
  };
  const selectProvince = (id) => {
    const opt = findOpt(provinces, id);
    onPatch(index, {
      province: opt?.viewValue || "",
      provinceId: id,
      district: "",
      districtId: "",
      village: "",
      villageId: "",
    });
  };
  const selectDistrict = (id) => {
    const opt = findOpt(districts, id);
    onPatch(index, {
      district: opt?.viewValue || "",
      districtId: id,
      village: "",
      villageId: "",
    });
  };
  const selectVillage = (id) => {
    const opt = findOpt(villages, id);
    onPatch(index, {
      village: opt?.viewValue || "",
      villageId: id,
    });
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {geoError ? (
        <p className={`sm:col-span-2 text-xs ${/offline/i.test(geoError) ? "text-muted-foreground" : "text-destructive"}`}>
          {geoError}
        </p>
      ) : null}
      <SelectField
        label="Country"
        options={geoSelectOptions(countries)}
        value={addr.countryId}
        onChange={selectCountry}
        testid={`patient-country-select-${index}`}
        required
      />
      <SelectField
        label="Province"
        options={geoSelectOptions(provinces)}
        value={addr.provinceId}
        onChange={selectProvince}
        testid={`patient-province-select-${index}`}
        required
        placeholder={addr.countryId ? "Select…" : "Select country first"}
      />
      <SelectField
        label="District"
        options={geoSelectOptions(districts)}
        value={addr.districtId}
        onChange={selectDistrict}
        testid={`patient-district-select-${index}`}
        required
        placeholder={addr.provinceId ? "Select…" : "Select province first"}
      />
      <SelectField
        label="Village / residence"
        options={geoSelectOptions(villages)}
        value={addr.villageId}
        onChange={selectVillage}
        testid={`patient-village-select-${index}`}
        required
        placeholder={addr.districtId ? "Select…" : "Select district first"}
      />
    </div>
  );
});

export default function PatientForm({ f, setF, patientId, patientCode, mode = "create" }) {
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const displayPid = patientCode || "";

  const setDob = (dob) => {
    const parts = ageYmdFromDob(dob);
    setF((s) => ({
      ...s,
      dob,
      ageY: parts.y,
      ageM: parts.m,
      ageD: parts.d,
      age: parts.y,
    }));
  };

  const setAgePart = (part) => (value) => {
    setF((s) => {
      const next = { ...s, [part]: value };
      if (part === "ageY") next.age = value;
      next.dob = dobFromAgeYmd({ y: next.ageY, m: next.ageM, d: next.ageD });
      return next;
    });
  };

  const patchAddress = useCallback(
    (index, changes) =>
      setF((s) => ({
        ...s,
        addresses: s.addresses.map((addr, i) => (i === index ? { ...addr, ...changes } : addr)),
      })),
    [setF]
  );

  const addAddress = () =>
    setF((s) => {
      const hasOrigin = s.addresses.some((a) => a.type === "By origin");
      return {
        ...s,
        addresses: [...s.addresses, emptyAddress(hasOrigin ? "By residency" : "By origin")],
      };
    });

  const removeAddress = (index) =>
    setF((s) => ({
      ...s,
      addresses: s.addresses.filter((_, i) => i !== index),
    }));

  const registeredAtDisplay =
    registeredAtOptions.find((o) => o.startsWith(`${f.registeredAt} —`)) || "";

  return (
    <div className="min-w-0 space-y-6">
      <SectionCard
        title="Patient identity"
        desc={displayPid ? `PID ${displayPid} is kept. Episode IDs are not changed.` : "Patient ID and episode ID are generated automatically"}
      >
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          {displayPid && (
            <TextField label="Patient ID" testid="patient-id-display" value={`PID ${displayPid}`} readOnly disabled />
          )}
          <TextField label="First name" testid="patient-name-input" value={f.name} onChange={(e) => set("name")(capitalizeName(e.target.value))} placeholder="First name" autoCapitalize="words" required />
          <TextField label="Middle name" testid="patient-middle-input" value={f.middleName} onChange={(e) => set("middleName")(capitalizeName(e.target.value))} autoCapitalize="words" />
          <TextField label="Last name" testid="patient-last-input" value={f.lastName} onChange={(e) => set("lastName")(capitalizeName(e.target.value))} autoCapitalize="words" />
          <TextField
            label="Date of birth"
            type="date"
            testid="patient-dob-input"
            value={f.dob}
            allowEmpty
            onChange={(e) => setDob(e.target.value)}
            hint="Age is calculated automatically"
            required
          />
          <div>
            <p className="mb-2 text-xs font-semibold text-emerald-600">Age *</p>
            <div className="grid grid-cols-3 gap-2">
              <TextField
                placeholder="YY"
                type="number"
                testid="patient-age-y"
                value={f.ageY}
                onChange={(e) => setAgePart("ageY")(e.target.value)}
              />
              <TextField
                placeholder="MM"
                type="number"
                testid="patient-age-m"
                value={f.ageM}
                onChange={(e) => setAgePart("ageM")(e.target.value)}
              />
              <TextField
                placeholder="DD"
                type="number"
                testid="patient-age-d"
                value={f.ageD}
                onChange={(e) => setAgePart("ageD")(e.target.value)}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {mode === "edit"
                ? "Changing age updates the date of birth from today"
                : "Entering age fills the date of birth from today's registration date"}
            </p>
          </div>
          <ChoiceRow label="Gender" options={["Male", "Female", "Other"]} value={f.gender} onChange={set("gender")} testid="patient-gender-select" required />
          <PhoneField
            label="Phone / contact"
            country={f.phoneCountry}
            national={f.phone}
            onCountryChange={(c) =>
              setF((s) => ({
                ...s,
                phoneCountry: c,
                phone: digitsOnly(s.phone, getPhoneMaxLength(c.Code)),
              }))
            }
            onNationalChange={set("phone")}
            testid="patient-phone"
            hint="Required — stored in HMIS with your facility"
            required
          />
          <TextField label="Email" type="email" testid="patient-email-input" value={f.email} onChange={(e) => set("email")(e.target.value)} />
          <div className="sm:col-span-2">
            <ChoiceRow label="Blood group" options={BLOOD_GROUPS} value={f.bloodGroup} onChange={set("bloodGroup")} testid="patient-blood-select" />
          </div>
          <div className="sm:col-span-2">
            <SelectField
              label="Registered at"
              options={registeredAtOptions}
              value={registeredAtDisplay}
              onChange={(v) => set("registeredAt")(v.split(" — ")[0])}
              testid="patient-registeredAt-select"
              hint="Links this patient to registeredAt contact tracing"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Location" desc="Drives the MIS geography filters">
        <div className="space-y-4">
          {f.addresses.map((addr, index) => {
            return (
              <div
                key={index}
                className="space-y-4 rounded-md border border-border p-4"
                data-testid={`patient-address-${index}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Address {index + 1}
                  </p>
                  {f.addresses.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-2 text-muted-foreground"
                      data-testid={`patient-address-remove-${index}`}
                      onClick={() => removeAddress(index)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
                <ChoiceRow
                  label="Address recorded"
                  options={["By origin", "By residency"]}
                  value={addr.type}
                  onChange={(v) => patchAddress(index, { type: v })}
                  testid={`patient-address-type-${index}`}
                />
                <AddressGeoFields
                  addr={addr}
                  index={index}
                  onPatch={patchAddress}
                />
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full text-base"
            data-testid="patient-address-add"
            onClick={addAddress}
          >
            <Plus className="mr-2 h-4 w-4" /> Add address
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Consent">
        <ChoiceRow
          label="Did the patient / guardian consent to digital capture of information and treatment?"
          options={["No", "In writing", "By verbal"]}
          value={f.consent}
          onChange={(v) => setF((s) => ({ ...s, consent: v, consentDoc: v === "In writing" ? s.consentDoc : null }))}
          testid="patient-consent"
        />
        {f.consent === "In writing" && (
          <DocumentCapture
            label="Written consent form"
            value={f.consentDoc}
            onChange={set("consentDoc")}
            testid="patient-consent-doc"
          />
        )}
      </SectionCard>

      <SectionCard title="Unique identification" desc="Photo and up to 10 fingerprint templates help identify returning patients in the field">
        <PhotoCapture
          label="Patient photo"
          photos={f.photo ? [f.photo] : []}
          onChange={(ph) => set("photo")(ph[0] || "")}
          testid="patient-photo"
          max={1}
        />
        <FingerprintCapture value={f.fingerprint} onChange={set("fingerprint")} />
      </SectionCard>
    </div>
  );
}
