import { useMemo, useState } from "react";
import { FileText, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertPanel } from "@/components/Fields";
import { FeatureCard, ExpandAllButton } from "@/components/EntryKit";
import { fmtDate, fmtDateTime, groupDiseaseEpisodes, visitLabel } from "@/mock/specs";
import { FP_ID, FP_NAME } from "@/mock/familyPlanning";

export const FP_SECTIONS = { case: 1, history: 2, risk: 3, services: 4 };

const val = (v) => {
  if (v === undefined || v === null || v === "") return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  return String(v);
};

const displayDate = (v) => {
  if (!v) return "";
  const formatted = fmtDate(v);
  return formatted && formatted !== "—" ? formatted : String(v);
};

/** Scabies-style key: value rows. */
const KvList = ({ items, testid }) => {
  const rows = (items || []).filter((x) => x && val(x.value));
  if (!rows.length) {
    return <p className="mt-1 text-sm text-muted-foreground" data-testid={testid}>No data recorded</p>;
  }
  return (
    <div className="mt-2 space-y-1" data-testid={testid}>
      {rows.map((item) => (
        <p key={item.label} className="text-sm">
          <span className="text-muted-foreground">{item.label}:</span>{" "}
          <span className="font-medium">{val(item.value)}</span>
        </p>
      ))}
    </div>
  );
};

const VisitHead = ({ v, onEdit, canEdit, section, testid }) => (
  <div className="flex items-start justify-between gap-2">
    <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
      <span>
        {fmtDateTime(v?.date)}
        {v?.worker ? ` · ${v.worker}` : ""}
        {v?.type ? ` · ${v.type}` : ""}
      </span>
    </p>
    {canEdit && onEdit && v && (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-primary"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(v, section);
        }}
        data-testid={testid}
        aria-label="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    )}
  </div>
);

const caseDetailItems = (cd = {}) => [
  { label: "Gravida (G)", value: cd.g ?? cd.gravida },
  { label: "Para (P)", value: cd.p ?? cd.para },
  { label: "Living (L)", value: cd.l ?? cd.living },
  { label: "Abortions (A)", value: cd.a ?? cd.abortions },
  { label: "Neonatal death", value: cd.neonatalDeath },
  { label: "Still birth", value: cd.stillBirth },
  { label: "Term birth", value: cd.termBirth },
  { label: "Living children", value: cd.livingChildren },
  { label: "Age of last child", value: cd.ageLastChild },
  { label: "Final EDD (clinician)", value: displayDate(cd.finalEdd) },
  { label: "Menstrual cycle length (days)", value: cd.cycleLength },
  { label: "LMP", value: displayDate(cd.lmp) },
  { label: "LMP date confirmed", value: cd.lmpConfirmed === true ? "Yes" : cd.lmpConfirmed === false ? "No" : "" },
  { label: "Was couple counselling done", value: cd.coupleCounselling },
];

const menstrualItems = (m = {}, fallbackLmp = "") => [
  { label: "LMP", value: displayDate(m.lmp || fallbackLmp) },
  { label: "Menarche (years)", value: m.menarche },
  { label: "Amenorrhea", value: m.amenorrhea },
  { label: "Intermenstrual Bleeding", value: m.imb },
  { label: "Dysmenorrhea", value: m.dysmenorrhea },
  { label: "Menstrual Flow", value: m.flow },
  { label: "Cycle Duration (Days)", value: m.cycleDuration },
  { label: "Cycle Length (Days)", value: m.cycleLength },
  { label: "Menstrual cycles", value: m.regularity },
];

export default function FamilyPlanningDashboard({ encounters, canEdit, onEdit, onAddVisit }) {
  const episodes = useMemo(() => groupDiseaseEpisodes(encounters, FP_ID, null), [encounters]);
  const [featureOpen, setFeatureOpen] = useState({});
  const episode = episodes[0];
  const visits = useMemo(
    () => [...(episode?.visits || [])].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [episode],
  );
  const latest = visits[0];
  const featureKeys = ["case", "history", "risk", "services"];
  const allExpanded = featureKeys.every((k) => featureOpen[k] !== false);
  const cardOpen = (k) => featureOpen[k] !== false;
  const setCardOpen = (k) => (next) => setFeatureOpen((o) => ({ ...o, [k]: next }));

  if (!episode) {
    return (
      <div className="space-y-4" data-testid="fp-empty">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-secondary px-4 py-3">
          <div>
            <p className="font-semibold">{FP_NAME} record</p>
            <p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">No visits yet</p>
          </div>
          {canEdit && onAddVisit && (
            <Button
              className="h-9 px-3"
              onClick={() => onAddVisit?.()}
              data-testid="fp-add-visit"
            >
              <Plus className="mr-1 h-4 w-4" /> Encounter
            </Button>
          )}
        </div>
        <AlertPanel level="info" title="No Family Planning data yet" testid="fp-empty-msg">
          Use <span className="font-medium text-foreground">Pathways</span> to start this record.
        </AlertPanel>
      </div>
    );
  }

  const cd = latest?.data?.caseDetails || {};
  const hist = latest?.data?.history || {};
  const menstrual = hist.menstrual || {};
  const medical = hist.medical || [];
  const risks = hist.riskFactors || [];
  const services = visits.flatMap((v) => (v.data?.services || []).map((s) => ({ ...s, visit: v })));
  const caseItems = caseDetailItems(cd);
  const menstrualRows = menstrualItems(menstrual, cd.lmp);

  return (
    <div className="space-y-4" data-testid="fp-dashboard">
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-secondary px-4 py-3"
        data-testid="fp-episode-summary"
      >
        <div>
          <p className="font-semibold">
            {FP_NAME} · {visitLabel(episode.visitCount || visits.length)}
          </p>
          <p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">
            Start: {fmtDate(episode.start)} · Latest: {fmtDate(episode.last || latest?.date)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canEdit && (
            <Button
              className="h-9 px-3"
              onClick={() => onAddVisit?.(episode)}
              data-testid="fp-dash-add"
            >
              <Plus className="mr-1 h-4 w-4" /> Encounter
            </Button>
          )}
          <ExpandAllButton
            allExpanded={allExpanded}
            onToggle={() => setFeatureOpen(Object.fromEntries(featureKeys.map((k) => [k, !allExpanded])))}
            testid="fp-toggle-all-features-btn"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-white/70 text-primary hover:bg-white"
          />
        </div>
      </div>

      <FeatureCard
        title="Case details"
        count={caseItems.filter((x) => val(x.value)).length || undefined}
        lastAt={fmtDateTime(latest?.date)}
        testid="fp-card-case"
        open={cardOpen("case")}
        onOpenChange={setCardOpen("case")}
      >
        <VisitHead v={latest} onEdit={onEdit} canEdit={canEdit} section={FP_SECTIONS.case} testid="fp-case-edit" />
        <div className="mt-2 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Obstetric</p>
            <KvList
              testid="fp-case-obstetric"
              items={caseItems.filter((x) =>
                [
                  "Gravida (G)", "Para (P)", "Living (L)", "Abortions (A)",
                  "Neonatal death", "Still birth", "Term birth",
                  "Living children", "Age of last child", "Final EDD (clinician)",
                ].includes(x.label),
              )}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Menstrual</p>
            <KvList
              testid="fp-case-menstrual"
              items={caseItems.filter((x) =>
                [
                  "Menstrual cycle length (days)", "LMP", "LMP date confirmed",
                  "Was couple counselling done",
                ].includes(x.label),
              )}
            />
          </div>
        </div>
      </FeatureCard>

      <FeatureCard
        title="History"
        lastAt={fmtDateTime(latest?.date)}
        testid="fp-card-history"
        open={cardOpen("history")}
        onOpenChange={setCardOpen("history")}
      >
        <VisitHead v={latest} onEdit={onEdit} canEdit={canEdit} section={FP_SECTIONS.history} testid="fp-hist-edit" />
        <div className="mt-2 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Medical history</p>
            <KvList
              testid="fp-medical-list"
              items={medical.length ? [{ label: "Medical History", value: medical.join(", ") }] : []}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Menstrual history</p>
            <KvList testid="fp-menstrual-list" items={menstrualRows} />
          </div>
        </div>
      </FeatureCard>

      <FeatureCard
        title="Risk factors"
        count={risks.length || undefined}
        lastAt={fmtDateTime(latest?.date)}
        testid="fp-card-risk"
        open={cardOpen("risk")}
        onOpenChange={setCardOpen("risk")}
      >
        <VisitHead v={latest} onEdit={onEdit} canEdit={canEdit} section={FP_SECTIONS.risk} testid="fp-risk-edit" />
        <KvList
          testid="fp-risk-list"
          items={risks.length ? [{ label: "Risk factors", value: risks.join(", ") }] : []}
        />
      </FeatureCard>

      <FeatureCard
        title="Family Planning"
        count={services.length || undefined}
        lastAt={services[0] ? fmtDateTime(services[0].visit?.date) : fmtDateTime(latest?.date)}
        testid="fp-card-services"
        open={cardOpen("services")}
        onOpenChange={setCardOpen("services")}
      >
        <VisitHead v={latest} onEdit={onEdit} canEdit={canEdit} section={FP_SECTIONS.services} testid="fp-services-edit" />
        {services.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No services recorded</p>
        ) : (
          <div className="mt-2 space-y-3" data-testid="fp-services-list">
            {services.map((row) => (
              <div key={`${row.visit?.id}-${row.id}`} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-primary">
                    {fmtDateTime(row.visit?.date || row.dateOfServiceIso)}
                    {row.visit?.worker ? ` · ${row.visit.worker}` : ""}
                  </p>
                  {row.notes ? <FileText className="h-4 w-4 shrink-0 text-primary" title={row.notes} /> : null}
                </div>
                <KvList
                  items={[
                    { label: "Service", value: row.service },
                    { label: "Date of Service", value: row.dateOfService || displayDate(row.dateOfServiceIso) },
                    { label: "Service details", value: row.serviceDetails },
                    { label: "Next visit", value: row.nextVisit || displayDate(row.nextVisitIso) },
                    { label: "Notes", value: row.notes },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </FeatureCard>
    </div>
  );
}
