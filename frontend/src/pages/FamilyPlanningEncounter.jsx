import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useStore } from "@/store";
import { TextField, SelectField, CheckGrid } from "@/components/Fields";
import { ConditionEntryShell, ChoiceChips } from "@/components/EntryKit";
import FamilyPlanningServicesPicker from "@/components/FamilyPlanningServicesPicker";
import {
  FP_ID,
  FP_NAME,
  MEDICAL_HISTORY_OPTIONS,
  RISK_FACTOR_OPTIONS,
  PRESENT_ABSENT,
  DYSMENORRHEA,
  MENSTRUAL_FLOW,
  CYCLE_REGULARITY,
  YES_NO,
  COUNT_0_10,
  obstetricCountValue,
  autoRiskFactors,
  resolveDating,
  trimesterLabel,
  FP_SERVICE_OPTIONS,
  FP_EXCLUSIVE_OPTIONS,
  normalizeFpForm,
  newFpEpisodeId,
} from "@/mock/familyPlanning";
import { persistIntegratedEncounter, useExtraPhiAutosave, useLoadEncounterPhi } from "@/lib/extraEncounterSync";
import { localISODate } from "@/mock/specs";

const MultiChips = ({ label, options, value = [], onChange, testid, autoOptions = [] }) => (
  <CheckGrid
    label={label}
    options={options}
    value={value}
    onChange={onChange}
    testid={testid}
    cols="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    autoOptions={autoOptions}
  />
);

export default function FamilyPlanningEncounter() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {
    patients, encounters, saveEncounter, loadEncounterPhi,
    upsertEncounterPhiField, finalizeEncounterPhi, user, online,
  } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find(
    (e) => e.disease === FP_ID && (e.id === params.get("enc") || e.visitId === params.get("enc")),
  );
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);

  const [d, setD] = useState(() =>
    normalizeFpForm(existing?.data || {}, { seedPrior: !existing, patientEncs }),
  );
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "Family Planning visit";
  const focusSection = params.get("section");

  const { phiLoading } = useLoadEncounterPhi({
    existing,
    online,
    loadEncounterPhi,
    applyForm: (form) => normalizeFpForm({ ...(existing?.data || {}), ...form }),
    setD,
    setSavedAt,
  });

  const dating = useMemo(() => resolveDating(d.caseDetails), [d.caseDetails]);

  const medicalKey = (d.history?.medical || []).join("|");
  const autoSuggestedRisks = useMemo(
    () => autoRiskFactors(d, p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      d.caseDetails.neonatalDeath,
      d.caseDetails.stillBirth,
      medicalKey,
      p?.age,
      p?.ageYears,
    ],
  );

  useEffect(() => {
    const suggested = autoSuggestedRisks;
    if (!suggested.length) return;
    setD((s) => {
      const dismissed = s.history?.riskFactorsDismissed || [];
      const current = s.history?.riskFactors || [];
      const toAdd = suggested.filter((r) => !current.includes(r) && !dismissed.includes(r));
      if (!toAdd.length) return s;
      return {
        ...s,
        history: { ...s.history, riskFactors: [...current, ...toAdd] },
      };
    });
  }, [autoSuggestedRisks]);

  useEffect(() => {
    if (!d.caseDetails.lmp) return;
    setD((s) => {
      if (s.history?.menstrual?.lmp === d.caseDetails.lmp) return s;
      return {
        ...s,
        history: { ...s.history, menstrual: { ...s.history.menstrual, lmp: d.caseDetails.lmp } },
      };
    });
  }, [d.caseDetails.lmp]);

  const { queueSectionDiff, flushPendingPhi } = useExtraPhiAutosave({
    online,
    upsertEncounterPhiField,
    patientId: p?.id || id,
    existing,
    diseaseId: FP_ID,
  });

  if (!p) {
    return (
      <div className="p-8">
        Patient not found. <Button onClick={() => navigate("/patients")}>Back</Button>
      </div>
    );
  }

  const setCase = (patch) => {
    const prev = d.caseDetails || {};
    const next = { ...prev, ...patch };
    setD((s) => ({ ...s, caseDetails: next }));
    queueSectionDiff("caseDetails", prev, next);
  };
  const setHist = (patch) => {
    const prev = d.history || {};
    const next = { ...prev, ...patch };
    setD((s) => ({ ...s, history: next }));
    queueSectionDiff("history", prev, next);
  };
  const setRiskFactors = (nextRisks) => {
    const prev = d.history || {};
    const prevRisks = prev.riskFactors || [];
    const removed = prevRisks.filter((x) => !nextRisks.includes(x));
    const dismissed = [...new Set([...(prev.riskFactorsDismissed || []), ...removed])].filter(
      (x) => !nextRisks.includes(x),
    );
    const next = { ...prev, riskFactors: nextRisks, riskFactorsDismissed: dismissed };
    setD((s) => ({ ...s, history: next }));
    queueSectionDiff("history", prev, next);
  };
  const setMenstrual = (patch) => {
    const prev = d.history || {};
    const next = { ...prev, menstrual: { ...(prev.menstrual || {}), ...patch } };
    setD((s) => ({ ...s, history: next }));
    queueSectionDiff("history", prev, next);
  };
  const setServices = (nextServices) => {
    const prev = d.services || [];
    setD((s) => ({
      ...s,
      services: nextServices,
      familyPlanningExclusive: nextServices?.length ? "" : s.familyPlanningExclusive,
      familyPlanningPlannedDate: nextServices?.length ? "" : s.familyPlanningPlannedDate,
    }));
    queueSectionDiff("services", prev, nextServices);
  };
  const setFamilyPlanningExclusive = (value) => {
    setD((s) => ({
      ...s,
      familyPlanningExclusive: value || "",
      services: value ? [] : s.services,
      familyPlanningPlannedDate:
        value === "Planned" ? (s.familyPlanningPlannedDate || localISODate()) : "",
    }));
    if (value) queueSectionDiff("services", d.services || [], []);
  };
  const setFamilyPlanningPlannedDate = (date) => {
    setD((s) => ({ ...s, familyPlanningPlannedDate: date || "" }));
  };

  const persist = async (close) => {
    const episodeId =
      existing?.episodeId
      || existing?.recordId
      || patientEncs.filter((e) => e.disease === FP_ID)[0]?.episodeId
      || patientEncs.filter((e) => e.disease === FP_ID)[0]?.recordId
      || newFpEpisodeId();
    const serviceNames = (d.services || []).map((s) => s.service).filter(Boolean);
    const diagnosis = serviceNames.length
      ? serviceNames.join(", ")
      : (d.familyPlanningExclusive || "");
    const { canWritePhi } = await persistIntegratedEncounter({
      online,
      saveEncounter,
      upsertEncounterPhiField,
      finalizeEncounterPhi,
      flushPendingPhi,
      existing,
      payload: {
        id: existing?.id,
        patientId: p.id,
        episodeId,
        disease: FP_ID,
        facility,
        worker: user?.name,
        type: visitType,
        diagnosis,
        treatment: "",
        outcome: "Active",
        data: {
          caseDetails: d.caseDetails,
          history: {
            ...d.history,
            riskFactors: d.history.riskFactors || [],
            riskFactorsDismissed: d.history.riskFactorsDismissed || [],
          },
          services: d.services || [],
          familyPlanningExclusive: d.familyPlanningExclusive || "",
          familyPlanningPlannedDate: d.familyPlanningExclusive === "Planned" ? (d.familyPlanningPlannedDate || "") : "",
          notes: d.notes || [""],
        },
      },
    });
    setSavedAt(new Date().toLocaleTimeString());
    if (close) navigate(`/patients/${p.id}?tab=familyplanning`);
    if (canWritePhi) toast.success(close ? "Family Planning visit saved" : "Saved");
    else if (online) toast.success(close ? "Family Planning visit queued for sync" : "Saved · queued for sync");
    else toast.success("Saved · queued until online");
  };

  const sections = [
    {
      title: "Case details",
      done: !!d.caseDetails.lmp || !!dating.finalEdd || d.caseDetails.g != null,
      body: (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 font-head text-sm font-semibold text-primary">Obstetric</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="fp-gpla-fields">
                {[
                  { k: "g", long: "gravida", label: "Gravida (G)", testid: "fp-gravida" },
                  { k: "p", long: "para", label: "Para (P)", testid: "fp-para" },
                  { k: "l", long: "living", label: "Living (L)", testid: "fp-living" },
                  { k: "a", long: "abortions", label: "Abortions (A)", testid: "fp-abortions" },
                ].map((f) => (
                  <TextField
                    key={f.k}
                    label={f.label}
                    type="number"
                    min={0}
                    testid={f.testid}
                    value={d.caseDetails[f.k] ?? d.caseDetails[f.long] ?? ""}
                    onChange={(e) => {
                      const v = String(e.target.value || "").replace(/\D/g, "").slice(0, 2);
                      setCase({ [f.k]: v, [f.long]: v, gpla: "" });
                    }}
                    placeholder="0"
                  />
                ))}
              </div>
              <SelectField label="Neonatal death" options={COUNT_0_10} value={obstetricCountValue(d.caseDetails.neonatalDeath)} onChange={(v) => setCase({ neonatalDeath: v })} testid="fp-neonatal-death" />
              <SelectField label="Still birth" options={COUNT_0_10} value={obstetricCountValue(d.caseDetails.stillBirth)} onChange={(v) => setCase({ stillBirth: v })} testid="fp-still-birth" />
              <SelectField label="Term birth" options={COUNT_0_10} value={obstetricCountValue(d.caseDetails.termBirth)} onChange={(v) => setCase({ termBirth: v })} testid="fp-term-birth" />
              <TextField label="Living children" type="number" testid="fp-living-children" value={d.caseDetails.livingChildren || ""} onChange={(e) => setCase({ livingChildren: e.target.value })} />
              <TextField label="Age of last child" testid="fp-age-last-child" value={d.caseDetails.ageLastChild || ""} onChange={(e) => setCase({ ageLastChild: e.target.value })} placeholder="e.g. 2y" />
              <TextField
                label="Final EDD (clinician)"
                type="date"
                allowEmpty
                testid="fp-final-edd"
                value={d.caseDetails.finalEdd || ""}
                onChange={(e) => setCase({ finalEdd: e.target.value, finalSource: "Manual" })}
                hint={dating.finalGa ? `GA ${dating.finalGa.text} · ${trimesterLabel(dating.trimester)}` : "Clinician dating"}
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-head text-sm font-semibold text-primary">Menstrual</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <TextField label="Menstrual cycle length (days)" type="number" testid="fp-cycle-length" value={d.caseDetails.cycleLength || ""} onChange={(e) => setCase({ cycleLength: e.target.value })} />
              <TextField label="LMP" type="date" testid="fp-lmp" value={d.caseDetails.lmp || ""} onChange={(e) => setCase({ lmp: e.target.value })} />
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm font-semibold" data-testid="fp-lmp-confirmed">
                  <input type="checkbox" className="h-4 w-4" checked={!!d.caseDetails.lmpConfirmed} onChange={(e) => setCase({ lmpConfirmed: e.target.checked })} />
                  Is the LMP date confirmed?
                </label>
              </div>
            </div>
          </div>

          <ChoiceChips label="Was couple counselling done" options={YES_NO} value={d.caseDetails.coupleCounselling || ""} onChange={(v) => setCase({ coupleCounselling: v })} testid="fp-couple-counselling" />
        </div>
      ),
    },
    {
      title: "History",
      done: (d.history.medical || []).length > 0 || Object.keys(d.history.menstrual || {}).length > 0,
      body: (
        <div className="space-y-3">
          <MultiChips label="Medical History" options={MEDICAL_HISTORY_OPTIONS} value={d.history.medical || []} onChange={(v) => setHist({ medical: v })} testid="fp-medical" />
          <div>
            <p className="mb-1.5 font-head text-sm font-semibold text-primary">Menstrual History</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextField label="LMP" type="date" testid="fp-hist-lmp" value={d.history.menstrual?.lmp || d.caseDetails.lmp || ""} onChange={(e) => setMenstrual({ lmp: e.target.value })} hint="Auto-filled from Case details" />
              <TextField label="Menarche (years)" type="number" testid="fp-menarche" value={d.history.menstrual?.menarche || ""} onChange={(e) => setMenstrual({ menarche: e.target.value })} />
              <ChoiceChips label="Amenorrhea" options={PRESENT_ABSENT} value={d.history.menstrual?.amenorrhea || ""} onChange={(v) => setMenstrual({ amenorrhea: v })} testid="fp-amenorrhea" />
              <ChoiceChips label="Intermenstrual Bleeding" options={PRESENT_ABSENT} value={d.history.menstrual?.imb || ""} onChange={(v) => setMenstrual({ imb: v })} testid="fp-imb" />
              <ChoiceChips label="Dysmenorrhea" options={DYSMENORRHEA} value={d.history.menstrual?.dysmenorrhea || ""} onChange={(v) => setMenstrual({ dysmenorrhea: v })} testid="fp-dysmenorrhea" />
              <ChoiceChips label="Menstrual Flow" options={MENSTRUAL_FLOW} value={d.history.menstrual?.flow || ""} onChange={(v) => setMenstrual({ flow: v })} testid="fp-flow" />
              <TextField label="Cycle Duration (Days)" type="number" testid="fp-cycle-duration" value={d.history.menstrual?.cycleDuration || ""} onChange={(e) => setMenstrual({ cycleDuration: e.target.value })} />
              <TextField label="Cycle Length (Days)" type="number" testid="fp-hist-cycle-length" value={d.history.menstrual?.cycleLength || d.caseDetails.cycleLength || ""} onChange={(e) => setMenstrual({ cycleLength: e.target.value })} />
              <ChoiceChips label="Menstrual cycles" options={CYCLE_REGULARITY} value={d.history.menstrual?.regularity || ""} onChange={(v) => setMenstrual({ regularity: v })} testid="fp-regularity" />
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Risk factors",
      done: (d.history.riskFactors || []).length > 0,
      body: (
        <MultiChips
          label="Risk factors (auto from history / case + multi-select)"
          options={RISK_FACTOR_OPTIONS}
          value={d.history.riskFactors || []}
          onChange={setRiskFactors}
          autoOptions={autoSuggestedRisks}
          testid="fp-risk"
        />
      ),
    },
    {
      title: "Family Planning",
      done: (d.services || []).length > 0 || !!d.familyPlanningExclusive,
      body: (
        <FamilyPlanningServicesPicker
          options={FP_SERVICE_OPTIONS}
          value={d.services || []}
          onChange={setServices}
          exclusiveOptions={FP_EXCLUSIVE_OPTIONS}
          exclusiveValue={d.familyPlanningExclusive || ""}
          onExclusiveChange={setFamilyPlanningExclusive}
          plannedDate={d.familyPlanningPlannedDate || ""}
          onPlannedDateChange={setFamilyPlanningPlannedDate}
          label="Family Planning (multi-select)"
          testid="fp-services"
        />
      ),
    },
  ];

  return (
    <ConditionEntryShell
      patient={p}
      patientEncs={patientEncs}
      sidebarDiseases={[{ id: FP_ID, name: FP_NAME }]}
      title={`${FP_NAME} visit`}
      context={`${facility} · ${visitType}${phiLoading ? " · loading PHI…" : ""}`}
      sections={sections}
      onSave={persist}
      savedAt={savedAt}
      backTo={() => navigate(`/patients/${p.id}?tab=familyplanning`)}
      focusSection={focusSection}
    />
  );
}
