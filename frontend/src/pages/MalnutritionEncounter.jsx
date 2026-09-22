import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Field, TextField, AreaField, SelectField, AlertPanel, ChoiceRow } from "@/components/Fields";
import { ConditionEntryShell, SliderStat, ChoiceChips, YesNo } from "@/components/EntryKit";
import { dobFromAge } from "@/components/Capture";
import { monthsBetween, ageMonthsToLabel, percentileLabel } from "@/mock/growth";
import { localISODate } from "@/mock/specs";
import { GEO } from "@/mock/data";
import {
  MAL_ID, MAL_NAME, CASE_TYPES, ADMISSION_TYPES, VISIT_TYPES, APPETITE, OEDEMA, RR_BANDS, TEMP_OPTS,
  DANGER_SIGNS, HISTORY, ROUTINE_MEDS, OUTCOMES, malIndices, monitoringAlert, newMalEpisodeId,
} from "@/mock/malnutrition";
import { toast } from "sonner";

const ANTHRO = [
  { k: "weight", label: "Current weight", unit: "kg", min: 2, max: 40, step: 0.1 },
  { k: "targetWeight", label: "Target weight", unit: "kg", min: 2, max: 40, step: 0.1 },
  { k: "height", label: "Height / length", unit: "cm", min: 40, max: 150, step: 0.5 },
  { k: "muac", label: "MUAC", unit: "cm", min: 7, max: 25, step: 0.1 },
];
const alertCls = { red: "border-red-500 bg-red-50 text-red-800", amber: "border-amber-500 bg-amber-50 text-amber-800", green: "border-green-500 bg-green-50 text-green-800" };
const empty = () => ({ visitType: "Admission", week: "", caseDetails: {}, weight: "", targetWeight: "", height: "", muac: "", oedema: "None", appetite: "Not done", dangerSigns: {}, history: {}, rr: "", temp: "", meds: [], rutf: "", medOther: "", outcome: { status: "" } });

export default function MalnutritionEncounter() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { patients, encounters, saveEncounter, user, online } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.id === params.get("enc") && e.disease === MAL_ID);
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  const [d, setD] = useState(() => ({ ...empty(), ...(existing?.data || {}) }));
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const facility = existing?.facility || params.get("fac") || p?.facility || "";

  const dob = p?.dob || dobFromAge(p?.age, p?.createdAt);
  const ageMonths = monthsBetween(dob, existing?.date || localISODate());
  const sex = p?.sex || p?.gender;

  const prevMonitoring = useMemo(() => patientEncs.filter((e) => e.disease === MAL_ID && e.id !== existing?.id).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-1)[0]?.data, [patientEncs, existing]);
  const caseNo = useMemo(() => {
    if (existing?.data?.caseDetails?.caseNo) return existing.data.caseDetails.caseNo;
    const eps = new Set(encounters.filter((e) => e.disease === MAL_ID && e.facility === facility).map((e) => e.episodeId));
    return eps.size + 1;
  }, [encounters, facility, existing]);

  if (!p) return <div className="p-8">Patient not found. <Button onClick={() => navigate("/patients")}>Back</Button></div>;

  const set = (k, v) => setD((s) => ({ ...s, [k]: v }));
  const setCase = (patch) => setD((s) => ({ ...s, caseDetails: { ...s.caseDetails, ...patch } }));
  const setDanger = (k, v) => setD((s) => ({ ...s, dangerSigns: { ...s.dangerSigns, [k]: v } }));
  const setHist = (k, v) => setD((s) => ({ ...s, history: { ...s.history, [k]: v } }));
  const toggleMed = (m) => setD((s) => ({ ...s, meds: s.meds.includes(m) ? s.meds.filter((x) => x !== m) : [...s.meds, m] }));

  const idx = malIndices({ weight: d.weight, height: d.height, ageMonths, sex });
  const alert = monitoringAlert(d, prevMonitoring);

  const persist = (close) => {
    const episodeId = existing?.episodeId || patientEncs.filter((e) => e.disease === MAL_ID)[0]?.episodeId || newMalEpisodeId();
    const type = d.visitType === "Monitoring" ? `Monitoring${d.week ? ` · Week ${d.week}` : ""}` : "Admission";
    saveEncounter({
      id: existing?.id, patientId: p.id, episodeId, disease: MAL_ID, facility, worker: user?.name, type,
      diagnosis: d.caseDetails.admissionType || "", outcome: d.outcome?.status || "",
      data: { ...d, caseDetails: { ...d.caseDetails, caseNo, admissionDate: d.caseDetails.admissionDate || localISODate() }, indices: idx, alert, ageMonths },
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

  const sections = [
    {
      title: "Visit & case details", done: !!d.caseDetails.caseType || d.visitType === "Monitoring",
      body: (
        <div className="space-y-4">
          <ChoiceRow label="Visit type" options={VISIT_TYPES} value={d.visitType} onChange={(v) => set("visitType", v)} testid="mal-visit-type" />
          {d.visitType === "Monitoring" && <TextField label="Week number" type="number" value={d.week} onChange={(e) => set("week", e.target.value)} testid="mal-week" hint="1–12 (add more weeks as needed)" />}
          {d.visitType === "Admission" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Case type" options={CASE_TYPES} value={d.caseDetails.caseType || ""} onChange={(v) => setCase({ caseType: v })} testid="mal-case-type" />
              {d.caseDetails.caseType === "Transfer in" && <TextField label="Transferred from (facility)" value={d.caseDetails.fromFacility || ""} onChange={(e) => setCase({ fromFacility: e.target.value })} testid="mal-from-facility" />}
              <SelectField label="Admission type" options={ADMISSION_TYPES} value={d.caseDetails.admissionType || ""} onChange={(v) => setCase({ admissionType: v })} testid="mal-admission-type" />
              {d.caseDetails.admissionType === "Others" && <TextField label="Specify" value={d.caseDetails.admissionOther || ""} onChange={(e) => setCase({ admissionOther: e.target.value })} testid="mal-admission-other" />}
              <TextField label="Admission date" type="date" value={d.caseDetails.admissionDate || localISODate()} onChange={(e) => setCase({ admissionDate: e.target.value })} testid="mal-admission-date" />
              <TextField label="Admission age" value={ageMonthsToLabel(ageMonths)} readOnly testid="mal-age" />
              <TextField label="Gender" value={sex || "—"} readOnly testid="mal-gender" />
              <TextField label="Case no. (this facility)" value={`#${caseNo}`} readOnly testid="mal-case-no" />
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Anthropometry & assessment", done: !!d.weight,
      body: (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {ANTHRO.map((f) => <SliderStat key={f.k} field={f} value={d[f.k]} onChange={(v) => set(f.k, v)} testid={`mal-${f.k}`} />)}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <IndexBadge label="Weight-for-age" r={idx.wfa} />
            <IndexBadge label="Weight-for-height" r={idx.wfh} />
            <IndexBadge label="Height-for-age" r={idx.hfa} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceChips label="Oedema" options={OEDEMA} value={d.oedema} onChange={(v) => set("oedema", v)} testid="mal-oedema" />
            <ChoiceChips label="Appetite test" options={APPETITE} value={d.appetite} onChange={(v) => set("appetite", v)} testid="mal-appetite" />
          </div>

          <div>
            <p className="mb-2 font-head text-sm font-semibold text-primary">General danger signs</p>
            <div className="grid gap-3 sm:grid-cols-2">{DANGER_SIGNS.map((s) => <YesNo key={s.k} label={s.label} value={d.dangerSigns[s.k]} onChange={(v) => setDanger(s.k, v)} testid={`mal-ds-${s.k}`} />)}</div>
          </div>

          <div>
            <p className="mb-2 font-head text-sm font-semibold text-primary">History</p>
            <div className="grid gap-3 sm:grid-cols-2">{HISTORY.map((h) => h.type === "textarea" ? <div key={h.k} className="sm:col-span-2"><AreaField label={h.label} rows={2} value={d.history[h.k] || ""} onChange={(e) => setHist(h.k, e.target.value)} testid={`mal-hist-${h.k}`} /></div> : <YesNo key={h.k} label={h.label} value={d.history[h.k]} onChange={(v) => setHist(h.k, v)} testid={`mal-hist-${h.k}`} />)}</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceChips label="Respiratory rate (/min)" options={RR_BANDS} value={d.rr} onChange={(v) => set("rr", v)} testid="mal-rr" />
            <ChoiceChips label="Temperature" options={TEMP_OPTS} value={d.temp} onChange={(v) => set("temp", v)} testid="mal-temp" />
          </div>

          <div>
            <ChoiceChips multi label="Routine admission medication" options={ROUTINE_MEDS} value={d.meds} onChange={(v) => set("meds", v)} testid="mal-meds" />
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TextField label="RUTF (number of packets)" type="number" value={d.rutf} onChange={(e) => set("rutf", e.target.value)} testid="mal-rutf" />
              <TextField label="Other medicine (free text)" value={d.medOther} onChange={(e) => set("medOther", e.target.value)} testid="mal-med-other" />
            </div>
          </div>

          <div className={`rounded-lg border p-4 ${alertCls[alert.level]}`} data-testid="mal-alert">
            <p className="text-sm font-bold uppercase">{alert.level === "red" ? "🔴 Red alert" : alert.level === "amber" ? "🟠 Amber alert" : "🟢 Green"} — {alert.action}</p>
            <p className="mt-1 text-sm">{alert.reasons.join(" · ")}</p>
          </div>
        </div>
      ),
    },
    {
      title: "Case outcome", done: !!d.outcome.status,
      body: (
        <div className="space-y-4">
          <ChoiceRow label="Outcome" options={OUTCOMES} value={d.outcome.status} onChange={(v) => set("outcome", { ...d.outcome, status: v })} testid="mal-outcome" />
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
          {(d.outcome.status === "Refused treatment" || d.outcome.status === "Other") && <AreaField label="Details" rows={2} value={d.outcome.note || ""} onChange={(e) => set("outcome", { ...d.outcome, note: e.target.value })} testid="mal-outcome-note" />}
          {d.outcome.status && <AlertPanel level="review" title="Selecting an outcome closes this episode" testid="mal-outcome-close">Except while continuing monitoring, a recorded outcome closes the malnutrition episode.</AlertPanel>}
        </div>
      ),
    },
  ];

  return (
    <ConditionEntryShell
      patient={p} patientEncs={patientEncs} sidebarDiseases={[{ id: MAL_ID, name: MAL_NAME }]}
      title={`${MAL_NAME} — ${d.visitType}${d.visitType === "Monitoring" && d.week ? ` (Week ${d.week})` : ""}`}
      context={`${facility} · Case #${caseNo} · ${ageMonthsToLabel(ageMonths)}`}
      sections={sections} onSave={persist} savedAt={savedAt} backTo={() => navigate(`/patients/${p.id}?tab=malnutrition`)}
    />
  );
}
