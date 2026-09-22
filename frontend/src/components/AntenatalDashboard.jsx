import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertPanel } from "@/components/Fields";
import { fmtDate, fmtDateTime, groupDiseaseEpisodes, visitLabel } from "@/mock/specs";
import {
  ANTENATAL_ID, resolveDating, trimesterLabel, trimesterOf, gaFromEdd, MOTHER_VITALS, MOTHER_VITAL_CHOICES,
  FETAL_VITALS, FETAL_VITAL_CHOICES, vitalStatus, ANC_IMMUNIZATION, immunizationDueDate, isImmunizationOverdue,
  isAncEpisodeClosed, babyName,
} from "@/mock/antenatal";
import { ChevronDown, Pencil, Plus, Baby } from "lucide-react";

const chip = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", "": "text-foreground" };

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

const VisitHead = ({ v, onEdit, canEdit, label }) => (
  <div className="flex items-start justify-between gap-2">
    <p className="text-xs font-semibold text-primary">{fmtDateTime(v.date)} · {v.worker} · {v.type}{label ? ` · ${label}` : ""}</p>
    {canEdit && onEdit && (
      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(v)} data-testid={`anc-edit-${v.id}`} aria-label="Edit visit"><Pencil className="h-4 w-4" /></Button>
    )}
  </div>
);

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

  const withData = (key) => visits.filter((v) => {
    const x = v.data?.[key];
    if (Array.isArray(x)) return x.length > 0;
    if (x && typeof x === "object") return Object.keys(x).length > 0;
    return !!x;
  });

  const vitalsVisits = visits.filter((v) => Object.keys(v.data?.vitals?.mother || {}).length || Object.keys(v.data?.vitals?.fetal || {}).length);
  const labVisits = withData("lab");
  const radVisits = withData("radiology");
  const drugVisits = withData("drugs");
  const immunVisits = visits.filter((v) => Object.values(v.data?.immunization || {}).some((x) => x?.given));
  const deliveryVisits = visits.filter((v) => v.data?.delivery?.date || (v.data?.delivery?.babies || []).length);
  const noteVisits = visits.filter((v) => (v.data?.notes || []).some((n) => String(n).trim()));
  const outcomeVisits = visits.filter((v) => v.data?.outcome?.status);

  // Group ANC visits by trimester
  const byTrimester = { 1: [], 2: [], 3: [] };
  visits.forEach((v) => {
    const ga = gaFromEdd(resolveDating(v.data?.caseDetails || {}).finalEdd, v.date);
    const t = ga ? trimesterOf(ga.weeks) : null;
    if (t) byTrimester[t].push({ v, ga });
  });

  const mergedImmun = {};
  visits.forEach((v) => Object.entries(v.data?.immunization || {}).forEach(([k, val]) => { if (val?.given) mergedImmun[k] = val; }));

  return (
    <div className="space-y-4" data-testid="anc-dashboard">
      {/* Episode header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-secondary px-4 py-3" data-testid="anc-episode-summary">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Pregnancy episode · {visitLabel(episode.visitCount)}</p>
            {episodes.length > 1 && (
              <select value={sel} onChange={(e) => setSel(e.target.value)} data-testid="anc-episode-select" className="rounded-md border border-input bg-white px-2 py-1 text-xs font-semibold">
                {episodes.map((ep, i) => <option key={ep.id} value={ep.id}>Episode {episodes.length - i}</option>)}
              </select>
            )}
            <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${closed ? "border-slate-300 bg-slate-100 text-slate-700" : "border-green-300 bg-green-50 text-green-700"}`} data-testid="anc-episode-status">
              {closed ? episode.outcome || "Closed" : "Active"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">
            Start: {fmtDate(episode.start)} · Latest: {fmtDate(episode.last)}
          </p>
        </div>
        {canEdit && !closed && (
          <Button className="h-10 shrink-0" onClick={onAddVisit} data-testid="anc-add-visit"><Plus className="mr-1 h-4 w-4" /> ANC visit</Button>
        )}
      </div>

      {/* GA / EDD panel */}
      <div className="grid gap-3 sm:grid-cols-3" data-testid="anc-dash-dating">
        <div className="rounded-lg border-2 border-primary bg-white p-4">
          <p className="text-[11px] font-semibold text-primary">Gestational age (latest)</p>
          <p className="mt-1 text-2xl font-bold">{dating.finalGa?.text || "—"}</p>
          <p className="text-xs text-muted-foreground">{trimesterLabel(dating.trimester)}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-[11px] font-semibold text-muted-foreground">EDD ({dating.source})</p>
          <p className="mt-1 text-2xl font-bold">{dating.finalEdd ? fmtDate(dating.finalEdd) : "—"}</p>
          <p className="text-xs text-muted-foreground">LMP {lmp ? fmtDate(lmp) : "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-[11px] font-semibold text-muted-foreground">ANC visits</p>
          <p className="mt-1 text-2xl font-bold">{visits.length}</p>
          <p className="text-xs text-muted-foreground">T1 {byTrimester[1].length} · T2 {byTrimester[2].length} · T3 {byTrimester[3].length}</p>
        </div>
      </div>

      {/* ANC visits by trimester */}
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

      {/* Vitals */}
      {vitalsVisits.length > 0 && (
        <FeatureCard title="Vitals (mother & fetal)" count={vitalsVisits.length} lastAt={fmtDateTime(vitalsVisits[0].date)} testid="anc-feat-vitals">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  {MOTHER_VITALS.map((f) => <th key={f.k} className="px-2 py-2 font-semibold whitespace-nowrap">{f.label}</th>)}
                  {FETAL_VITALS.map((f) => <th key={f.k} className="px-2 py-2 font-semibold whitespace-nowrap">{f.label}</th>)}
                  <th className="px-2 py-2 font-semibold">Presentation</th>
                </tr>
              </thead>
              <tbody>
                {vitalsVisits.map((v) => {
                  const m = v.data.vitals.mother || {}; const f = v.data.vitals.fetal || {};
                  return (
                    <tr key={v.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium whitespace-nowrap">{fmtDate(v.date)}</td>
                      {MOTHER_VITALS.map((fd) => <td key={fd.k} className={`px-2 py-2 tabular-nums font-semibold ${chip[vitalStatus(fd, m[fd.k])]}`}>{m[fd.k] ?? "—"}</td>)}
                      {FETAL_VITALS.map((fd) => <td key={fd.k} className={`px-2 py-2 tabular-nums font-semibold ${chip[vitalStatus(fd, f[fd.k])]}`}>{f[fd.k] ?? "—"}</td>)}
                      <td className="px-2 py-2">{f.presentation || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FeatureCard>
      )}

      {/* Laboratory */}
      {labVisits.length > 0 && (
        <FeatureCard title="Laboratory" count={labVisits.reduce((n, v) => n + v.data.lab.length, 0)} lastAt={fmtDateTime(labVisits[0].date)} testid="anc-feat-lab">
          <div className="space-y-3">
            {labVisits.map((v) => (
              <div key={v.id}>
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} />
                <div className="mt-1 space-y-1">
                  {v.data.lab.map((row, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
                      <span className="font-semibold">{row.test}</span>
                      <span>{row.result || "Pending"} · <span className="text-muted-foreground">{row.location}{row.sentToLab ? " · sent" : ""} · {row.date ? fmtDate(row.date) : ""}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FeatureCard>
      )}

      {/* Radiology */}
      {radVisits.length > 0 && (
        <FeatureCard title="Radiology" count={radVisits.reduce((n, v) => n + v.data.radiology.length, 0)} lastAt={fmtDateTime(radVisits[0].date)} testid="anc-feat-radiology">
          <div className="space-y-3">
            {radVisits.map((v) => (
              <div key={v.id}>
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} />
                {v.data.radiology.map((row, i) => (
                  <div key={i} className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                    <p className="font-semibold">{row.scan || "Scan"} · <span className="font-normal text-muted-foreground">{row.date ? fmtDate(row.date) : ""}</span></p>
                    {row.findings && <p className="mt-0.5 whitespace-pre-line">{row.findings}</p>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </FeatureCard>
      )}

      {/* Drugs */}
      {drugVisits.length > 0 && (
        <FeatureCard title="Drugs" count={drugVisits.length} lastAt={fmtDateTime(drugVisits[0].date)} testid="anc-feat-drugs">
          <div className="space-y-2">
            {drugVisits.map((v) => (
              <div key={v.id}>
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} />
                <p className="mt-1 text-sm font-medium">{v.data.drugs.join(" · ")}</p>
              </div>
            ))}
          </div>
        </FeatureCard>
      )}

      {/* Immunization */}
      <FeatureCard title="Immunization" count={Object.keys(mergedImmun).length} testid="anc-feat-immunization">
        <div className="space-y-2">
          {ANC_IMMUNIZATION.map((item) => {
            const rec = mergedImmun[item.id];
            const overdue = isImmunizationOverdue(item, rec, firstContact, lmp);
            const due = immunizationDueDate(item, firstContact, lmp);
            return (
              <div key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${rec?.given ? "border-green-500 bg-green-50" : overdue ? "border-red-500 bg-red-50" : "border-border bg-white"}`} data-testid={`anc-dash-vac-${item.id}`}>
                <span className="font-semibold">{item.name}</span>
                <span className={rec?.given ? "text-green-700 font-semibold" : overdue ? "text-red-700 font-semibold" : "text-muted-foreground"}>
                  {rec?.given ? `Given ${rec.date ? fmtDate(rec.date) : ""}` : overdue ? `Overdue (due ${due ? fmtDate(due) : "—"})` : `Due ${due ? fmtDate(due) : "—"}`}
                </span>
              </div>
            );
          })}
        </div>
      </FeatureCard>

      {/* Delivery & newborn */}
      {deliveryVisits.length > 0 && (
        <FeatureCard title="Delivery & new born" count={deliveryVisits.length} testid="anc-feat-delivery">
          {deliveryVisits.map((v) => {
            const del = v.data.delivery || {};
            return (
              <div key={v.id} className="space-y-2">
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} />
                <p className="text-sm"><b>Delivery:</b> {del.date ? fmtDate(del.date) : "—"} · {del.mode || "—"} · {del.place || "—"}{del.conducted ? ` · by ${del.conducted}` : ""}</p>
                {del.complications && <p className="text-sm text-muted-foreground">{del.complications}</p>}
                {(del.babies || []).map((b, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                    <Baby className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{babyName(patient.name, i, del.babies.length)}</span>
                    <span className="text-muted-foreground">{b.sex || "—"} · {b.weightKg ? `${b.weightKg} kg` : "—"} · APGAR {b.apgar1 || "—"}/{b.apgar5 || "—"} · {b.outcome}</span>
                    {b.registered && <Badge variant="outline" className="rounded">Registered · {b.patientId}</Badge>}
                  </div>
                ))}
              </div>
            );
          })}
        </FeatureCard>
      )}

      {/* Notes */}
      {noteVisits.length > 0 && (
        <FeatureCard title="Visit notes" count={noteVisits.length} lastAt={fmtDateTime(noteVisits[0].date)} testid="anc-feat-notes">
          <div className="space-y-2">
            {noteVisits.map((v) => (
              <div key={v.id}>
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} />
                {(v.data.notes || []).filter((n) => String(n).trim()).map((n, i) => <p key={i} className="mt-1 whitespace-pre-line text-sm font-medium">{n}</p>)}
              </div>
            ))}
          </div>
        </FeatureCard>
      )}

      {/* Outcome */}
      {outcomeVisits.length > 0 && (
        <FeatureCard title="Outcome" count={outcomeVisits.length} testid="anc-feat-outcome">
          {outcomeVisits.map((v) => (
            <div key={v.id}>
              <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} />
              <p className="mt-1 text-sm font-semibold">{v.data.outcome.status}</p>
              {(v.data.outcome.province || v.data.outcome.facility) && <p className="text-sm text-muted-foreground">Referred to {[v.data.outcome.facility, v.data.outcome.district, v.data.outcome.province].filter(Boolean).join(", ")}</p>}
              {v.data.outcome.note && <p className="text-sm text-muted-foreground">{v.data.outcome.note}</p>}
            </div>
          ))}
        </FeatureCard>
      )}
    </div>
  );
}
