import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { TextField, AreaField, SelectField, AlertPanel, ChoiceRow } from "@/components/Fields";
import { ConditionEntryShell, SliderStat, ChoiceChips, YesNo } from "@/components/EntryKit";
import { VisitPosology } from "@/components/MedicationShared";
import { dobFromAge } from "@/components/Capture";
import { monthsBetween, ageMonthsToLabel, percentileLabel } from "@/mock/growth";
import { localISODate } from "@/mock/specs";
import { GEO } from "@/mock/data";
import {
  MAL_ID, MAL_NAME, CASE_TYPES, ADMISSION_TYPES, APPETITE, OEDEMA, RR_BANDS, TEMP_OPTS,
  DANGER_SIGNS, HISTORY, ROUTINE_MEDS, MAL_DRUG_META, OUTCOMES, malIndices, monitoringAlert,
  newMalEpisodeId, isMalEpisodeClosed, malColorGrade, normalizeVisitType, malWeeksVisited, visitWeekNumber,
} from "@/mock/malnutrition";
import { dropVisitPosology, setVisitPosology, slugDrug } from "@/lib/medications";
import { toast } from "sonner";

const ANTHRO = [
  { k: "weight", label: "Current weight", unit: "kg", min: 2, max: 40, step: 0.1 },
  { k: "height", label: "Height / length", unit: "cm", min: 40, max: 150, step: 0.5 },
  { k: "muac", label: "MUAC", unit: "cm", min: 7, max: 25, step: 0.1 },
];

const alertCls = {
  red: "border-red-500 bg-red-50 text-red-800",
  amber: "border-amber-500 bg-amber-50 text-amber-800",
  green: "border-green-500 bg-green-50 text-green-800",
  primary: "border-primary/40 bg-secondary text-primary",
};

const empty = () => ({
  visitType: "Admission",
  week: "",
  caseDetails: {},
  weight: "",
  height: "",
  muac: "",
  oedema: "None",
  appetite: "Not done",
  dangerSigns: {},
  history: {},
  rr: "",
  temp: "",
  meds: [],
  posology: {},
  rutf: "",
  medOther: "",
  outcome: { status: "Active" },
});

function MalMedCard({ name, selected, onToggle, posology, onPosology }) {
  const meta = MAL_DRUG_META[name] || {};
  return (
    <div
      className={`rounded-lg border p-4 ${selected ? "border-primary bg-secondary/40" : "border-border bg-white"}`}
      data-testid={`mal-drug-${slugDrug(name)}`}
    >
      <button type="button" onClick={() => onToggle(!selected)} className="flex w-full items-start gap-3 text-left" data-testid={`mal-drug-toggle-${slugDrug(name)}`}>
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded border ${selected ? "border-primary bg-primary text-white" : "border-input bg-white"}`}>
          {selected && <Check className="h-4 w-4" />}
        </span>
        <p className="font-semibold">{name}</p>
      </button>
      {selected && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <VisitPosology
            name={name}
            defaults={{ dosage: meta.dosage || "", frequency: meta.frequency || "", duration: meta.duration || "" }}
            posology={posology}
            onChange={onPosology}
          />
        </div>
      )}
    </div>
  );
}

export default function MalnutritionEncounter() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { patients, encounters, saveEncounter, user, online } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.id === params.get("enc") && e.disease === MAL_ID);
  const weekFromUrl = params.get("week");
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  const malEncs = useMemo(
    () => patientEncs.filter((e) => e.disease === MAL_ID).sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [patientEncs],
  );

  const priorInEpisode = useMemo(() => {
    if (existing?.episodeId) return malEncs.filter((e) => e.episodeId === existing.episodeId && e.id !== existing.id);
    const open = [...malEncs].reverse().find((e) => !isMalEpisodeClosed(e.outcome || e.data?.outcome?.status));
    if (open) return malEncs.filter((e) => e.episodeId === open.episodeId);
    return [];
  }, [malEncs, existing]);

  const isAdmissionVisit = existing
    ? /admission/i.test(existing.data?.visitType || existing.type || "") || priorInEpisode.length === 0
    : priorInEpisode.length === 0;

  const admissionVisit = useMemo(() => {
    const pool = existing?.episodeId
      ? malEncs.filter((e) => e.episodeId === existing.episodeId)
      : priorInEpisode.length
        ? malEncs.filter((e) => e.episodeId === priorInEpisode[0].episodeId)
        : [];
    return pool.find((v) => /admission/i.test(v.data?.visitType || v.type || "")) || pool[0] || null;
  }, [malEncs, existing, priorInEpisode]);

  const [d, setD] = useState(() => {
    const base = { ...empty(), ...(existing?.data || {}) };
    base.outcome = { status: "Active", ...(base.outcome || {}) };
    if (!base.outcome.status) base.outcome.status = "Active";
    base.posology = { ...(base.posology || {}) };
    if (!Array.isArray(base.meds)) base.meds = [];
    delete base.targetWeight;
    const visitType = existing
      ? normalizeVisitType(base)
      : normalizeVisitType(base, isAdmissionVisit ? true : false);
    base.visitType = visitType;
    if (visitType === "Admission" && !base.weight && base.caseDetails?.admissionWeight) {
      base.weight = base.caseDetails.admissionWeight;
    }
    if (visitType === "Follow-up") {
      if (weekFromUrl && Number(weekFromUrl) >= 1) {
        base.week = String(Math.min(12, Number(weekFromUrl)));
      } else if (!base.week) {
        const weeks = priorInEpisode.map((e) => Number(e.data?.week) || visitWeekNumber(e) || 0);
        base.week = String(Math.min(12, Math.max(1, (Math.max(0, ...weeks) || 0) + 1)));
      }
    }
    return base;
  });

  // Keep first-visit weight synced from case details admission weight when empty / matching prior
  useEffect(() => {
    if (d.visitType !== "Admission") return;
    const aw = d.caseDetails?.admissionWeight;
    if (aw === undefined || aw === "") return;
    setD((s) => {
      if (s.weight !== "" && s.weight != null && String(s.weight) !== String(aw) && s._weightTouched) return s;
      if (String(s.weight) === String(aw)) return s;
      return { ...s, weight: aw };
    });
  }, [d.caseDetails?.admissionWeight, d.visitType]);

  // Keep visit type + week in sync with auto admission / follow-up rules
  useEffect(() => {
    const nextType = isAdmissionVisit ? "Admission" : "Follow-up";
    setD((s) => {
      let week = s.week;
      if (nextType === "Follow-up") {
        if (weekFromUrl && Number(weekFromUrl) >= 1) {
          week = String(Math.min(12, Number(weekFromUrl)));
        } else if (week === "" || week == null) {
          const weeks = priorInEpisode.map((e) => visitWeekNumber(e) || 0);
          week = String(Math.min(12, Math.max(1, (Math.max(0, ...weeks) || 0) + 1)));
        }
      }
      if (s.visitType === nextType && String(s.week || "") === String(week || s.week || "")) return s;
      return { ...s, visitType: nextType, ...(nextType === "Follow-up" ? { week } : { week: s.week || "" }) };
    });
  }, [isAdmissionVisit, priorInEpisode, weekFromUrl]);

  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const facility = existing?.facility || params.get("fac") || p?.facility || "";

  const dob = p?.dob || dobFromAge(p?.age, p?.createdAt);
  const ageMonths = monthsBetween(dob, existing?.date || localISODate());
  const sex = p?.sex || p?.gender;

  const prevMonitoring = useMemo(() => {
    const others = malEncs.filter((e) => e.id !== existing?.id);
    return others[others.length - 1]?.data || null;
  }, [malEncs, existing]);

  const caseNo = useMemo(() => {
    if (existing?.data?.caseDetails?.caseNo) return existing.data.caseDetails.caseNo;
    if (admissionVisit?.data?.caseDetails?.caseNo) return admissionVisit.data.caseDetails.caseNo;
    const eps = new Set(encounters.filter((e) => e.disease === MAL_ID && e.facility === facility).map((e) => e.episodeId));
    return eps.size + 1;
  }, [encounters, facility, existing, admissionVisit]);

  const lockedCaseDetails = useMemo(() => {
    const fromAdmission = admissionVisit?.data?.caseDetails || {};
    const fromExisting = existing?.data?.caseDetails || {};
    // Prefer admission visit as source of truth for the episode
    const src = Object.keys(fromAdmission).length ? fromAdmission : fromExisting;
    return src;
  }, [admissionVisit, existing]);

  const caseAlreadyEntered = !!(
    lockedCaseDetails.caseType
    || lockedCaseDetails.admissionType
    || lockedCaseDetails.admissionDate
    || lockedCaseDetails.admissionWeight
    || lockedCaseDetails.targetWeight
  );

  // Editable only on first admission before case details have been saved
  const canEditCaseDetails = isAdmissionVisit && !caseAlreadyEntered;

  const seededCase = useMemo(() => {
    if (canEditCaseDetails) return d.caseDetails || {};
    return { ...lockedCaseDetails, ...(d.caseDetails || {}) };
  }, [canEditCaseDetails, d.caseDetails, lockedCaseDetails]);

  const grade = malColorGrade(seededCase.admissionType || lockedCaseDetails.admissionType || d.caseDetails.admissionType);

  if (!p) {
    return (
      <div className="p-8">
        Patient not found. <Button onClick={() => navigate("/patients")}>Back</Button>
      </div>
    );
  }

  const set = (k, v) => setD((s) => ({ ...s, [k]: v, ...(k === "weight" ? { _weightTouched: true } : {}) }));
  const setCase = (patch) => setD((s) => ({ ...s, caseDetails: { ...s.caseDetails, ...patch } }));
  const setDanger = (k, v) => setD((s) => ({ ...s, dangerSigns: { ...s.dangerSigns, [k]: v } }));
  const setHist = (k, v) => setD((s) => ({ ...s, history: { ...s.history, [k]: v } }));

  const toggleMed = (name, on) => {
    setD((s) => {
      const meds = on ? [...new Set([...(s.meds || []), name])] : (s.meds || []).filter((x) => x !== name);
      let posology = on ? s.posology : dropVisitPosology(s.posology, name);
      const meta = MAL_DRUG_META[name] || {};
      if (on && !s.posology?.[name] && (meta.dosage || meta.frequency || meta.duration)) {
        posology = setVisitPosology(s.posology || {}, name, {
          dosage: meta.dosage || "",
          frequency: meta.frequency || "",
          duration: meta.duration || "",
        }, meta);
      }
      return { ...s, meds, posology };
    });
  };

  const idx = malIndices({ weight: d.weight, height: d.height, ageMonths, sex });
  const alert = monitoringAlert(d, prevMonitoring);

  const persist = (close) => {
    const episodeId =
      existing?.episodeId
      || priorInEpisode[0]?.episodeId
      || newMalEpisodeId();
    const visitType = isAdmissionVisit ? "Admission" : "Follow-up";
    const type = visitType === "Follow-up" ? `Follow-up${d.week ? ` · Week ${d.week}` : ""}` : "Admission";
    const outcomeStatus = d.outcome?.status || "Active";
    // Once entered, case details stay fixed for every encounter in the episode
    const caseDetails = canEditCaseDetails
      ? {
          ...d.caseDetails,
          caseNo,
          admissionDate: d.caseDetails.admissionDate || localISODate(),
        }
      : {
          ...lockedCaseDetails,
          caseNo: lockedCaseDetails.caseNo || caseNo,
        };
    saveEncounter({
      id: existing?.id,
      patientId: p.id,
      episodeId,
      disease: MAL_ID,
      facility,
      worker: user?.name,
      type,
      diagnosis: caseDetails.admissionType || "",
      outcome: isMalEpisodeClosed(outcomeStatus) ? outcomeStatus : "Active",
      data: {
        ...d,
        visitType,
        targetWeight: undefined,
        caseDetails,
        indices: idx,
        alert,
        ageMonths,
      },
    });
    setSavedAt(new Date().toLocaleTimeString());
    if (close) navigate(`/patients/${p.id}?tab=malnutrition`);
    toast.success(online ? (close ? "Malnutrition visit saved" : "Saved to device") : "Saved · queued until online");
  };

  const IndexBadge = ({ label, r }) => (
    <div className={`rounded-md border p-2 text-center ${r.status === "red" ? "border-red-500 bg-red-50" : r.status === "amber" ? "border-amber-500 bg-amber-50" : r.z != null ? "border-green-500 bg-green-50" : "border-border"}`}>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{r.z != null ? `${r.z > 0 ? "+" : ""}${r.z} SD` : "—"}</p>
      <p className="text-[11px] text-muted-foreground">{r.percentile != null ? `${percentileLabel(r.percentile)} pct` : ""}</p>
    </div>
  );

  const weeksVisited = malWeeksVisited(malEncs);

  const sections = [
    {
      title: "Case details",
      done: !!d.caseDetails.caseType || !!seededCase.caseType || d.visitType === "Follow-up",
      body: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground" data-testid="mal-auto-visit-type">
            Visit type: <span className="font-semibold text-foreground">{d.visitType}</span>
            {d.visitType === "Follow-up" ? ` · Week ${d.week || "—"} (auto — subsequent encounter)` : " (auto — first encounter)"}
          </p>
          {d.visitType === "Follow-up" && (
            <TextField
              label="Week number (1–12)"
              type="number"
              min={1}
              max={12}
              value={d.week}
              onChange={(e) => set("week", e.target.value)}
              testid="mal-week"
              hint="Which follow-up week you are recording"
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2" data-testid={canEditCaseDetails ? "mal-case-edit" : "mal-case-readonly"}>
            <SelectField
              label="Case type"
              options={CASE_TYPES}
              value={seededCase.caseType || ""}
              onChange={(v) => setCase({ caseType: v })}
              testid="mal-case-type"
              disabled={!canEditCaseDetails}
            />
            {(seededCase.caseType === "Transfer in") && (
              <TextField
                label="Transferred from (facility)"
                value={seededCase.fromFacility || ""}
                onChange={(e) => setCase({ fromFacility: e.target.value })}
                testid="mal-from-facility"
                disabled={!canEditCaseDetails}
              />
            )}
            <SelectField
              label="Admission type"
              options={ADMISSION_TYPES}
              value={seededCase.admissionType || ""}
              onChange={(v) => setCase({ admissionType: v })}
              testid="mal-admission-type"
              disabled={!canEditCaseDetails}
            />
            {seededCase.admissionType === "Others" && (
              <TextField
                label="Specify"
                value={seededCase.admissionOther || ""}
                onChange={(e) => setCase({ admissionOther: e.target.value })}
                testid="mal-admission-other"
                disabled={!canEditCaseDetails}
              />
            )}
            <TextField
              label="Admission date"
              type="date"
              value={seededCase.admissionDate || (canEditCaseDetails ? localISODate() : "")}
              onChange={(e) => setCase({ admissionDate: e.target.value })}
              testid="mal-admission-date"
              disabled={!canEditCaseDetails}
              allowEmpty={!canEditCaseDetails}
            />
            <TextField
              label="Admission weight (kg)"
              type="number"
              step="0.1"
              value={seededCase.admissionWeight || ""}
              onChange={(e) => setCase({ admissionWeight: e.target.value })}
              testid="mal-admission-weight"
              disabled={!canEditCaseDetails}
            />
            <TextField
              label="Targeted weight (kg)"
              type="number"
              step="0.1"
              value={seededCase.targetWeight || ""}
              onChange={(e) => setCase({ targetWeight: e.target.value })}
              testid="mal-targeted-weight"
              disabled={!canEditCaseDetails}
            />
            <TextField label="Admission age" value={ageMonthsToLabel(admissionVisit?.data?.ageMonths ?? ageMonths)} readOnly testid="mal-age" />
            <TextField label="Gender" value={sex || "—"} readOnly testid="mal-gender" />
            <TextField label="Case no. (this facility)" value={`#${seededCase.caseNo || caseNo}`} readOnly testid="mal-case-no" />
          </div>
        </div>
      ),
    },
    {
      title: "Malnutrition Assessment and Monitoring",
      done: !!d.weight || !!d.muac,
      body: (
        <div className="space-y-6">
          <div>
            <p className="mb-2 font-head text-sm font-semibold text-primary">Anthropometry</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ANTHRO.map((f) => (
                <SliderStat key={f.k} field={f} value={d[f.k]} onChange={(v) => set(f.k, v)} testid={`mal-${f.k}`} />
              ))}
            </div>
            {d.visitType === "Admission" && d.caseDetails.admissionWeight && (
              <p className="mt-2 text-xs text-muted-foreground">Current weight prefilled from Admission weight in Case details.</p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <IndexBadge label="Weight-for-age" r={idx.wfa} />
              <IndexBadge label="Weight-for-height" r={idx.wfh} />
              <IndexBadge label="Height-for-age" r={idx.hfa} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ChoiceChips label="Oedema" options={OEDEMA} value={d.oedema} onChange={(v) => set("oedema", v)} testid="mal-oedema" />
              <ChoiceChips label="Appetite test" options={APPETITE} value={d.appetite} onChange={(v) => set("appetite", v)} testid="mal-appetite" />
            </div>
          </div>

          <div>
            <p className="mb-2 font-head text-sm font-semibold text-primary">General danger signs</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {DANGER_SIGNS.map((s) => (
                <YesNo key={s.k} label={s.label} value={d.dangerSigns[s.k]} onChange={(v) => setDanger(s.k, v)} testid={`mal-ds-${s.k}`} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-head text-sm font-semibold text-primary">History</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {HISTORY.map((h) => (
                <YesNo key={h.k} label={h.label} value={d.history[h.k]} onChange={(v) => setHist(h.k, v)} testid={`mal-hist-${h.k}`} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-head text-sm font-semibold text-primary">Physical examination</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <ChoiceChips label="Respiratory rate (/min)" options={RR_BANDS} value={d.rr} onChange={(v) => set("rr", v)} testid="mal-rr" />
              <ChoiceChips label="Temperature" options={TEMP_OPTS} value={d.temp} onChange={(v) => set("temp", v)} testid="mal-temp" />
            </div>
          </div>

          <div>
            <p className="mb-2 font-head text-sm font-semibold text-primary">Routine Admission medication</p>
            <p className="mb-3 text-sm text-muted-foreground">Select medications, then set dosage, frequency and duration for this visit.</p>
            <div className="space-y-3">
              {ROUTINE_MEDS.map((name) => (
                <MalMedCard
                  key={name}
                  name={name}
                  selected={(d.meds || []).includes(name)}
                  onToggle={(on) => toggleMed(name, on)}
                  posology={d.posology}
                  onPosology={(patch) => setD((s) => ({ ...s, ...patch }))}
                />
              ))}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TextField label="RUTF (number of packets)" type="number" value={d.rutf} onChange={(e) => set("rutf", e.target.value)} testid="mal-rutf" />
              <TextField label="Other medicine (free text)" value={d.medOther} onChange={(e) => set("medOther", e.target.value)} testid="mal-med-other" />
            </div>
          </div>

          <div className={`rounded-lg border p-4 ${alertCls[alert.level]}`} data-testid="mal-alert">
            <p className="text-sm font-bold uppercase">
              {alert.level === "red" ? "Red alert" : alert.level === "amber" ? "Amber alert" : "Green"} — {alert.action}
            </p>
            <p className="mt-1 text-sm">{alert.reasons.join(" · ")}</p>
          </div>
        </div>
      ),
    },
    {
      title: "Case outcome",
      done: !!d.outcome.status,
      body: (
        <div className="space-y-4">
          <ChoiceRow
            label="Outcome"
            options={OUTCOMES}
            value={d.outcome.status || "Active"}
            onChange={(v) => set("outcome", { ...d.outcome, status: v || "Active" })}
            testid="mal-outcome"
          />
          {d.outcome.status === "Recovered / Discharged" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Final weight (kg)" type="number" value={d.outcome.finalWeight || ""} onChange={(e) => set("outcome", { ...d.outcome, finalWeight: e.target.value })} testid="mal-final-weight" />
              <TextField label="Final MUAC (cm)" type="number" value={d.outcome.finalMuac || ""} onChange={(e) => set("outcome", { ...d.outcome, finalMuac: e.target.value })} testid="mal-final-muac" />
              <SelectField label="Final oedema" options={OEDEMA} value={d.outcome.finalOedema || ""} onChange={(v) => set("outcome", { ...d.outcome, finalOedema: v })} testid="mal-final-oedema" />
              <TextField label="Final clinical status" value={d.outcome.finalClinical || ""} onChange={(e) => set("outcome", { ...d.outcome, finalClinical: e.target.value })} testid="mal-final-clinical" />
            </div>
          )}
          {d.outcome.status === "Transferred" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField label="Province" options={Object.keys(GEO)} value={d.outcome.province || ""} onChange={(v) => set("outcome", { ...d.outcome, province: v, district: "" })} testid="mal-transfer-province" />
              <SelectField label="District" options={Object.keys(GEO[d.outcome.province] || {})} value={d.outcome.district || ""} onChange={(v) => set("outcome", { ...d.outcome, district: v })} testid="mal-transfer-district" />
              <TextField label="Facility" value={d.outcome.facility || ""} onChange={(e) => set("outcome", { ...d.outcome, facility: e.target.value })} testid="mal-transfer-facility" />
            </div>
          )}
          {(d.outcome.status === "Refused treatment" || d.outcome.status === "Other" || d.outcome.status === "Lost to follow up") && (
            <AreaField label="Details" rows={2} value={d.outcome.note || ""} onChange={(e) => set("outcome", { ...d.outcome, note: e.target.value })} testid="mal-outcome-note" />
          )}
          {isMalEpisodeClosed(d.outcome.status) && (
            <AlertPanel level="review" title="This closes the malnutrition episode" testid="mal-outcome-close">
              Any outcome other than Active closes the case. Active keeps follow-up open.
            </AlertPanel>
          )}
        </div>
      ),
    },
  ];

  const titleType = isAdmissionVisit
    ? "Admission"
    : `Follow-up · Week ${d.week || "—"}`;

  return (
    <ConditionEntryShell
      patient={p}
      patientEncs={patientEncs}
      sidebarDiseases={[{ id: MAL_ID, name: MAL_NAME }]}
      title={`${MAL_NAME} — ${titleType}`}
      context={`${facility} · Case #${caseNo} · ${ageMonthsToLabel(ageMonths)}${!isAdmissionVisit && d.week ? ` · Week ${d.week}` : ""}`}
      preface={
        <>
          <div
            className="rounded-lg border-2 border-primary bg-secondary px-4 py-3"
            data-testid="mal-entering-week"
          >
            <p className="text-base font-bold text-primary">
              {isAdmissionVisit ? "Entering: Admission" : `Entering: Follow-up · Week ${d.week || "—"}`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isAdmissionVisit
                ? "First encounter for this malnutrition case"
                : `Recording monitoring for week ${d.week || "—"} of 12`}
            </p>
          </div>
          {grade.level ? (
            <div className={`rounded-lg border px-4 py-3 ${alertCls[grade.level]}`} data-testid="mal-risk-banner">
              <p className="text-sm font-bold">
                Risk status · {grade.label} grading · {grade.type || seededCase.admissionType}
              </p>
              <p className="mt-0.5 text-xs opacity-90">
                {d.visitType === "Admission" ? "Admission visit" : `Follow-up · Week ${d.week || "—"}`}
                {weeksVisited > 0 ? ` · ${weeksVisited} week${weeksVisited === 1 ? "" : "s"} recorded` : ""}
              </p>
            </div>
          ) : null}
        </>
      }
      sections={sections}
      onSave={persist}
      savedAt={savedAt}
      backTo={() => navigate(`/patients/${p.id}?tab=malnutrition`)}
    />
  );
}
