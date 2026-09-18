import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TextField, ChoiceRow, CheckGrid, capitalizeName } from "@/components/Fields";
import { PhotoCapture, ageYmdFromDob, dobFromAgeYmd } from "@/components/Capture";
import { DosePhysicalBox } from "@/components/MedicationShared";
import { formatDosePhysical, physicalUnits } from "@/lib/medications";
import { fmtDate, localISODate } from "@/mock/specs";
import { useStore } from "@/store";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Eye } from "lucide-react";

const LEPROSY_RELATIONSHIPS = [
  "Spouse", "Child", "Sibling", "Parents", "Relative", "HouseHold Member", "Neighbour", "Social",
];

const SYMPTOMS = [
  "Skin Patches or Nodules",
  "Sensory loss on hands or feet",
  "Nerve Involvement (Feel enlarged when palpated)",
  "Claw Hands/Toes",
  "Wrist / Foot Drop",
  "Signs of reaction (Inflammation on skin - redness, swelling, heat, pain, loss of function)",
  "Ulcer (On hands or feet)",
  "Eye Involvement (Unable to close eyes)",
  "Others",
];

const INCLUSION = [
  "Identified as a household contact",
  "Exception in blanket approach where no link with an index case needs to be established (high burden)",
  "Consent of the contact obtained",
  "Verbal consent",
  "Written consent",
  "Consent should be obtained from the parent/guardian",
];

const EXCLUSION = [
  "With possible signs and/or symptoms of leprosy",
  "With a history of liver or kidney disorders",
  "Pregnancy",
  "Received Rifampicin in last 2 years",
  "With possible signs and/or symptoms of TB or confirmed with TB (cough for < 2 weeks / Fever / Weight loss)",
  "Allergy to Rifampicin",
  "Age below 2 years",
  "Any other contraindications of using Rifampicin",
];

const OUTCOMES = [
  "Suspect Leprosy",
  "Confirmed Leprosy",
  "Healthy Contact",
  "Meet exclusion criteria",
  "Old disabled case (Released from treatment)",
];

const SDR_CAPSULE_MG = 300;

const SDR_BY_AGE = [
  { min: 2, max: 5, label: "Rifampicin 150mg (2Y and above)", mg: 150 },
  { min: 6, max: 9, label: "Rifampicin 300mg (6Y to 9Y)", mg: 300 },
  { min: 10, max: 14, label: "Rifampicin 450mg (10Y to 14Y)", mg: 450 },
  { min: 15, max: Infinity, label: "Rifampicin 600mg (15Y and above)", mg: 600 },
];

/** Same bands as Apex household SDR selection (2–5 / 6–9 / 10–14 / 15+). */
const sdrBandForAgeYears = (ageY) => {
  const age = Number(ageY);
  if (!Number.isFinite(age) || age < 2) return null;
  return SDR_BY_AGE.find((b) => age >= b.min && age <= b.max) || null;
};

const sdrDetails = (ageY) => {
  const band = sdrBandForAgeYears(ageY);
  if (!band) return null;
  const tabs = physicalUnits(band.mg, SDR_CAPSULE_MG);
  return {
    drug: "Cap Rifampicin",
    label: band.label,
    mg: band.mg,
    tabletMg: SDR_CAPSULE_MG,
    dosage: formatDosePhysical(band.mg, tabs, "capsule"),
    frequency: "Once",
    duration: "Single dose",
  };
};

const emptySdrFields = () => ({
  treatment: "",
  treatmentDrug: "",
  treatmentDosage: "",
  treatmentFrequency: "",
  treatmentDuration: "",
});

const emptyTreatmentFields = () => ({
  treatmentConsent: "",
  treatmentCounselling: "",
  administrationDate: "",
  ...emptySdrFields(),
});

const applySdrFields = (row, consentYes) => {
  const details = consentYes ? sdrDetails(contactAgeYears(row)) : null;
  if (!details) return { ...row, ...emptySdrFields() };
  return {
    ...row,
    treatment: details.label,
    treatmentDrug: details.drug,
    treatmentDosage: details.dosage,
    treatmentFrequency: details.frequency,
    treatmentDuration: details.duration,
  };
};

const emptyContact = () => ({
  id: `hc-${Date.now()}`,
  firstName: "",
  middleName: "",
  lastName: "",
  registerPatient: "No",
  patientId: "",
  dob: "",
  ageY: "",
  ageM: "",
  ageD: "",
  gender: "Male",
  relationship: "",
  phone: "",
  screeningConsent: "",
  screeningCounselling: "",
  examDate: localISODate(),
  symptoms: [],
  inclusionCriteria: [],
  exclusionCriteria: [],
  outcome: "",
  ...emptyTreatmentFields(),
  administrationDate: localISODate(),
  photos: [],
});

const displayName = (c) => [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ") || "—";

const ageGenderLine = (c) => {
  const y = c.ageY !== "" && c.ageY != null ? c.ageY : "0";
  const m = c.ageM !== "" && c.ageM != null ? c.ageM : "0";
  const d = c.ageD !== "" && c.ageD != null ? c.ageD : "0";
  const g = c.gender === "Female" ? "F" : c.gender === "Others" ? "O" : "M";
  return `${y}y ${m}m ${d}d | ${g}`;
};

const yearsFromDob = (dob) => {
  if (!dob) return null;
  const d = new Date(`${dob}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let y = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) y -= 1;
  return y;
};

const contactAgeYears = (c) => {
  if (c.ageY !== "" && c.ageY != null && Number.isFinite(Number(c.ageY))) return Number(c.ageY);
  return yearsFromDob(c.dob);
};

const SectionTitle = ({ children }) => (
  <h3 className="border-b border-border pb-2 font-head text-base font-bold tracking-tight">{children}</h3>
);

export default function LeprosyHouseholdMonitoring({ value = [], onChange, id = "hh-contacts", sourcePatient = null, viewOnly = false }) {
  const { addPatient, addDisease, patients } = useStore();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("add"); // add | edit | view
  const [draft, setDraft] = useState(emptyContact());
  const [editIndex, setEditIndex] = useState(-1);

  const contacts = Array.isArray(value) ? value : [];
  const readOnly = viewOnly || mode === "view";

  const ageYears = useMemo(() => contactAgeYears({ ageY: draft.ageY, dob: draft.dob }), [draft.ageY, draft.dob]);
  const sdr = useMemo(() => sdrDetails(ageYears), [ageYears]);
  const treatmentOptions = sdr ? [sdr.label] : [];

  const set = (k) => (v) => setDraft((s) => {
    const next = { ...s, [k]: v };
    if (k === "dob") {
      const parts = ageYmdFromDob(v);
      next.ageY = parts.y;
      next.ageM = parts.m;
      next.ageD = parts.d;
    }
    if (k === "ageY" || k === "ageM" || k === "ageD") {
      next.dob = dobFromAgeYmd({ y: next.ageY, m: next.ageM, d: next.ageD });
    }
    if (k === "ageY" || k === "ageM" || k === "ageD" || k === "dob") {
      return applySdrFields(next, next.treatmentConsent === "Yes");
    }
    return next;
  });

  const openAdd = () => {
    setMode("add");
    setEditIndex(-1);
    setDraft(emptyContact());
    setOpen(true);
  };

  const openRow = (i, nextMode) => {
    setMode(nextMode);
    setEditIndex(i);
    const row = { ...emptyContact(), ...contacts[i], photos: contacts[i].photos || [] };
    if (row.dob && (row.ageY === "" || row.ageM === "" || row.ageD === "")) {
      const parts = ageYmdFromDob(row.dob);
      if (row.ageY === "") row.ageY = parts.y;
      if (row.ageM === "") row.ageM = parts.m;
      if (row.ageD === "") row.ageD = parts.d;
    } else if (!row.dob && (row.ageY !== "" || row.ageM !== "" || row.ageD !== "")) {
      row.dob = dobFromAgeYmd({ y: row.ageY, m: row.ageM, d: row.ageD });
    }
    setDraft(applySdrFields(row, row.treatmentConsent === "Yes"));
    setOpen(true);
  };

  const remove = (i) => onChange(contacts.filter((_, j) => j !== i));

  const ensureRegisteredPatient = (row) => {
    if (row.registerPatient !== "Yes") return { ...row, patientId: row.patientId || "" };

    const fullName = displayName(row);
    const age = contactAgeYears(row);
    const gender = row.gender === "Others" ? "Other" : (row.gender || "Male");

    // Update existing linked patient if already created from this contact
    if (row.patientId && patients.some((p) => p.id === row.patientId)) {
      addDisease(row.patientId, "leprosy");
      return row;
    }

    const rec = addPatient({
      name: fullName,
      middleName: row.middleName || "",
      lastName: row.lastName || "",
      dob: row.dob || "",
      age: Number.isFinite(age) ? age : 0,
      gender,
      sex: gender,
      phone: row.phone || "",
      province: sourcePatient?.province || "",
      district: sourcePatient?.district || "",
      village: sourcePatient?.village || "",
      facility: sourcePatient?.facility || "",
      household: sourcePatient?.household || "",
      diseases: ["leprosy"],
      status: row.outcome === "Confirmed Leprosy"
        ? "Confirmed"
        : row.outcome === "Suspect Leprosy"
          ? "Suspected"
          : "Suspected",
      indexPatientId: sourcePatient?.id || "",
      registeredFrom: "leprosy-household-contact",
      relationshipToIndex: row.relationship || "",
    });
    toast.success(`Patient ${rec.id} created for ${fullName}`);
    return { ...row, patientId: rec.id };
  };

  const save = () => {
    if (!draft.firstName?.trim() || !draft.lastName?.trim()) return;
    if (!draft.relationship) return;
    if (draft.registerPatient === "Yes" && !Number.isFinite(contactAgeYears(draft))) {
      toast.error("Age is required when registering a patient");
      return;
    }

    const healthy = draft.outcome === "Healthy Contact";
    let row = { ...draft, id: draft.id || `hc-${Date.now()}` };
    row = healthy
      ? applySdrFields(row, row.treatmentConsent === "Yes")
      : { ...row, ...emptyTreatmentFields() };
    row = ensureRegisteredPatient(row);

    if (editIndex >= 0) {
      onChange(contacts.map((c, j) => (j === editIndex ? row : c)));
    } else {
      onChange([row, ...contacts]);
    }
    setOpen(false);
  };

  const treatmentEnabled = draft.treatmentConsent === "Yes";

  const title = useMemo(() => {
    if (mode === "view") return "View household contact";
    if (mode === "edit") return "Edit household contact";
    return "Household Contact Examinations Monitoring";
  }, [mode]);

  return (
    <div className="space-y-4" data-testid={id}>
      {!viewOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-head text-lg font-semibold tracking-tight">Household Monitoring</p>
            <p className="text-xs text-muted-foreground">
              {contacts.length} contact{contacts.length === 1 ? "" : "s"} registered
            </p>
          </div>
          <Button type="button" className="h-11" data-testid={`${id}-add`} onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[920px] text-sm" data-testid={`${id}-table`}>
          <thead className="bg-muted">
            <tr>
              {["Name", "Relationship", "Consent", "Counselled", "Outcome", "Treatment", ""].map((h) => (
                <th key={h || "actions"} className="p-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">No contacts added yet.</td>
              </tr>
            ) : (
              contacts.map((c, i) => (
                <tr key={c.id || i} className="border-t border-border align-top">
                  <td className="p-3">
                    <p className="font-semibold">{displayName(c)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{ageGenderLine(c)}</p>
                    {c.patientId && (
                      <p className="mt-0.5 text-xs font-medium text-primary" data-testid={`${id}-patient-id-${i}`}>
                        Patient {c.patientId}
                      </p>
                    )}
                  </td>
                  <td className="p-3">{c.relationship || "—"}</td>
                  <td className="p-3 text-xs leading-relaxed">
                    <div>Screening : {c.screeningConsent || "—"}</div>
                    <div>Treatment : {c.treatmentConsent || "—"}</div>
                  </td>
                  <td className="p-3 text-xs leading-relaxed">
                    <div>Screening : {c.screeningCounselling || "—"}</div>
                    <div>Treatment : {c.treatmentCounselling || "—"}</div>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{c.outcome || "—"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.examDate ? fmtDate(c.examDate) : ""}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{c.treatmentDrug || c.treatment || "—"}</p>
                    {c.treatmentDosage ? <p className="mt-0.5 text-xs">{c.treatmentDosage}</p> : null}
                    {(c.treatmentFrequency || c.treatmentDuration) ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[c.treatmentFrequency, c.treatmentDuration].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.administrationDate ? fmtDate(c.administrationDate) : ""}</p>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-primary" data-testid={`${id}-add-row-${i}`} onClick={openAdd}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" className="h-9 px-2 text-primary" data-testid={`${id}-view-${i}`} onClick={() => openRow(i, "view")}>
                        <Eye className="mr-1 h-4 w-4" /> View
                      </Button>
                      {!viewOnly && (
                        <>
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-primary" data-testid={`${id}-edit-${i}`} onClick={() => openRow(i, "edit")}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-600" data-testid={`${id}-remove-${i}`} onClick={() => remove(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid={`${id}-dialog`}>
          <DialogHeader>
            <DialogTitle className="font-head text-xl">{title}</DialogTitle>
          </DialogHeader>

          <div className={`space-y-6 ${readOnly ? "pointer-events-none opacity-90" : ""}`}>
            <section className="space-y-4">
              <SectionTitle>Contact Details</SectionTitle>
              <div>
                <p className="mb-2 text-sm font-medium">Name</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <TextField label="First Name *" testid={`${id}-first`} value={draft.firstName} onChange={(e) => set("firstName")(capitalizeName(e.target.value))} autoCapitalize="words" />
                  <TextField label="Middle Name" testid={`${id}-middle`} value={draft.middleName} onChange={(e) => set("middleName")(capitalizeName(e.target.value))} autoCapitalize="words" />
                  <TextField label="Last Name *" testid={`${id}-last`} value={draft.lastName} onChange={(e) => set("lastName")(capitalizeName(e.target.value))} autoCapitalize="words" />
                </div>
              </div>
              <ChoiceRow label="Register Patient" options={["Yes", "No"]} value={draft.registerPatient} onChange={set("registerPatient")} testid={`${id}-register`} />
              {draft.registerPatient === "Yes" && (
                <p className="rounded-md border border-primary/20 bg-secondary/40 px-3 py-2 text-sm text-muted-foreground" data-testid={`${id}-register-hint`}>
                  {draft.patientId
                    ? `Linked to patient ${draft.patientId}. Saving will keep this patient record.`
                    : "Saving this contact will create a new patient in the NTD app (same household / location as the index case)."}
                </p>
              )}
              <div>
                <p className="mb-2 text-sm font-medium">Age</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Date of Birth" type="date" testid={`${id}-dob`} value={draft.dob} allowEmpty onChange={(e) => set("dob")(e.target.value)} hint="Age is calculated automatically" />
                  <div className="grid grid-cols-3 gap-2">
                    <TextField label="YY" type="number" testid={`${id}-age-y`} value={draft.ageY} onChange={(e) => set("ageY")(e.target.value)} />
                    <TextField label="MM" type="number" testid={`${id}-age-m`} value={draft.ageM} onChange={(e) => set("ageM")(e.target.value)} />
                    <TextField label="DD" type="number" testid={`${id}-age-d`} value={draft.ageD} onChange={(e) => set("ageD")(e.target.value)} />
                  </div>
                </div>
              </div>
              <ChoiceRow label="Gender" options={["Male", "Female", "Others"]} value={draft.gender} onChange={set("gender")} testid={`${id}-gender`} />
              <ChoiceRow label="Relationship *" options={LEPROSY_RELATIONSHIPS} value={draft.relationship} onChange={set("relationship")} testid={`${id}-rel`} />
              <TextField label="Contact (phone)" testid={`${id}-phone`} value={draft.phone} onChange={(e) => set("phone")(e.target.value)} />
            </section>

            <section className="space-y-4">
              <SectionTitle>Screening</SectionTitle>
              <ChoiceRow label="Consented for Screening" options={["Yes", "No"]} value={draft.screeningConsent} onChange={set("screeningConsent")} testid={`${id}-scr-consent`} />
              <ChoiceRow label="Counselling" options={["Yes", "No"]} value={draft.screeningCounselling} onChange={set("screeningCounselling")} testid={`${id}-scr-counsel`} />
              <TextField label="Examination Date" type="date" testid={`${id}-exam-date`} value={draft.examDate} onChange={(e) => set("examDate")(e.target.value)} />
              <CheckGrid label="Symptom" options={SYMPTOMS} value={draft.symptoms || []} onChange={set("symptoms")} testid={`${id}-symptoms`} cols="sm:grid-cols-1 lg:grid-cols-2" />
              <CheckGrid label="Inclusion Criteria" options={INCLUSION} value={draft.inclusionCriteria || []} onChange={set("inclusionCriteria")} testid={`${id}-inclusion`} cols="sm:grid-cols-1 lg:grid-cols-2" />
              <CheckGrid label="Exclusion Criteria" options={EXCLUSION} value={draft.exclusionCriteria || []} onChange={set("exclusionCriteria")} testid={`${id}-exclusion`} cols="sm:grid-cols-1 lg:grid-cols-2" />
              <ChoiceRow
                label="Outcome"
                options={OUTCOMES}
                value={draft.outcome}
                onChange={(v) => setDraft((s) => (
                  v === "Healthy Contact"
                    ? { ...s, outcome: v }
                    : { ...s, outcome: v, ...emptyTreatmentFields() }
                ))}
                testid={`${id}-outcome`}
              />
            </section>

            {draft.outcome === "Healthy Contact" && (
            <section className="space-y-4" data-testid={`${id}-treatment-section`}>
              <SectionTitle>Treatment</SectionTitle>
              <ChoiceRow
                label="Consented for Treatment"
                options={["Yes", "No"]}
                value={draft.treatmentConsent}
                onChange={(v) => setDraft((s) => {
                  const next = { ...s, treatmentConsent: v };
                  if (v !== "Yes") {
                    return {
                      ...applySdrFields(next, false),
                      treatmentCounselling: "",
                      administrationDate: "",
                    };
                  }
                  return {
                    ...applySdrFields(next, true),
                    administrationDate: s.administrationDate || localISODate(),
                  };
                })}
                testid={`${id}-tx-consent`}
              />
              <div className={`space-y-4 ${treatmentEnabled ? "" : "pointer-events-none opacity-50"}`}>
                <ChoiceRow label="Counselling" options={["Yes", "No"]} value={draft.treatmentCounselling} onChange={set("treatmentCounselling")} testid={`${id}-tx-counsel`} />
                <TextField label="Administration Date" type="date" testid={`${id}-admin-date`} value={draft.administrationDate} onChange={(e) => set("administrationDate")(e.target.value)} />
                {sdr ? (
                  <>
                    <ChoiceRow
                      label="Treatment"
                      options={treatmentOptions}
                      value={draft.treatment || sdr.label}
                      onChange={set("treatment")}
                      testid={`${id}-treatment`}
                    />
                    <div className="space-y-3 rounded-lg border border-primary bg-secondary/40 p-4" data-testid={`${id}-sdr-card`}>
                      <div>
                        <p className="font-semibold" data-testid={`${id}-sdr-drug`}>{sdr.drug}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{sdr.label}</p>
                      </div>
                      <DosePhysicalBox
                        testid={`${id}-sdr-physical`}
                        doseText={sdr.dosage}
                        hint={`${sdr.tabletMg} mg capsules · single-dose PEP`}
                      />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Dosage</p>
                          <p className="mt-1 text-sm font-semibold" data-testid={`${id}-sdr-dosage`}>{sdr.dosage}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Frequency</p>
                          <p className="mt-1 text-sm font-semibold" data-testid={`${id}-sdr-frequency`}>{sdr.frequency}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Duration</p>
                          <p className="mt-1 text-sm font-semibold" data-testid={`${id}-sdr-duration`}>{sdr.duration}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground" data-testid={`${id}-treatment-none`}>
                    {ageYears == null || ageYears === ""
                      ? "Enter contact age (YY) to show the matching Rifampicin dose."
                      : ageYears < 2
                        ? "Rifampicin PEP is not indicated under 2 years of age."
                        : "No matching Rifampicin dose for this age."}
                  </p>
                )}
              </div>
            </section>
            )}

            <section className="space-y-4">
              <SectionTitle>Upload</SectionTitle>
              <PhotoCapture
                label="Attachments / photographs"
                photos={draft.photos || []}
                onChange={set("photos")}
                testid={`${id}-photos`}
                max={6}
              />
            </section>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="h-12" onClick={() => setOpen(false)} data-testid={`${id}-cancel`}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button
                type="button"
                className="h-12"
                onClick={save}
                disabled={!draft.firstName?.trim() || !draft.lastName?.trim() || !draft.relationship}
                data-testid={`${id}-save`}
              >
                Save contact
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
