import { Fragment, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertPanel } from "@/components/Fields";
import { FeatureCard } from "@/components/EntryKit";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fmtDate, fmtDateTime, groupDiseaseEpisodes } from "@/mock/specs";
import { ageMonthsToLabel } from "@/mock/growth";
import {
  MAL_ID, monitoringAlert, PROGRESS_MATRIX_ROWS, malColorGrade, malDisplayStatus,
  malStatusColor, malWeeksVisited, malLatestWeek, visitWeekNumber, isMalEpisodeClosed, alertGrade,
} from "@/mock/malnutrition";
import { Pencil, Plus } from "lucide-react";

const statusBadgeCls = {
  green: "border-green-300 bg-green-50 text-green-700",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  red: "border-red-300 bg-red-50 text-red-700",
  primary: "border-primary/30 bg-secondary text-primary",
};

const cell = (v) => (v === undefined || v === null || v === "" ? "—" : String(v));

/** Map follow-up visits onto weeks 1–12. */
const buildWeekColumns = (followUps = []) => {
  const byWeek = new Map();
  const unnumbered = [];
  [...followUps]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .forEach((v) => {
      const w = visitWeekNumber(v);
      if (w >= 1 && w <= 12 && !byWeek.has(w)) byWeek.set(w, v);
      else unnumbered.push(v);
    });
  let slot = 1;
  unnumbered.forEach((v) => {
    while (slot <= 12 && byWeek.has(slot)) slot += 1;
    if (slot <= 12) {
      byWeek.set(slot, v);
      slot += 1;
    }
  });
  const cols = [];
  for (let w = 1; w <= 12; w += 1) {
    const v = byWeek.get(w) || null;
    cols.push({ w, v, data: v?.data || null });
  }
  return cols;
};

export default function MalnutritionDashboard({ patient, encounters, canEdit, onEdit, onAddVisit }) {
  const episode = useMemo(() => groupDiseaseEpisodes(encounters, MAL_ID, null)[0], [encounters]);
  const visits = useMemo(
    () => [...(episode?.visits || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [episode],
  );

  if (!episode) {
    return (
      <AlertPanel level="info" title="No Malnutrition data yet" testid="mal-empty">
        Add an encounter and choose Malnutrition to start this record.
      </AlertPanel>
    );
  }

  const admission = visits.find((v) => /admission/i.test(v.data?.visitType || v.type || "")) || visits[0];
  const followUps = visits.filter((v) => v.id !== admission?.id);

  const cd = admission?.data?.caseDetails || {};
  const displayStatus = malDisplayStatus(visits);
  const lastRecordedStatus = visits[visits.length - 1]?.outcome || visits[visits.length - 1]?.data?.outcome?.status || "Active";
  const closed = isMalEpisodeClosed(lastRecordedStatus);
  const recordedOutcome = [...visits].reverse().find((v) => isMalEpisodeClosed(v.outcome || v.data?.outcome?.status));
  const outcome = recordedOutcome?.data?.outcome || (recordedOutcome ? { status: recordedOutcome.outcome } : null);
  const grade = malColorGrade(cd.admissionType);
  const weeksVisited = malWeeksVisited(visits);
  const latestWeek = malLatestWeek(visits);
  const latest = visits[visits.length - 1];
  const latestWeekLabel = visitWeekNumber(latest);
  const isLatestAdmission = latest && /admission/i.test(latest.data?.visitType || latest.type || "");

  const weekCols = buildWeekColumns(followUps);

  const columns = [
    { key: "adm", label: "Adm", visit: admission, data: admission?.data || null },
    ...weekCols.map((c) => ({ key: `w${c.w}`, label: `Week ${c.w}`, w: c.w, visit: c.v, data: c.data })),
  ];

  let prevData = null;
  const columnAlerts = columns.map((col) => {
    if (!col.data) return null;
    const a = monitoringAlert(col.data, prevData);
    prevData = col.data;
    return a;
  });

  const weightGraph = columns
    .filter((c) => c.data?.weight !== undefined && c.data?.weight !== "")
    .map((c) => ({
      x: c.key === "adm" ? "Adm" : c.label.replace("Week ", "W"),
      weight: Number(c.data.weight) || null,
      target: Number(cd.targetWeight) || null,
    }));

  const muacGraph = columns
    .filter((c) => c.data?.muac !== undefined && c.data?.muac !== "")
    .map((c) => ({
      x: c.key === "adm" ? "Adm" : c.label.replace("Week ", "W"),
      muac: Number(c.data.muac) || null,
    }));

  const latestData = latest?.data || {};

  return (
    <div className="space-y-4" data-testid="mal-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-secondary px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Malnutrition · Case #{cd.caseNo || "—"}</p>
            {cd.admissionType && (
              <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeCls[grade.level] || statusBadgeCls.primary}`} data-testid="mal-type-badge">
                {cd.admissionType}{grade.label ? ` · ${grade.label}` : ""}
              </Badge>
            )}
            <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeCls[malStatusColor(displayStatus)]}`} data-testid="mal-status-badge">
              {displayStatus}
            </Badge>
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-bold border-primary/40 bg-white text-primary" data-testid="mal-week-badge">
              {isLatestAdmission
                ? "Latest: Admission"
                : latestWeekLabel != null
                  ? `Latest: Week ${latestWeekLabel}`
                  : latestWeek != null
                    ? `Latest: Week ${latestWeek}`
                    : "No follow-up weeks yet"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">
            Admitted {cd.admissionDate ? fmtDate(cd.admissionDate) : "—"} · {ageMonthsToLabel(admission?.data?.ageMonths)} · {cd.caseType || ""}
            {" · "}Last visit {latest ? fmtDate(latest.date) : "—"}
            {latestWeekLabel != null
              ? ` (Week ${latestWeekLabel})`
              : isLatestAdmission
                ? " (Admission)"
                : weeksVisited > 0
                  ? ` (${weeksVisited} week${weeksVisited === 1 ? "" : "s"})`
                  : ""}
            {weeksVisited > 0 ? ` · ${weeksVisited}/12 weeks recorded` : ""}
          </p>
        </div>
        {canEdit && !closed && (
          <Button className="h-10" onClick={onAddVisit} data-testid="mal-add-visit">
            <Plus className="mr-1 h-4 w-4" /> Add follow-up
          </Button>
        )}
      </div>

      {grade.level && (
        <section className={`rounded-lg border px-4 py-3 ${grade.level === "red" ? "border-red-300 bg-red-50" : grade.level === "amber" ? "border-amber-300 bg-amber-50" : "border-primary/30 bg-secondary"}`} data-testid="mal-risk-status">
          <p className={`text-sm font-semibold ${grade.level === "red" ? "text-red-800" : grade.level === "amber" ? "text-amber-900" : "text-primary"}`}>
            Risk status · {grade.label} grading · {cd.admissionType}
          </p>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-5">
        {[
          ["Current wt", `${latestData.weight || cd.admissionWeight || "—"} kg`],
          ["Targeted wt", `${cd.targetWeight || "—"} kg`],
          ["MUAC", `${latestData.muac || "—"} cm`],
          ["Oedema", latestData.oedema || "—"],
          ["Weeks", `${weeksVisited}/12${latestWeekLabel != null ? ` · W${latestWeekLabel}` : isLatestAdmission ? " · Adm" : ""}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-white p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">{k}</p>
            <p className="text-lg font-bold">{v}</p>
          </div>
        ))}
      </div>

      <FeatureCard title="Case details" lastAt={admission ? fmtDateTime(admission.date) : undefined} testid="mal-feat-case">
        {admission && canEdit && (
          <div className="mb-2 flex justify-end">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(admission)} data-testid={`mal-edit-case-${admission.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
        <dl className="grid gap-2 sm:grid-cols-2 text-sm" data-testid="mal-case-details">
          {[
            ["Case type", cd.caseType],
            ["Transferred from", cd.fromFacility],
            ["Admission type", cd.admissionType === "Others" && cd.admissionOther ? `Others · ${cd.admissionOther}` : cd.admissionType],
            ["Admission date", cd.admissionDate ? fmtDate(cd.admissionDate) : ""],
            ["Admission weight", cd.admissionWeight ? `${cd.admissionWeight} kg` : ""],
            ["Targeted weight", cd.targetWeight ? `${cd.targetWeight} kg` : ""],
            ["Admission age", ageMonthsToLabel(admission?.data?.ageMonths)],
            ["Gender", patient?.gender || patient?.sex],
            ["Case no.", cd.caseNo != null ? `#${cd.caseNo}` : ""],
            ["Facility", admission?.facility],
          ].filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </FeatureCard>

      <FeatureCard title="Progress" testid="mal-feat-progress">
        <p className="mb-3 text-xs text-muted-foreground" data-testid="mal-progress-hint">
          This table is a summary. To fill a week, click <span className="font-semibold text-foreground">+</span> on that week column (or use Add follow-up).
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Weight (kg)</p>
            <div className="h-52 w-full" data-testid="mal-graph-weight">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightGraph} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef" />
                  <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {cd.targetWeight && (
                    <Line type="monotone" dataKey="target" name="Target" stroke="#94a3b8" strokeDasharray="5 4" dot={false} connectNulls />
                  )}
                  <Line type="monotone" dataKey="weight" name="Weight" stroke="#0F52BA" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">MUAC (cm)</p>
            <div className="h-52 w-full" data-testid="mal-graph-muac">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={muacGraph} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef" />
                  <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="muac" name="MUAC" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto" data-testid="mal-progress-matrix">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-semibold">Item</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-2 py-2 font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>{c.label}</span>
                      {c.visit && canEdit && (
                        <button type="button" className="text-primary" onClick={() => onEdit(c.visit)} data-testid={`mal-edit-${c.visit.id}`} aria-label={`Edit ${c.label}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!c.visit && c.key !== "adm" && canEdit && !closed && admission && (
                        <button
                          type="button"
                          className="text-primary"
                          onClick={() => onAddVisit?.(c.w)}
                          data-testid={`mal-add-week-${c.key}`}
                          aria-label={`Add ${c.label}`}
                          title={`Enter ${c.label}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="font-normal text-[10px]">{c.visit ? fmtDate(c.visit.date) : "Tap + to enter"}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROGRESS_MATRIX_ROWS.map((row, idx) => {
                const prevSection = PROGRESS_MATRIX_ROWS[idx - 1]?.section;
                return (
                  <Fragment key={row.k}>
                    {row.section !== prevSection && (
                      <tr className="bg-muted/40">
                        <td colSpan={columns.length + 1} className="py-1.5 pl-2 text-[11px] font-bold uppercase tracking-wide text-primary">
                          {row.section}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-border/50" data-testid={`mal-matrix-${row.k}`}>
                      <td className="sticky left-0 z-10 bg-white py-1.5 pr-3 text-xs font-medium whitespace-nowrap">{row.label}</td>
                      {columns.map((c, ci) => {
                        if (row.k === "alert") {
                          const grade = alertGrade(columnAlerts[ci]?.level);
                          return (
                            <td key={c.key} className="px-2 py-1.5 text-xs">
                              {grade ? (
                                <span
                                  className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold ${grade.cls}`}
                                  title={(columnAlerts[ci]?.reasons || []).join(" · ")}
                                  data-testid={`mal-alert-${c.key}`}
                                >
                                  {grade.short}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        }
                        const raw = row.get(c.data);
                        return (
                          <td key={c.key} className="px-2 py-1.5 tabular-nums text-xs">
                            {cell(raw)}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </FeatureCard>

      {(outcome || /^lost to follow/i.test(displayStatus)) && (
        <FeatureCard title="Case outcome" testid="mal-feat-outcome" defaultOpen>
          <p className="text-sm font-semibold">{outcome?.status || displayStatus}</p>
          {outcome?.status === "Recovered / Discharged" && (
            <p className="text-sm text-muted-foreground">
              Final wt {outcome.finalWeight || "—"} kg · MUAC {outcome.finalMuac || "—"} cm · Oedema {outcome.finalOedema || "—"} · {outcome.finalClinical || ""}
            </p>
          )}
          {outcome?.status === "Transferred" && (
            <p className="text-sm text-muted-foreground">To {[outcome.facility, outcome.district, outcome.province].filter(Boolean).join(", ")}</p>
          )}
          {outcome?.note && <p className="text-sm text-muted-foreground">{outcome.note}</p>}
          {!outcome && /^lost to follow/i.test(displayStatus) && (
            <p className="mt-1 text-sm text-muted-foreground">No visit for more than 1 week since {latest ? fmtDate(latest.date) : "—"}. Record outcome to close the case.</p>
          )}
        </FeatureCard>
      )}
    </div>
  );
}
