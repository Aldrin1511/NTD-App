import { Fragment, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertPanel } from "@/components/Fields";
import { fmtDate, fmtDateTime, groupDiseaseEpisodes, visitLabel } from "@/mock/specs";
import {
  ANTENATAL_ID, resolveDating, trimesterLabel, trimesterOf, gaFromEdd, MOTHER_VITALS, MOTHER_VITAL_CHOICES,
  FETAL_VITALS, FETAL_VITAL_CHOICES, vitalStatus, ANC_IMMUNIZATION, immunizationDueDate, isImmunizationOverdue,
  isAncEpisodeClosed, babyName, ancStatusColor, ancRiskLevel, PHYSICAL_EXAM_FIELDS,
} from "@/mock/antenatal";
import { ImmunizationDashCards } from "@/components/ImmunizationCards";
import { ancMedicationRows } from "@/components/AntenatalMedications";
import { ChevronDown, Pencil, Plus, Baby, Activity } from "lucide-react";

const chip = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", "": "text-foreground" };

const splitDateTime = (v) => {
  if (!v) return { date: "—", time: "" };
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return { date: String(v), time: "" };
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  const date = `${d.getDate()} ${m} ${d.getFullYear()}`;
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  return { date, time };
};

/** Two-line date/time for table column headers. */
const DateTimeStack = ({ value, className = "" }) => {
  const { date, time } = splitDateTime(value);
  return (
    <span className={`inline-flex flex-col items-end leading-tight ${className}`}>
      <span>{date}</span>
      {time ? <span className="text-xs font-medium text-muted-foreground">{time}</span> : null}
    </span>
  );
};

/** Recharts X-axis tick: date on line 1, time on line 2. */
const DateTimeAxisTick = ({ x, y, payload }) => {
  const raw = payload?.value;
  let date = "";
  let time = "";
  if (typeof raw === "string" && raw.includes("|")) {
    [date, time] = raw.split("|");
  } else {
    const parts = splitDateTime(raw);
    date = parts.date;
    time = parts.time;
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" dy={12} fontSize={10} fill="#64748b">{date}</text>
      {time ? <text textAnchor="middle" dy={24} fontSize={9} fill="#94a3b8">{time}</text> : null}
    </g>
  );
};

const fmtVitalVal = (v, step) => {
  if (v === undefined || v === null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (step != null && step < 1) return (Math.round(n * 10) / 10).toFixed(1);
  return String(n);
};

/** Parameters as rows, visit dates as columns — same layout as growth chart table. */
const VitalsParamTable = ({ params, visits, getMeasures, testid }) => {
  const cols = [...visits].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return (
    <div className="overflow-x-auto rounded-md border border-border" data-testid={testid}>
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/60 text-left">
            <th className="sticky left-0 bg-muted/60 px-3 py-2.5 text-sm font-semibold text-foreground">Parameters</th>
            {cols.map((col) => (
              <th key={col.id || col.date} className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-semibold text-foreground">
                <DateTimeStack value={col.date} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={p.k} className={`border-b border-border/70 ${i % 2 === 1 ? "bg-muted/30" : "bg-white"}`}>
              <td className={`sticky left-0 px-3 py-2.5 ${i % 2 === 1 ? "bg-muted/30" : "bg-white"}`}>
                <div className="flex items-start gap-2">
                  <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
                  <div>
                    <p className="font-semibold leading-tight text-foreground">{p.label}{p.unit ? ` (${p.unit})` : ""}</p>
                    {p.sub ? <p className="text-xs text-muted-foreground">{p.sub}</p> : null}
                  </div>
                </div>
              </td>
              {cols.map((col) => {
                const measures = getMeasures(col) || {};
                const raw = measures[p.k];
                const display = p.numeric ? fmtVitalVal(raw, p.step ?? 0.1) : (raw === undefined || raw === null || raw === "" ? "" : String(raw));
                const st = p.field ? vitalStatus(p.field, raw) : "";
                return (
                  <td key={col.id || col.date} className={`px-4 py-2.5 text-right tabular-nums font-medium ${chip[st] || "text-foreground"}`}>
                    {display === "" ? <span className="text-muted-foreground">—</span> : display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const FeatureCard = ({ title, count, lastAt, children, testid, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-border bg-white" data-testid={testid}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left" data-testid={`${testid}-toggle`}>
        <h2 className="min-w-0 flex-1 font-head text-lg font-semibold">{title}</h2>
        {lastAt && <span className="truncate text-xs font-medium text-muted-foreground">{lastAt}</span>}
        {count != null && <Badge variant="outline" className="rounded">{count} entr{count === 1 ? "y" : "ies"}</Badge>}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </section>
  );
};

const VisitHead = ({ v, onEdit, canEdit, section, testid }) => (
  <div className="mb-2 flex items-start justify-between gap-2">
    <p className="text-xs font-semibold text-primary">{fmtDateTime(v.date)} · {v.worker} · {v.type}</p>
    {canEdit && onEdit && (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-primary"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(v, section);
        }}
        data-testid={testid || `anc-edit-${v.id}`}
        aria-label="Edit visit"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    )}
  </div>
);

/** 1-based section indexes in AntenatalEncounter. */
export const ANC_SECTIONS = {
  case: 1,
  history: 2,
  risk: 3,
  motherVitals: 4,
  fetalVitals: 5,
  lab: 6,
  radiology: 7,
  drugs: 8,
  immunization: 9,
  notes: 10,
  delivery: 11,
  newborn: 12,
  outcome: 13,
};

const statusBadgeCls = {
  green: "border-green-300 bg-green-50 text-green-700",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  red: "border-red-300 bg-red-50 text-red-700",
  primary: "border-primary/30 bg-secondary text-primary",
};

export default function AntenatalDashboard({ patient, encounters, canEdit, onEdit, onAddVisit }) {
  const episodes = useMemo(() => groupDiseaseEpisodes(encounters, ANTENATAL_ID, null), [encounters]);
  const [sel, setSel] = useState(episodes[0]?.id || "");
  const episode = episodes.find((e) => e.id === sel) || episodes[0];
  const visits = useMemo(() => [...(episode?.visits || [])].sort((a, b) => String(b.date).localeCompare(String(a.date))), [episode]);

  if (!episode) {
    return <AlertPanel level="info" title="No Ante Natal data yet" testid="anc-empty">Add an encounter and choose Ante Natal to start this record.</AlertPanel>;
  }

  const latest = visits[0];
  const dating = resolveDating(latest?.data?.caseDetails || {});
  const firstVisit = [...visits].sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  const firstContact = firstVisit?.data?.caseDetails?.firstContact || firstVisit?.date;
  const lmp = latest?.data?.caseDetails?.lmp;
  const closed = isAncEpisodeClosed(episode.outcome);
  const status = episode.outcome || latest?.data?.outcome?.status || "Active";
  const risks = latest?.data?.history?.riskFactors || [];
  const riskLvl = ancRiskLevel(risks);
  const medicalAll = latest?.data?.history?.medical || [];
  const menstrual = latest?.data?.history?.menstrual || {};

  const withData = (key) => visits.filter((v) => {
    const x = v.data?.[key];
    if (Array.isArray(x)) return x.length > 0;
    if (x && typeof x === "object") return Object.keys(x).length > 0;
    return !!x;
  });

  const caseVisits = visits.filter((v) => v.data?.caseDetails && Object.keys(v.data.caseDetails).length);
  const histVisits = visits.filter((v) => v.data?.history && (v.data.history.medical?.length || Object.keys(v.data.history.menstrual || {}).length));
  const motherVitalsVisits = visits.filter((v) => Object.keys(v.data?.vitals?.mother || {}).length);
  const fetalVitalsVisits = visits.filter((v) => Object.keys(v.data?.vitals?.fetal || {}).length);
  const weightGraph = [...motherVitalsVisits]
    .filter((v) => v.data?.vitals?.mother?.weight !== undefined && v.data?.vitals?.mother?.weight !== "" && v.data?.vitals?.mother?.weight !== null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((v) => {
      const { date, time } = splitDateTime(v.date);
      return {
        label: time ? `${date}|${time}` : date,
        dateLabel: date,
        timeLabel: time,
        weight: Math.round(Number(v.data.vitals.mother.weight) * 10) / 10,
      };
    });
  const labRowFilled = (row) => !!(
    String(row?.result || "").trim()
    || String(row?.analyte || "").trim()
    || row?.sentToLab
    || row?.completed
  );
  const labVisits = visits
    .map((v) => ({ ...v, data: { ...v.data, lab: (v.data?.lab || []).filter(labRowFilled) } }))
    .filter((v) => v.data.lab.length > 0);
  const radVisits = withData("radiology");
  const drugVisits = withData("drugs");
  const deliveryVisits = visits.filter((v) => v.data?.delivery?.date || v.data?.delivery?.type || (v.data?.delivery?.babies || []).length);
  // Legacy visit-level exam OR any baby with physicalExam
  const examVisits = visits.filter((v) => {
    if (v.data?.physicalExam && Object.keys(v.data.physicalExam).some((k) => v.data.physicalExam[k])) return true;
    return (v.data?.delivery?.babies || []).some((b) => b.physicalExam && Object.keys(b.physicalExam).some((k) => b.physicalExam[k]));
  });
  const noteVisits = visits.filter((v) => (v.data?.notes || []).some((n) => String(n).trim()));
  const outcomeVisits = visits.filter((v) => v.data?.outcome?.status);

  const byTrimester = { 1: [], 2: [], 3: [] };
  visits.forEach((v) => {
    const ga = gaFromEdd(resolveDating(v.data?.caseDetails || {}).finalEdd, v.date);
    const t = ga ? trimesterOf(ga.weeks) : null;
    if (t) byTrimester[t].push({ v, ga });
  });

  const mergedImmun = {};
  visits.forEach((v) => Object.entries(v.data?.immunization || {}).forEach(([k, val]) => { if (val?.given) mergedImmun[k] = val; }));
  const immunEditVisit = visits.find((v) => Object.values(v.data?.immunization || {}).some((x) => x?.given)) || latest;

  const cd = latest?.data?.caseDetails || {};

  return (
    <div className="space-y-4" data-testid="anc-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-secondary px-4 py-3" data-testid="anc-episode-summary">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Pregnancy episode · {visitLabel(episode.visitCount)}</p>
            {episodes.length > 1 && (
              <select value={sel} onChange={(e) => setSel(e.target.value)} data-testid="anc-episode-select" className="rounded-md border border-input bg-white px-2 py-1 text-xs font-semibold">
                {episodes.map((ep, i) => <option key={ep.id} value={ep.id}>Episode {episodes.length - i}</option>)}
              </select>
            )}
            <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeCls[ancStatusColor(status)] || statusBadgeCls.green}`} data-testid="anc-episode-status">
              {closed ? status : "Active"}
            </Badge>
            {risks.length > 0 && (
              <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${riskLvl === "high" ? statusBadgeCls.red : statusBadgeCls.amber}`} data-testid="anc-risk-badge">
                Risk · {risks.length}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">Start: {fmtDate(episode.start)} · Latest: {fmtDate(episode.last)}</p>
        </div>
        {canEdit && !closed && (
          <Button className="h-10 shrink-0" onClick={onAddVisit} data-testid="anc-add-visit"><Plus className="mr-1 h-4 w-4" /> ANC visit</Button>
        )}
      </div>

      {risks.length > 0 && (
        <section className={`rounded-lg border px-4 py-3 ${riskLvl === "high" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`} data-testid="anc-feat-risk">
          <p className={`text-sm font-semibold ${riskLvl === "high" ? "text-red-800" : "text-amber-900"}`}>Risk factors · {risks.length}</p>
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="anc-risk-list">
            {risks.map((r) => (
              <li key={r} className={`rounded-md border px-2.5 py-1 text-sm font-semibold ${riskLvl === "high" ? "border-red-200 bg-white text-red-700" : "border-amber-200 bg-white text-amber-900"}`}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="rounded-lg border border-primary/25 bg-secondary p-3" data-testid="anc-dash-dating">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primary">Gestational age (latest)</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-white p-2.5" data-testid="anc-dash-ga-lmp">
            <p className="text-[11px] font-semibold text-muted-foreground">From LMP (auto)</p>
            <p className="mt-0.5 text-base font-bold">GA {dating.lmpGa?.text || "—"}</p>
            <p className="text-xs text-muted-foreground">EDD {dating.lmpEdd ? fmtDate(dating.lmpEdd) : "—"}</p>
          </div>
          <div className={`rounded-md border bg-white p-2.5 ${dating.scanEdd ? "border-border" : "border-dashed border-border/60 opacity-60"}`} data-testid="anc-dash-ga-scan">
            <p className="text-[11px] font-semibold text-muted-foreground">From Scan</p>
            <p className="mt-0.5 text-base font-bold">GA {dating.scanGa?.text || "—"}</p>
            <p className="text-xs text-muted-foreground">EDD {dating.scanEdd ? fmtDate(dating.scanEdd) : "—"}</p>
          </div>
          <div className="rounded-md border-2 border-primary bg-white p-2.5" data-testid="anc-dash-ga-final">
            <p className="text-[11px] font-semibold text-primary">Final (clinician)</p>
            <p className="mt-0.5 text-base font-bold">GA {dating.finalGa?.text || "—"}</p>
            <p className="text-xs text-muted-foreground">EDD {dating.finalEdd ? fmtDate(dating.finalEdd) : "—"} · {trimesterLabel(dating.trimester)}</p>
          </div>
        </div>
      </div>

      <FeatureCard title="ANC visits by trimester" count={visits.length} testid="anc-feat-visits">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((t) => (
            <div key={t}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{trimesterLabel(t)}</p>
              <div className="space-y-2">
                {byTrimester[t].length === 0 && <p className="text-sm text-muted-foreground">No visits</p>}
                {byTrimester[t].map(({ v, ga }) => (
                  <button key={v.id} type="button" onClick={() => canEdit && onEdit?.(v)} className="w-full rounded-md border border-border bg-white p-2 text-left hover:bg-muted" data-testid={`anc-visit-chip-${v.id}`}>
                    <p className="text-sm font-semibold">{fmtDate(v.date)}</p>
                    <p className="text-xs text-muted-foreground">GA {ga?.text || "—"} · {v.type}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </FeatureCard>

      {caseVisits[0] && (
        <FeatureCard title="Case details" count={caseVisits.length} lastAt={fmtDateTime(caseVisits[0].date)} testid="anc-feat-case">
          <VisitHead v={caseVisits[0]} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.case} testid={`anc-case-edit-${caseVisits[0].id}`} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm" data-testid="anc-gpla-summary">
            {[
              ["Gravida (G)", cd.g ?? cd.gravida],
              ["Para (P)", cd.p ?? cd.para],
              ["Living (L)", cd.l ?? cd.living],
              ["Abortions (A)", cd.a ?? cd.abortions],
            ].map(([label, val]) => (
              <div key={label} className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
                <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-base font-bold">{val === undefined || val === null || val === "" ? "—" : String(val)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Neonatal death: {cd.neonatalDeath ?? "—"} · Still birth: {cd.stillBirth ?? "—"} · Term birth: {cd.termBirth ?? "—"}
            {cd.coupleCounselling ? ` · Counselling: ${cd.coupleCounselling}` : ""}
            {cd.lmpConfirmed ? " · LMP confirmed" : ""}
          </p>
        </FeatureCard>
      )}

      {(medicalAll.length > 0 || Object.keys(menstrual).length > 0 || histVisits[0]) && (
        <FeatureCard title="History" count={histVisits.length || undefined} lastAt={histVisits[0] ? fmtDateTime(histVisits[0].date) : undefined} testid="anc-feat-history">
          {histVisits[0] && <VisitHead v={histVisits[0]} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.history} testid={`anc-hist-edit-${histVisits[0].id}`} />}
          {medicalAll.length > 0 && (
            <div className="mb-3" data-testid="anc-medical-list">
              <p className="mb-1.5 text-sm font-semibold">Medical history</p>
              <p className="text-sm text-muted-foreground">{medicalAll.join(" · ")}</p>
            </div>
          )}
          {Object.keys(menstrual).length > 0 && (
            <div data-testid="anc-menstrual-summary">
              <p className="mb-1.5 text-sm font-semibold">Menstrual history</p>
              <p className="text-sm text-muted-foreground">
                {[
                  menstrual.lmp ? `LMP ${fmtDate(menstrual.lmp)}` : null,
                  menstrual.menarche ? `Menarche ${menstrual.menarche}y` : null,
                  menstrual.amenorrhea ? `Amenorrhea: ${menstrual.amenorrhea}` : null,
                  menstrual.imb ? `IMB: ${menstrual.imb}` : null,
                  menstrual.dysmenorrhea ? `Dysmenorrhea: ${menstrual.dysmenorrhea}` : null,
                  menstrual.flow ? `Flow: ${menstrual.flow}` : null,
                  menstrual.cycleDuration ? `Duration ${menstrual.cycleDuration}d` : null,
                  menstrual.cycleLength ? `Length ${menstrual.cycleLength}d` : null,
                  menstrual.regularity || null,
                ].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          )}
        </FeatureCard>
      )}

      {motherVitalsVisits.length > 0 && (
        <FeatureCard title="Mother vitals" count={motherVitalsVisits.length} lastAt={fmtDateTime(motherVitalsVisits[0].date)} testid="anc-feat-mother-vitals">
          <VisitHead v={motherVitalsVisits[0]} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.motherVitals} testid={`anc-mv-edit-${motherVitalsVisits[0].id}`} />
          {weightGraph.length > 0 && (
            <div className="mb-4 h-64 w-full rounded-lg border border-border bg-white p-2" data-testid="anc-weight-graph">
              <p className="mb-1 px-1 text-xs font-semibold text-muted-foreground">Weight (kg)</p>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={weightGraph} margin={{ top: 8, right: 28, bottom: 28, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef" />
                  <XAxis dataKey="label" tick={<DateTimeAxisTick />} interval={0} height={40} padding={{ left: 16, right: 16 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} unit=" kg" width={48} />
                  <Tooltip
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload;
                      if (!p) return "";
                      return p.timeLabel ? `${p.dateLabel} · ${p.timeLabel}` : p.dateLabel;
                    }}
                    formatter={(v) => [`${Number(v).toFixed(1)} kg`, "Weight"]}
                  />
                  <Line type="monotone" dataKey="weight" name="Weight" stroke="#0F52BA" strokeWidth={2.5} connectNulls dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <VitalsParamTable
            testid="anc-mother-vitals-table"
            visits={motherVitalsVisits}
            getMeasures={(v) => v.data?.vitals?.mother}
            params={[
              ...MOTHER_VITALS.map((f) => ({ k: f.k, label: f.label, unit: f.unit, field: f, numeric: true, step: f.step, sub: f.normal ? `Normal ${f.normal[0]}–${f.normal[1]}` : "" })),
              ...MOTHER_VITAL_CHOICES.map((c) => ({ k: c.k, label: c.label, numeric: false })),
            ]}
          />
        </FeatureCard>
      )}

      {fetalVitalsVisits.length > 0 && (
        <FeatureCard title="Fetal vitals" count={fetalVitalsVisits.length} lastAt={fmtDateTime(fetalVitalsVisits[0].date)} testid="anc-feat-fetal-vitals">
          <VisitHead v={fetalVitalsVisits[0]} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.fetalVitals} testid={`anc-fv-edit-${fetalVitalsVisits[0].id}`} />
          <VitalsParamTable
            testid="anc-fetal-vitals-table"
            visits={fetalVitalsVisits}
            getMeasures={(v) => v.data?.vitals?.fetal}
            params={[
              ...FETAL_VITALS.map((f) => ({ k: f.k, label: f.label, unit: f.unit, field: f, numeric: true, step: f.step, sub: f.normal ? `Normal ${f.normal[0]}–${f.normal[1]}` : "" })),
              ...FETAL_VITAL_CHOICES.map((c) => ({ k: c.k, label: c.label, numeric: false })),
            ]}
          />
        </FeatureCard>
      )}

      {labVisits.length > 0 && (
        <FeatureCard title="Laboratory" count={labVisits.reduce((n, v) => n + v.data.lab.length, 0)} lastAt={fmtDateTime(labVisits[0].date)} testid="anc-feat-lab">
          <div className="space-y-4">
            {labVisits.map((v) => (
              <div key={v.id} data-testid={`anc-lab-visit-${v.id}`}>
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.lab} testid={`anc-lab-edit-${v.id}`} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="py-1.5 pr-3 font-semibold">Test</th>
                        <th className="py-1.5 pr-3 font-semibold">Result</th>
                        <th className="py-1.5 pr-3 font-semibold">Value</th>
                        <th className="py-1.5 pr-3 font-semibold">Location</th>
                        <th className="py-1.5 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.data.lab.map((row, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          <td className="py-1.5 pr-3 font-medium">{row.test}</td>
                          <td className="py-1.5 pr-3">{row.result || (row.sentToLab ? "Sent" : "—")}</td>
                          <td className="py-1.5 pr-3 tabular-nums">{row.analyte || "—"}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">
                            {row.location || "—"}
                            {row.sentToLab ? " · sent" : ""}
                          </td>
                          <td className="py-1.5 whitespace-nowrap text-muted-foreground">{row.date ? fmtDate(row.date) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </FeatureCard>
      )}

      {radVisits.length > 0 && (
        <FeatureCard title="Radiology" count={radVisits.reduce((n, v) => n + v.data.radiology.length, 0)} lastAt={fmtDateTime(radVisits[0].date)} testid="anc-feat-radiology">
          <div className="space-y-3">
            {radVisits.map((v) => (
              <div key={v.id}>
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.radiology} testid={`anc-rad-edit-${v.id}`} />
                {v.data.radiology.map((row, i) => (
                  <div key={i} className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                    <p className="font-semibold">{row.scan || "Scan"} · <span className="font-normal text-muted-foreground">{row.date ? fmtDate(row.date) : ""}{row.edd ? ` · EDD ${fmtDate(row.edd)}` : ""}</span></p>
                    {(row.comments || row.findings) && <p className="mt-0.5 whitespace-pre-line">{row.comments || row.findings}</p>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </FeatureCard>
      )}

      {drugVisits.length > 0 && (
        <FeatureCard title="Medications" count={drugVisits.reduce((n, v) => n + (v.data?.drugs?.length || 0), 0)} lastAt={fmtDateTime(drugVisits[0].date)} testid="anc-feat-drugs">
          <div className="space-y-4">
            {drugVisits.map((v) => {
              const rows = ancMedicationRows(v);
              return (
                <div key={v.id} data-testid={`anc-meds-visit-${v.id}`}>
                  <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.drugs} testid={`anc-meds-edit-${v.id}`} />
                  <div className="overflow-x-auto" data-testid={`anc-meds-table-${v.id}`}>
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="py-2 pr-3 font-semibold">Name</th>
                          <th className="py-2 pr-3 font-semibold">Dosage</th>
                          <th className="py-2 pr-3 font-semibold">Frequency</th>
                          <th className="py-2 pr-3 font-semibold">Duration</th>
                          <th className="py-2 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <Fragment key={`${row.name}-${i}`}>
                            <tr className="border-b border-border/70 align-top">
                              <td className="py-2 pr-3 font-medium">{row.name}</td>
                              <td className="py-2 pr-3">{row.dosage}</td>
                              <td className="py-2 pr-3">{row.frequency}</td>
                              <td className="py-2 pr-3">{row.duration}</td>
                              <td className="py-2 whitespace-nowrap">{row.date ? fmtDate(row.date) : "—"}</td>
                            </tr>
                            {row.advice ? (
                              <tr className="border-b border-border">
                                <td colSpan={5} className="pb-2 pt-0 text-xs text-muted-foreground">
                                  <span className="font-semibold">Advice:</span> {row.advice}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </FeatureCard>
      )}

      <FeatureCard title="Immunization" count={Object.keys(mergedImmun).length} testid="anc-feat-immunization">
        {immunEditVisit && <VisitHead v={immunEditVisit} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.immunization} testid={`anc-immun-edit-${immunEditVisit.id}`} />}
        <div data-testid="anc-dash-immunization">
          <ImmunizationDashCards
            vaccines={ANC_IMMUNIZATION}
            records={mergedImmun}
            getDue={(item) => immunizationDueDate(item, firstContact, lmp)}
            getOverdue={(item, rec) => isImmunizationOverdue(item, rec, firstContact, lmp)}
            testidPrefix="anc-dash-vac"
          />
        </div>
      </FeatureCard>

      {deliveryVisits.length > 0 && (
        <FeatureCard title="Delivery & new born" count={deliveryVisits.length} testid="anc-feat-delivery">
          {deliveryVisits.map((v) => {
            const del = v.data.delivery || {};
            return (
              <div key={v.id} className="space-y-2 border-b border-border/60 py-2 last:border-0">
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.delivery} testid={`anc-del-edit-${v.id}`} />
                <p className="text-sm"><b>Delivery:</b> {del.date ? fmtDate(del.date) : "—"} · {del.type || del.mode || "—"} · {del.outcome || "—"} · Fetuses {del.fetuses || (del.babies || []).length || "—"}</p>
                {del.complication && <p className="text-sm text-muted-foreground">Complication: {del.complication}</p>}
                {(del.postpartum || []).length > 0 && <p className="text-sm text-muted-foreground">Postpartum: {del.postpartum.join(" · ")}</p>}
                {(del.babies || []).map((b, i) => {
                  const exam = b.physicalExam || {};
                  const examChips = PHYSICAL_EXAM_FIELDS.filter((f) => exam[f.k]);
                  return (
                    <div key={i} className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Baby className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{babyName(patient.name, i, del.babies.length)}</span>
                        <span className="text-muted-foreground">{b.sex || "—"} · {b.weightKg ? `${b.weightKg} kg` : "—"} · HC {b.headCm || "—"} · APGAR {b.apgar1 || "—"}/{b.apgar5 || "—"}/{b.apgar10 || "—"} · {b.outcome || "—"}</span>
                        {b.registered && <Badge variant="outline" className="rounded">Registered · {b.patientId}</Badge>}
                      </div>
                      {examChips.length > 0 && (
                        <div className="flex flex-wrap gap-2" data-testid={`anc-dash-baby-exam-${v.id}-${i}`}>
                          <span className="text-xs font-semibold text-muted-foreground">Exam:</span>
                          {examChips.map((f) => (
                            <span key={f.k} className="rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold">{f.label}: {exam[f.k]}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </FeatureCard>
      )}

      {examVisits.length > 0 && !deliveryVisits.some((v) => (v.data?.delivery?.babies || []).some((b) => b.physicalExam && Object.keys(b.physicalExam).some((k) => b.physicalExam[k]))) && (
        <FeatureCard title="Physical examination" count={examVisits.length} lastAt={fmtDateTime(examVisits[0].date)} testid="anc-feat-exam">
          {examVisits.map((v) => (
            <div key={v.id} className="border-b border-border/60 py-2 last:border-0">
              <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.newborn} testid={`anc-exam-edit-${v.id}`} />
              <div className="mt-1 flex flex-wrap gap-2">
                {PHYSICAL_EXAM_FIELDS.filter((f) => v.data.physicalExam?.[f.k]).map((f) => (
                  <span key={f.k} className="rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold">{f.label}: {v.data.physicalExam[f.k]}</span>
                ))}
              </div>
            </div>
          ))}
        </FeatureCard>
      )}

      {noteVisits.length > 0 && (
        <FeatureCard title="Visit notes" count={noteVisits.length} lastAt={fmtDateTime(noteVisits[0].date)} testid="anc-feat-notes">
          <div className="space-y-2">
            {noteVisits.map((v) => (
              <div key={v.id}>
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={ANC_SECTIONS.notes} testid={`anc-note-edit-${v.id}`} />
                {(v.data.notes || []).filter((n) => String(n).trim()).map((n, i) => <p key={i} className="mt-1 whitespace-pre-line text-sm font-medium">{n}</p>)}
              </div>
            ))}
          </div>
        </FeatureCard>
      )}

      {outcomeVisits.length > 0 && (
        <FeatureCard title="Case outcome" count={outcomeVisits.length} testid="anc-feat-outcome">
          <div className="space-y-2">
            {outcomeVisits.map((v) => (
              <div
                key={v.id}
                className="flex items-start justify-between gap-2 rounded-md border border-border bg-white px-3 py-2.5"
                data-testid={`anc-outcome-${v.id}`}
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold leading-snug">{v.data.outcome.status || "—"}</p>
                  {v.data.outcome.note ? (
                    <p className="text-sm leading-snug text-muted-foreground">{v.data.outcome.note}</p>
                  ) : null}
                  <p className="text-xs font-semibold leading-snug text-primary">
                    {fmtDateTime(v.date)} · {v.worker} · {v.type}
                  </p>
                </div>
                {canEdit && onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(v, ANC_SECTIONS.outcome);
                    }}
                    data-testid={`anc-outcome-edit-${v.id}`}
                    aria-label="Edit visit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </FeatureCard>
      )}
    </div>
  );
}
