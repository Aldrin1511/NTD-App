import { Button } from "@/components/ui/button";
import { SelectField, ChoiceRow, SectionCard, TextField, capitalizeName } from "@/components/Fields";
import PhoneField from "@/components/PhoneField";
import { PhotoCapture, FingerprintCapture, DocumentCapture, ageFromDob, dobFromAge } from "@/components/Capture";
import { GEO, REGISTERED_ATS, BLOOD_GROUPS } from "@/mock/data";
import { defaultPhoneCountryFromFacilities, digitsOnly, formatInternational, getPhoneMaxLength, parseStoredPhone } from "@/lib/phone";
import { Plus, Trash2 } from "lucide-react";

const registeredAtOptions = REGISTERED_ATS.map((h) => `${h.id} — ${h.name}`);

export const emptyAddress = (type = "By residency", province = "") => ({
  type,
  country: "Papua New Guinea",
  province,
  district: "",
  village: "",
});

export const emptyPatientForm = (user, facilities = []) => ({
  name: "",
  middleName: "",
  lastName: "",
  dob: "",
  age: "",
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
  addresses: [emptyAddress("By residency", user?.province || "")],
});

export const splitPatientName = (p) => {
  const first = String(p?.firstName || "").trim();
  const middle = String(p?.middleName || "").trim();
  const last = String(p?.lastName || "").trim();
  if (first || last) return { name: first || String(p?.name || "").split(/\s+/)[0] || "", middleName: middle, lastName: last };
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
        country: a.country || "Papua New Guinea",
        province: a.province || "",
        district: a.district || "",
        village: a.village || "",
      }))
    : [{
        type: p.addressType || "By residency",
        country: p.country || "Papua New Guinea",
        province: p.province || user?.province || "",
        district: p.district || "",
        village: p.village || "",
      }];
  const parsed = parseStoredPhone(
    p.phone,
    p.countryCode || p.phoneCountry,
    defaultPhoneCountryFromFacilities(user, facilities),
  );
  return {
    ...emptyPatientForm(user, facilities),
    ...names,
    dob: p.dob || dobFromAge(p.age, p.createdAt) || "",
    age: p.age ?? ageFromDob(p.dob || dobFromAge(p.age, p.createdAt)) ?? "",
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
  return {
    ...f,
    firstName: f.name,
    name: [f.name, f.middleName, f.lastName].filter(Boolean).join(" "),
    age: Number(f.age) || 0,
    sex: f.gender,
    gender: f.gender,
    phone: formatInternational(f.phoneCountry, f.phone),
    countryCode: f.phoneCountry,
    country: primary.country,
    province: primary.province,
    district: primary.district,
    village: primary.village,
    addressType: primary.type,
  };
};

export default function PatientForm({ f, setF, patientId, mode = "create" }) {
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const patchAddress = (index, changes) =>
    setF((s) => ({
      ...s,
      addresses: s.addresses.map((addr, i) => (i === index ? { ...addr, ...changes } : addr)),
    }));

  const addAddress = () =>
    setF((s) => {
      const hasOrigin = s.addresses.some((a) => a.type === "By origin");
      return {
        ...s,
        addresses: [...s.addresses, emptyAddress(hasOrigin ? "By residency" : "By origin", s.addresses[0]?.province || "")],
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
        desc={patientId ? `Patient ID ${patientId} is kept. Episode IDs are not changed.` : "Patient ID and episode ID are generated automatically"}
      >
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          {patientId && (
            <TextField label="Patient ID" testid="patient-id-display" value={patientId} readOnly disabled />
          )}
          <TextField label="First name" testid="patient-name-input" value={f.name} onChange={(e) => set("name")(capitalizeName(e.target.value))} placeholder="First name" autoCapitalize="words" />
          <TextField label="Middle name" testid="patient-middle-input" value={f.middleName} onChange={(e) => set("middleName")(capitalizeName(e.target.value))} autoCapitalize="words" />
          <TextField label="Last name" testid="patient-last-input" value={f.lastName} onChange={(e) => set("lastName")(capitalizeName(e.target.value))} autoCapitalize="words" />
          <TextField
            label="Date of birth"
            type="date"
            testid="patient-dob-input"
            value={f.dob}
            allowEmpty
            onChange={(e) => setF((s) => ({ ...s, dob: e.target.value, age: ageFromDob(e.target.value) }))}
            hint="Age is calculated automatically"
          />
          <TextField
            label="Age (years)"
            testid="patient-age-input"
            type="number"
            value={f.age}
            onChange={(e) => setF((s) => ({ ...s, age: e.target.value, dob: dobFromAge(e.target.value) }))}
            hint={mode === "edit" ? "Changing age updates the date of birth from today" : "Entering age fills the date of birth from today's registration date"}
          />
          <ChoiceRow label="Gender" options={["Male", "Female", "Other"]} value={f.gender} onChange={set("gender")} testid="patient-gender-select" />
          <PhoneField
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
            const districts = addr.province ? Object.keys(GEO[addr.province] || {}) : [];
            const villages = addr.province && addr.district ? GEO[addr.province]?.[addr.district] || [] : [];
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
                <div className="grid gap-5 sm:grid-cols-2">
                  <SelectField
                    label="Country"
                    options={["Papua New Guinea"]}
                    value={addr.country}
                    onChange={(v) => patchAddress(index, { country: v })}
                    testid={`patient-country-select-${index}`}
                  />
                  <SelectField
                    label="Province"
                    options={Object.keys(GEO)}
                    value={addr.province}
                    onChange={(v) => patchAddress(index, { province: v, district: "", village: "" })}
                    testid={`patient-province-select-${index}`}
                  />
                  <SelectField
                    label="District"
                    options={districts}
                    value={addr.district}
                    onChange={(v) => patchAddress(index, { district: v, village: "" })}
                    testid={`patient-district-select-${index}`}
                  />
                  <SelectField
                    label="Village / residence"
                    options={villages}
                    value={addr.village}
                    onChange={(v) => patchAddress(index, { village: v })}
                    testid={`patient-village-select-${index}`}
                  />
                </div>
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
