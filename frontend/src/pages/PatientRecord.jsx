import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertPanel, SelectField, TextField, ChoiceRow } from "@/components/Fields";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/Capture";
import { DISEASE_SPECS, SPEC_LIST, fmtDate, fmtDateTime } from "@/mock/specs";
import { toast } from "sonner";
import { ArrowLeft, Plus, Stethoscope, Phone, ChevronDown, PanelLeft, Pencil, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import StatusChips from "@/components/StatusChips";
import PatientSidebar from "@/components/PatientSidebar";

const FEATURES = [
  ["caseDetails", "Case details"], ["history", "Clinical history"], ["marks", "Assessment"],
  ["lab", "Laboratory"], ["diagnosis", "Diagnosis"], ["drugs", "Drugs"],
  ["household", "Household"], ["notes", "Visit notes"], ["outcome", "Outcome"],
];

const hasValue = (v) => {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== "" && s !== "—" && s !== "Open";
};

const summarise = (key, e) => {
  const x = e.data || {};
  if (key === "caseDetails") return [x.caseDetails?.mode, x.caseDetails?.caseType, x.caseDetails?.weight && `${x.caseDetails.weight} kg`].filter(Boolean).join(" · ");
  if (key === "history") return Object.entries(x.history || {}).filter(([, v]) => v && typeof v === "string").slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(" · ");
  if (key === "marks") {
    return Object.values(x.marks || {})
      .map((m) => {
        const region = m.region || m.label;
        const code = m.code || m.type;
        if (!region && !code) return "";
        return `${region || "—"}${code ? ` (${code}${m.extra ? ` ${m.extra}` : ""})` : ""}`;
      })
      .filter(Boolean)
      .join(", ");
  }
  if (key === "lab") return Object.entries(x.lab || {}).map(([k, v]) => `${k}: ${v}`).join(" · ");
  if (key === "diagnosis") {
    const dx = x.diagnosis || e.diagnosis;
    return hasValue(dx) ? dx : "";
  }
  if (key === "drugs") return [...(x.topical || []), ...(x.oral || [])].join(" + ");
  if (key === "household") return (x.household?.contacts || []).length ? `${x.household.contacts.length} contact(s) registered` : "";
  if (key === "notes") return x.notes;
  if (key === "outcome") {
    const parts = [hasValue(x.outcome) ? x.outcome : "", ...(x.recommendations || [])].filter(Boolean);
    return parts.join(" · ");
  }
  return "";
};

export default function PatientRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { patients, encounters, user, suspects, facilities, settings } = useStore();
  const p = patients.find((x) => x.id === id);
  const [tab, setTab] = useState("all");
  const [lhs, setLhs] = useState(true);
  const [open, setOpen] = useState({});
  const [featureOpen, setFeatureOpen] = useState(() => Object.fromEntries(FEATURES.map(([k]) => [k, true])));
  const [enc, setEnc] = useState({ show: false, facility: "", date: new Date().toISOString().slice(0, 10), visitType: "", referral: "No", disease: "" });
  const canEdit = user?.canEdit;

  const encs = useMemo(() => encounters.filter((e) => e.patientId === id).sort((a, b) => b.date.localeCompare(a.date)), [encounters, id]);
  const mySuspects = useMemo(() => suspects.filter((s) => s.patientId === id).sort((a, b) => b.date.localeCompare(a.date)), [suspects, id]);
  const myDiseases = SPEC_LIST.filter((s) => (p?.diseases || []).includes(s.id));

  if (!p) return <AppShell title="Patient not found"><Button className="h-12" onClick={() => navigate("/patients")}>Back to patients</Button></AppShell>;

  const start = () => {
    if (!enc.facility || !enc.visitType) return toast.error("Choose location and visit type");
    const q = `fac=${encodeURIComponent(enc.facility)}&vt=${encodeURIComponent(enc.visitType)}&ref=${enc.referral}`;
    setEnc({ ...enc, show: false });
    navigate(enc.disease ? `/patients/${p.id}/encounter/${enc.disease}?${q}` : `/patients/${p.id}/suspect?${q}`);
  };

  const tabs = [["all", "All visits"], ["suspect", "Suspect"], ...myDiseases.map((d) => [d.id, d.name])];

  const actions = (
    <div className="flex flex-wrap justify-end gap-2" data-testid="record-actions">
      <Button className="h-11" data-testid="add-encounter-btn" disabled={!canEdit} onClick={() => setEnc({ ...enc, show: true })}>
        <Plus className="mr-2 h-4 w-4" /> {encs.length ? "Book / add encounter" : "Add encounter"}
      </Button>
      {p.phone && (
        <>
          <a href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" data-testid="record-whatsapp-btn" className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-green-700 hover:bg-green-50"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>
          <a href={`tel:${p.phone.replace(/\s/g, "")}`} data-testid="record-call-btn" className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-primary hover:bg-secondary"><Phone className="h-4 w-4" /> Call</a>
        </>
      )}
      <Button variant="outline" className="h-11" data-testid="back-btn" onClick={() => navigate("/patients")}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
    </div>
  );

  const visitRow = (e) => (
    <div key={e.id} className="rounded-lg border border-border bg-white" data-testid={`visit-${e.id}`}>
      <button
        type="button"
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:border-primary"
        data-testid={`visit-toggle-${e.id}`}
        onClick={() => setOpen((o) => ({ ...o, [e.id]: !o[e.id] }))}
      >
        <Avatar patient={p} testid={`visit-photo-${e.id}`} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-head text-lg font-semibold leading-tight">{p.name}</span>
            <StatusChips
              diseaseId={e.disease}
              diagnosis={e.diagnosis}
              outcome={e.outcome || p.outcome}
              pending={!e.synced}
              testid={`visit-status-${e.id}`}
            />
          </span>
          <span className="mt-1 block truncate text-sm text-muted-foreground">{e.facility}</span>
          <span className="mt-0.5 block truncate text-xs uppercase tracking-wider text-muted-foreground">
            {[
              `${fmtDateTime(e.date)}`,
              e.type || null,
              e.worker || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open[e.id] ? "rotate-180" : ""}`} />
      </button>
      {open[e.id] && (
        <div className="space-y-2 border-t border-border p-4">
          {FEATURES.map(([k, label]) => {
            const s = summarise(k, e);
            if (!s) return null;
            return (
              <div key={k} className="flex flex-col gap-0.5 border-b border-border pb-2 last:border-0 sm:flex-row sm:gap-4">
                <span className="w-40 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
                <span className="whitespace-pre-line text-sm font-medium">{s}</span>
              </div>
            );
          })}
          <Button variant="outline" className="h-11" data-testid={`edit-visit-${e.id}`} disabled={!canEdit} onClick={() => navigate(`/patients/${p.id}/encounter/${e.disease}?enc=${e.id}`)}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit encounter
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <AppShell>
      <div className={`grid gap-6 ${lhs ? "lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
        {lhs && (
          <PatientSidebar
            patient={p}
            encounters={encs}
            diseases={myDiseases}
            onCollapse={() => setLhs(false)}
            testid="lhs-panel"
          />
        )}

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {!lhs && <Button variant="outline" size="icon" className="h-11 w-11" data-testid="lhs-expand-btn" onClick={() => setLhs(true)}><PanelLeft className="h-4 w-4" /></Button>}
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto" data-testid="record-tabs">
              {tabs.map(([k, label]) => (
                <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
                  className={`h-11 shrink-0 rounded-md border px-4 text-sm font-semibold ${tab === k ? "border-primary bg-primary text-white" : "border-border bg-white text-muted-foreground hover:bg-muted"}`}>{label}</button>
              ))}
            </div>
            {actions}
          </div>

          {!canEdit && <div className="mb-4"><AlertPanel level="review" title="View-only access" testid="readonly-alert">Your access level allows viewing this record but not editing.</AlertPanel></div>}

          {tab === "all" && (
            <div className="space-y-3" data-testid="all-visits">
              {encs.length === 0 && mySuspects.length === 0 && <AlertPanel level="info" title="No visits yet" testid="no-visits">Use “Add encounter” to record the first visit.</AlertPanel>}
              {encs.map(visitRow)}
              {mySuspects.map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-white p-4" data-testid={`suspect-row-${s.id}`}>
                  <p className="font-head font-semibold">Suspect screening · {s.suspect === "none" ? "No NTD suspected" : `${DISEASE_SPECS[s.suspect]?.name || s.suspect} suspected`}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.worker} · {fmtDate(s.date)} · {s.id}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.symptoms.join(" · ")}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "suspect" && (
            <div className="space-y-3" data-testid="suspect-tab">
              <Button className="h-11" data-testid="new-suspect-btn" disabled={!canEdit} onClick={() => navigate(`/patients/${p.id}/suspect`)}>
                <Stethoscope className="mr-2 h-4 w-4" /> New suspect screening
              </Button>
              {mySuspects.length === 0 && <AlertPanel level="info" title="No suspect screening yet" testid="no-suspect">Record complaints, photos and the suspected NTD here first.</AlertPanel>}
              {mySuspects.map((s) => (
                <div key={s.id} className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-center">
                  {s.photos?.[0] && <img src={s.photos[0]} alt="lesion" className="h-16 w-16 rounded-md border border-border object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{fmtDate(s.date)} · {s.suspect === "none" ? "No NTD suspected" : `${DISEASE_SPECS[s.suspect]?.name} suspected`}</p>
                    <p className="text-sm text-muted-foreground">{s.symptoms.join(" · ")}</p>
                  </div>
                  {s.suspect !== "none" && DISEASE_SPECS[s.suspect] && (
                    <Button variant="outline" className="h-11" data-testid={`start-flow-${s.id}`} disabled={!canEdit} onClick={() => setEnc({ ...enc, show: true, disease: s.suspect })}>
                      Start {DISEASE_SPECS[s.suspect].name} flow
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {myDiseases.some((x) => x.id === tab) && (() => {
            const featureRows = FEATURES.map(([k, label]) => ({
              k,
              label,
              rows: encs.filter((e) => e.disease === tab).map((e) => ({ e, s: summarise(k, e) })).filter((r) => r.s),
            })).filter((f) => f.rows.length);
            const allExpanded = featureRows.length > 0 && featureRows.every((f) => featureOpen[f.k] !== false);
            return (
            <div className="space-y-4" data-testid={`condition-tab-${tab}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Button className="h-11" data-testid={`add-condition-encounter-${tab}`} disabled={!canEdit} onClick={() => setEnc({ ...enc, show: true, disease: tab })}>
                  <Plus className="mr-2 h-4 w-4" /> Add {DISEASE_SPECS[tab].name} encounter
                </Button>
                {featureRows.length > 0 && (
                  <Button
                    variant="outline"
                    className="h-11"
                    data-testid="toggle-all-features-btn"
                    onClick={() =>
                      setFeatureOpen((prev) => ({
                        ...prev,
                        ...Object.fromEntries(featureRows.map((f) => [f.k, !allExpanded])),
                      }))
                    }
                  >
                    {allExpanded ? (
                      <>
                        <ChevronsDownUp className="mr-2 h-4 w-4" /> Collapse all
                      </>
                    ) : (
                      <>
                        <ChevronsUpDown className="mr-2 h-4 w-4" /> Expand all
                      </>
                    )}
                  </Button>
                )}
              </div>
              {featureRows.map(({ k, label, rows }) => {
                const isOpen = featureOpen[k] !== false;
                const last = rows[0]?.e;
                const lastAt = last ? fmtDateTime(last.date) : "";
                return (
                  <section key={k} className="rounded-lg border border-border bg-white" data-testid={`feature-${k}`}>
                    <button
                      type="button"
                      data-testid={`feature-toggle-${k}`}
                      onClick={() => setFeatureOpen((o) => ({ ...o, [k]: !isOpen }))}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <h2 className="font-head text-lg font-semibold">{label}</h2>
                      <span className="flex min-w-0 items-center gap-2">
                        {lastAt && (
                          <span className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground" data-testid={`feature-last-${k}`}>
                            {lastAt}
                          </span>
                        )}
                        <Badge variant="outline" className="rounded">{rows.length} entr{rows.length === 1 ? "y" : "ies"}</Badge>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-border border-t border-border">
                        {rows.map(({ e, s }) => (
                          <div key={e.id} className="px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{fmtDate(e.date)} · {e.worker} · {e.type}</p>
                            <p className="mt-1 whitespace-pre-line text-sm font-medium">{s}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
              {encs.filter((e) => e.disease === tab).length === 0 && (
                <AlertPanel level="info" title={`No ${DISEASE_SPECS[tab].name} data yet`} testid="empty-condition">Add an encounter to start this condition record.</AlertPanel>
              )}
            </div>
            );
          })()}
        </div>
      </div>

      <Dialog open={enc.show} onOpenChange={(o) => setEnc({ ...enc, show: o })}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md" data-testid="add-encounter-dialog">
          <DialogHeader><DialogTitle className="font-head text-xl">Add encounter</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <SelectField label="Location / facility" options={facilities.map((f) => f.name)} value={enc.facility} onChange={(v) => setEnc({ ...enc, facility: v })} testid="encounter-facility-select" />
            <TextField label="Date" type="date" testid="encounter-date-input" value={enc.date} onChange={(e) => setEnc({ ...enc, date: e.target.value })} hint={fmtDate(enc.date)} />
            <TextField label="Clinician" testid="encounter-clinician" value={user?.name || ""} readOnly />
            <SelectField label="Visit type" options={settings.visitTypes} value={enc.visitType} onChange={(v) => setEnc({ ...enc, visitType: v })} testid="encounter-visit-type-select" />
            <ChoiceRow label="Referral" options={["Yes", "No"]} value={enc.referral} onChange={(v) => setEnc({ ...enc, referral: v })} testid="encounter-referral" />
            <SelectField label="Go to" options={["Suspect screening", ...SPEC_LIST.map((s) => s.name)]}
              value={enc.disease ? DISEASE_SPECS[enc.disease].name : "Suspect screening"}
              onChange={(v) => setEnc({ ...enc, disease: SPEC_LIST.find((s) => s.name === v)?.id || "" })} testid="encounter-target-select" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12" data-testid="encounter-cancel" onClick={() => setEnc({ ...enc, show: false })}>Cancel</Button>
            <Button className="h-12" data-testid="encounter-start" onClick={start}>Start encounter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
