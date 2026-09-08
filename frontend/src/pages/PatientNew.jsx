import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { TextField, SelectField, ChoiceRow, SectionCard, AlertPanel } from "@/components/Fields";
import { PhotoCapture, FingerprintCapture, DocumentCapture, ageFromDob, dobFromAge } from "@/components/Capture";
import { GEO, HOUSEHOLDS, BLOOD_GROUPS } from "@/mock/data";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function PatientNew() {
  const { addPatient, user, facilities } = useStore();
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: "",
    middleName: "",
    lastName: "",
    dob: "",
    age: "",
    gender: "",
    weight: "",
    height: "",
    email: "",
    bloodGroup: "Unknown",
    photo: "",
    fingerprint: "",
    pregnancy: "N/A",
    lactating: "N/A",
    phone: "",
    province: user?.province || "",
    district: "",
    village: "",
    facility: "",
    household: "",
    consent: "By verbal",
    consentDoc: null,
    addressType: "By residency",
  });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const districts = f.province ? Object.keys(GEO[f.province] || {}) : [];
  const villages = f.province && f.district ? GEO[f.province]?.[f.district] || [] : [];
  const female = f.gender === "Female";

  const save = (thenEncounter) => {
    if (!f.name || !f.age || !f.gender) return toast.error("Name, age and gender are required");
    const rec = addPatient({ ...f, name: [f.name, f.middleName, f.lastName].filter(Boolean).join(" "), age: Number(f.age), weight: Number(f.weight) || 0, height: Number(f.height) || 0 });
    toast.success(`Patient ${rec.id} saved locally · queued for sync`);
    navigate(thenEncounter ? `/patients/${rec.id}/suspect` : `/patients/${rec.id}`);
  };

  return (
    <AppShell
      title="Quick registration"
      subtitle="Six essential fields first — everything else can be captured during the encounter"
      action={
        <Button variant="outline" className="h-12" data-testid="back-btn" onClick={() => navigate("/patients")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to patients
        </Button>
      }
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <SectionCard title="Patient identity" desc="Patient ID and Scabies Episode ID are generated automatically">
            <div className="grid min-w-0 gap-5 sm:grid-cols-2">
              <TextField label="First name" testid="patient-name-input" value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="First name" />
              <TextField label="Middle name" testid="patient-middle-input" value={f.middleName} onChange={(e) => set("middleName")(e.target.value)} />
              <TextField label="Last name" testid="patient-last-input" value={f.lastName} onChange={(e) => set("lastName")(e.target.value)} />
              <TextField
                label="Date of birth"
                type="date"
                testid="patient-dob-input"
                value={f.dob}
                onChange={(e) => setF((s) => ({ ...s, dob: e.target.value, age: ageFromDob(e.target.value) }))}
                hint="Age is calculated automatically"
              />
              <TextField
                label="Age (years)"
                testid="patient-age-input"
                type="number"
                value={f.age}
                onChange={(e) => setF((s) => ({ ...s, age: e.target.value, dob: dobFromAge(e.target.value) }))}
                hint="Entering age fills the date of birth from today's registration date"
              />
              <SelectField label="Gender" options={["Male", "Female", "Other"]} value={f.gender} onChange={set("gender")} testid="patient-gender-select" />
              {/* <TextField label="Weight (kg)" testid="patient-weight-input" type="number" value={f.weight} onChange={(e) => set("weight")(e.target.value)} hint="Used for ivermectin dose calculation" />
              <TextField label="Height (cm) — optional" testid="patient-height-input" type="number" value={f.height} onChange={(e) => set("height")(e.target.value)} /> */}
              <TextField label="Phone / contact" testid="patient-phone-input" value={f.phone} onChange={(e) => set("phone")(e.target.value)} />
              <TextField label="Email" type="email" testid="patient-email-input" value={f.email} onChange={(e) => set("email")(e.target.value)} placeholder="name@example.pg" />
              <SelectField label="Blood group" options={BLOOD_GROUPS} value={f.bloodGroup} onChange={set("bloodGroup")} testid="patient-blood-select" />
            </div>
            {female && (
              <div className="grid gap-5 sm:grid-cols-2">
                <ChoiceRow label="Pregnancy" options={["Yes", "No", "Unknown"]} value={f.pregnancy} onChange={set("pregnancy")} testid="patient-pregnancy" />
                <ChoiceRow label="Lactating" options={["Yes", "No"]} value={f.lactating} onChange={set("lactating")} testid="patient-lactating" />
              </div>
            )}
          </SectionCard>

          <SectionCard title="Location &amp; facility" desc="Drives the MIS geography filters">
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField label="Province" options={Object.keys(GEO)} value={f.province} onChange={(v) => setF({ ...f, province: v, district: "", village: "" })} testid="patient-province-select" />
              <SelectField label="District" options={districts} value={f.district} onChange={(v) => setF({ ...f, district: v, village: "" })} testid="patient-district-select" />
              <SelectField label="Village / residence" options={villages} value={f.village} onChange={set("village")} testid="patient-village-select" />
              <SelectField label="Facility (registration site)" options={facilities.map((x) => x.name)} value={f.facility} onChange={set("facility")} testid="patient-facility-select" />
              <SelectField label="Household" options={HOUSEHOLDS.map((h) => `${h.id} — ${h.name}`)} value={f.household} onChange={(v) => set("household")(v.split(" — ")[0])} testid="patient-household-select" hint="Links this patient to household contact tracing" />
            </div>
          </SectionCard>

          <SectionCard title="Consent">
            <ChoiceRow
              label="Did the patient / guardian consent to digital capture of information and treatment?"
              options={["No", "By paper", "By verbal"]}
              value={f.consent}
              onChange={(v) => setF((s) => ({ ...s, consent: v, consentDoc: v === "By paper" ? s.consentDoc : null }))}
              testid="patient-consent"
            />
            {f.consent === "By paper" && (
              <DocumentCapture
                label="Paper consent form"
                value={f.consentDoc}
                onChange={set("consentDoc")}
                testid="patient-consent-doc"
              />
            )}
            <ChoiceRow label="Address recorded" options={["By origin", "By residency"]} value={f.addressType} onChange={set("addressType")} testid="patient-address-type" />
          </SectionCard>

          <SectionCard title="Unique identification" desc="Photo and fingerprint template help identify returning patients in the field">
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

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <AlertPanel level="info" title="Offline-first" testid="offline-note">
            The record is written to the device immediately. It appears in your queue and uploads automatically when a
            connection is available.
          </AlertPanel>
          {Number(f.weight) > 0 && Number(f.weight) < 15 && (
            <AlertPanel level="urgent" title="🔴 Ivermectin contraindicated" testid="weight-alert">
              Weight under 15 kg — oral ivermectin safety is not established. Topical treatment pathway only.
            </AlertPanel>
          )}
          {f.pregnancy === "Yes" && (
            <AlertPanel level="urgent" title="🔴 Pregnancy flagged" testid="pregnancy-alert">
              Avoid oral ivermectin. Use permethrin 5% or sulfur ointment per national protocol.
            </AlertPanel>
          )}
          <div className="space-y-3 rounded-lg border border-border bg-white p-5">
            <Button className="h-12 w-full text-base" data-testid="save-and-encounter-btn" onClick={() => save(true)}>
              Save &amp; start suspect screening
            </Button>
            <Button variant="outline" className="h-12 w-full text-base" data-testid="save-patient-btn" onClick={() => save(false)}>
              Save patient only
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
