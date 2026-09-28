import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/Fields";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, isLostToFollowUp, dobFromAge, patientAgeLabel } from "@/components/Capture";
import { GEO, DISEASES } from "@/mock/data";
import { DISEASE_SPECS, fmtDate, fmtDateTime } from "@/mock/specs";
import { Search, Plus, ChevronRight, Phone, SlidersHorizontal, ChevronLeft, Printer } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import StatusChips, { PendingSyncChip, EncounterStatusChip, patientStatusRecords } from "@/components/StatusChips";
import { buildVisitSummaryPrintHtml, buildPatientEncountersPrintHtml, featureRowsFromVisits, printHtmlDocument } from "@/lib/visitSummaryPrint";
import { toast } from "sonner";

const PERIODS = ["Day", "Week", "Month", "Quarter", "Year", "All", "Custom"];
const iso = (d) => d.toISOString().slice(0, 10);
const startOfWeek = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

const periodRange = (period, anchor, custom) => {
  const a = new Date(anchor);
  if (period === "All") return { from: "0000-01-01", to: "9999-12-31", label: "All time" };
  if (period === "Custom") return { from: custom.from || iso(a), to: custom.to || iso(a), label: `${fmtDate(custom.from || iso(a))} — ${fmtDate(custom.to || iso(a))}` };
  if (period === "Day") return { from: iso(a), to: iso(a), label: fmtDate(iso(a)) };
  if (period === "Week") { const s0 = startOfWeek(a); const e0 = new Date(s0); e0.setDate(e0.getDate() + 6); return { from: iso(s0), to: iso(e0), label: `${fmtDate(iso(s0))} — ${fmtDate(iso(e0))}` }; }
  if (period === "Month") { const s0 = new Date(a.getFullYear(), a.getMonth(), 1); const e0 = new Date(a.getFullYear(), a.getMonth() + 1, 0); return { from: iso(s0), to: iso(e0), label: s0.toLocaleString("en", { month: "long", year: "numeric" }) }; }
  if (period === "Quarter") { const q = Math.floor(a.getMonth() / 3); const s0 = new Date(a.getFullYear(), q * 3, 1); const e0 = new Date(a.getFullYear(), q * 3 + 3, 0); return { from: iso(s0), to: iso(e0), label: `Q${q + 1} ${a.getFullYear()} · ${fmtDate(iso(s0))} — ${fmtDate(iso(e0))}` }; }
  const s0 = new Date(a.getFullYear(), 0, 1); const e0 = new Date(a.getFullYear(), 11, 31);
  return { from: iso(s0), to: iso(e0), label: String(a.getFullYear()) };
};

const shift = (period, anchor, dir) => {
  const a = new Date(anchor);
  if (period === "Day") a.setDate(a.getDate() + dir);
  else if (period === "Week") a.setDate(a.getDate() + 7 * dir);
  else if (period === "Month") a.setMonth(a.getMonth() + dir);
  else if (period === "Quarter") a.setMonth(a.getMonth() + 3 * dir);
  else if (period === "Year") a.setFullYear(a.getFullYear() + dir);
  return iso(a);
};

export default function Patients() {
  const { visiblePatients, users, encounters, settings, suspects, loadPatients, loadAppointments, syncPatientVisitPhi, syncPatientEpisodes, branding, user, authSession } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const view = location.pathname.startsWith("/appointments") ? "encounter" : "patient";
  const [q, setQ] = useState("");
  const [village, setVillage] = useState("");
  const [status, setStatus] = useState("");
  const [outcome, setOutcome] = useState("");
  const [disease, setDisease] = useState("");
  const [clinician, setClinician] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [period, setPeriod] = useState("Day");
  const [anchor, setAnchor] = useState(iso(new Date()));
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [loadingPatients, setLoadingPatients] = useState(Boolean(authSession?.facilityId));
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [printPreviewHtml, setPrintPreviewHtml] = useState("");
  const [printingId, setPrintingId] = useState("");
  const all = visiblePatients();
  const activeFilters = [village, status, outcome, disease, clinician].filter(Boolean).length;

  // Keep patient list in sync with portal-be (registered NTD patients).
  useEffect(() => {
    if (!authSession?.facilityId) {
      setLoadingPatients(false);
      return;
    }
    let cancelled = false;
    setLoadingPatients(true);
    loadPatients({ session: authSession })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingPatients(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authSession?.facilityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const villages = [...new Set(Object.values(GEO).flatMap((d) => Object.values(d).flat()))];
  const outcomeOf = (p) => p.outcome || (isLostToFollowUp(p, encounters, settings) ? "Lost to follow-up" : "Open / in treatment");

  const rows = useMemo(
    () => {
      const diseaseId = DISEASES.find((d) => d.name === disease)?.id;
      const qq = q.trim().toLowerCase();
      return all.filter(
        (p) =>
          (!qq ||
            String(p.name || "").toLowerCase().includes(qq) ||
            String(p.id || "").toLowerCase().includes(qq) ||
            String(p.patientCode || "").toLowerCase().includes(qq) ||
            String(p.episodeId || "").toLowerCase().includes(qq)) &&
          (!village || p.village === village) &&
          (!status || p.status === status) &&
          (!outcome || outcomeOf(p) === outcome) &&
          (!disease ||
            encounters.some((e) => e.patientId === p.id && e.disease === diseaseId) ||
            suspects.some((s) => s.patientId === p.id && s.suspect === diseaseId)) &&
          (!clinician || encounters.some((e) => e.patientId === p.id && e.worker === clinician))
      );
    },
    [all, q, village, status, outcome, disease, clinician, encounters, suspects] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const range = periodRange(period, anchor, custom);
  const isToday = period === "All" ? true : period === "Custom" ? !custom.from && !custom.to : anchor === iso(new Date());
  const visibleIds = new Set(rows.map((p) => p.id));
  const dayEncounters = useMemo(
    () => encounters
      .filter((e) => visibleIds.has(e.patientId) && e.date.slice(0, 10) >= range.from && e.date.slice(0, 10) <= range.to)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [encounters, range.from, range.to, rows] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Appointments page: fetch facility visits from HMIS for the selected period.
  useEffect(() => {
    if (view !== "encounter" || !authSession?.facilityId) {
      setLoadingAppointments(false);
      return;
    }
    let cancelled = false;
    setLoadingAppointments(true);
    loadAppointments({
      from: period === "All" ? undefined : range.from,
      to: period === "All" ? undefined : range.to,
    })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingAppointments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, authSession?.facilityId, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {view === "encounter" ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="encounter-period-toolbar">
            <select data-testid="period-select" value={period} onChange={(e) => { setPeriod(e.target.value); setAnchor(iso(new Date())); }}
              className="h-12 rounded-md border border-input bg-white px-3 text-sm font-semibold">
              {PERIODS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>

            {!["All", "Custom"].includes(period) && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-12 w-12" data-testid="period-prev-btn" onClick={() => setAnchor(shift(period, anchor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-[160px] px-2 text-center text-sm font-semibold" data-testid="period-label">{range.label}</span>
                <Button variant="outline" size="icon" className="h-12 w-12" data-testid="period-next-btn" onClick={() => setAnchor(shift(period, anchor, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
            {period === "Custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" data-testid="period-from" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="h-12 rounded-md border border-input bg-white px-3 text-sm" />
                <input type="date" data-testid="period-to" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="h-12 rounded-md border border-input bg-white px-3 text-sm" />
              </div>
            )}
            {period === "All" && <span className="text-sm font-semibold" data-testid="period-label">All time</span>}

            <button data-testid="today-btn" onClick={() => { setAnchor(iso(new Date())); setCustom({ from: "", to: "" }); }}
              className={`h-12 rounded-md border px-4 text-sm font-semibold ${isToday ? "border-border bg-white text-muted-foreground" : "border-primary bg-primary text-white"}`}>
              Today
            </button>
            <span className="text-sm text-muted-foreground" data-testid="encounter-count-label">{dayEncounters.length} encounter(s)</span>
          </div>
        ) : null}

        <div className="relative ml-auto min-w-0 flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="patient-search-input"
            placeholder="Search name, patient ID or episode ID"
            className="h-12 w-full min-w-0 bg-white pl-10 text-base"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button
          variant={activeFilters ? "default" : "outline"}
          className="h-12 shrink-0 px-4"
          data-testid="filter-toggle-btn"
          onClick={() => setShowFilters((v) => !v)}
          title="Filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilters > 0 && <span className="ml-2 text-xs font-bold">{activeFilters}</span>}
        </Button>
        <Button className="h-12 shrink-0" data-testid="new-patient-btn" onClick={() => navigate("/patients/new")}>
          <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Register patient</span>
        </Button>
      </div>

      {showFilters && (
        <div className="mb-4 grid gap-3 rounded-lg border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="filter-panel">
          <SelectField label="" options={villages} value={village} onChange={setVillage} placeholder="All villages" testid="patient-village-filter" />
          <SelectField
            label=""
            options={["Suspected", "Clinical", "Confirmed", "Crusted"]}
            value={status}
            onChange={setStatus}
            placeholder="All classifications"
            testid="patient-status-filter"
          />
          <SelectField
            label=""
            options={["Open / in treatment", "Cured / clinically resolved", "Improved", "Partially improved", "No improvement", "Treatment failure", "Recurrence", "Lost to follow-up", "Referred"]}
            value={outcome}
            onChange={setOutcome}
            placeholder="All treatment outcomes"
            testid="patient-outcome-filter"
          />
          <SelectField
            label=""
            options={DISEASES.map((d) => d.name)}
            value={disease}
            onChange={setDisease}
            placeholder="All diseases"
            testid="patient-disease-filter"
          />
          <SelectField
            label=""
            options={users.map((u) => u.name)}
            value={clinician}
            onChange={setClinician}
            placeholder="All clinicians"
            testid="patient-clinician-filter"
          />
          <Button
            variant="ghost"
            className="h-12"
            data-testid="clear-patient-filters-btn"
            onClick={() => {
              setVillage("");
              setStatus("");
              setOutcome("");
              setDisease("");
              setClinician("");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {view === "encounter" ? (
        <div className="space-y-3" data-testid="encounter-list">
          {loadingAppointments && dayEncounters.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
              <p className="font-semibold">Loading appointments…</p>
              <p className="mt-1 text-sm text-muted-foreground">Fetching encounters for {range.label}.</p>
            </div>
          )}
          {!loadingAppointments && dayEncounters.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
              <p className="font-semibold">No encounters in this period</p>
              <p className="mt-1 text-sm text-muted-foreground">{range.label} · use the arrows or change the duration.</p>
            </div>
          )}
          {dayEncounters.map((e) => {
            const pt = all.find((x) => x.id === e.patientId);
            if (!pt) return null;
            const visitSaved = e.pendingStart === false || e.complete === true || e.status === "Complete";
            const openAppointment = () => {
              const fromAppts = { state: { from: "/appointments" } };
              if (visitSaved && e.disease) {
                navigate(`/patients/${pt.id}/disease/${e.disease}`, fromAppts);
                return;
              }
              if (visitSaved) {
                navigate(`/patients/${pt.id}`, fromAppts);
                return;
              }
              navigate(`/patients/${pt.id}/encounter/${e.disease}?enc=${e.id}`, fromAppts);
            };
            const printAppointment = async (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              if (!visitSaved) {
                toast.error("Complete the encounter before printing a visit summary");
                return;
              }
              if (!e.disease) {
                toast.error("No disease linked to this appointment");
                return;
              }
              if (printingId) return;
              setPrintingId(e.id);
              try {
                let visitForPrint = { ...e, data: e.data || {} };
                try {
                  const loaded = await syncPatientVisitPhi?.(pt.id, {
                    visits: [
                      {
                        visitId: e.visitId || e.id,
                        recordId: e.recordId || e.episodeId || "",
                        disease: e.disease,
                        featureCode: e.featureCode,
                        encounterId: e.encounterId,
                      },
                    ],
                  });
                  const hit = (loaded || []).find((r) => String(r.visitId) === String(e.visitId || e.id));
                  if (hit?.form) {
                    visitForPrint = {
                      ...visitForPrint,
                      data: { ...(visitForPrint.data || {}), ...hit.form },
                      diagnosis: hit.form.diagnosis || visitForPrint.diagnosis || "",
                      outcome: hit.form.outcome || visitForPrint.outcome || "",
                    };
                  }
                } catch (err) {
                  console.warn("appointment print PHI sync failed", err);
                }

                const diseaseName = DISEASE_SPECS[e.disease]?.name || e.disease;
                const apptRaw = e.date || "";
                const apptDate = (() => {
                  if (!apptRaw) return "";
                  const d = new Date(/T/.test(apptRaw) ? apptRaw : `${apptRaw}T12:00:00`);
                  if (Number.isNaN(d.getTime())) return fmtDate(apptRaw);
                  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
                  return `${d.getDate()} ${m} ${d.getFullYear()}`;
                })();
                const clinicAddress = [
                  branding?.address,
                  [pt.village, pt.district, pt.province].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .join(branding?.address ? " · " : "");
                const featureRows = featureRowsFromVisits([visitForPrint]);
                const html = buildVisitSummaryPrintHtml({
                  patient: {
                    ...pt,
                    ageLabel: patientAgeLabel(pt),
                  },
                  clinic: {
                    name: branding?.clientName || e.facility || pt.facility || "Clinic",
                    phone: branding?.phone || "",
                    email: branding?.email || "",
                    address: clinicAddress,
                  },
                  clinician: {
                    name: e.worker || user?.name || "",
                    specialty: user?.role || user?.specialty || "",
                    appointmentDate: apptDate,
                  },
                  diseaseName,
                  episode: {
                    diagnosis: visitForPrint.diagnosis || e.diagnosis || "",
                    outcome: visitForPrint.outcome || e.outcome || "",
                  },
                  episodeCaption: [diseaseName, e.type].filter(Boolean).join(" · "),
                  episodeDates: e.date ? `Visit: ${fmtDateTime(e.date)}` : "",
                  featureRows,
                  worker: e.worker || user?.name || "",
                });
                setPrintPreviewHtml(html);
              } finally {
                setPrintingId("");
              }
            };
            return (
              <div key={e.id} role="button" tabIndex={0} data-testid={`encounter-row-${e.id}`}
                onClick={openAppointment}
                onKeyDown={(ev) => ev.key === "Enter" && openAppointment()}
                className="flex cursor-pointer items-center gap-4 rounded-lg border border-border bg-white p-4 transition-colors hover:border-primary">
                <Avatar patient={pt} testid={`encounter-photo-${e.id}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-head text-lg font-semibold leading-tight">{pt.name}</p>
                    <StatusChips
                      diseaseId={e.disease}
                      diagnosis={e.diagnosis}
                      outcome={e.outcome || pt.outcome}
                      testid={`encounter-status-${e.id}`}
                    />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{e.facility}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[
                      `${fmtDateTime(e.date)}`,
                      e.type || null,
                      e.worker || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <EncounterStatusChip encounter={e} testid={`encounter-workflow-status-${e.id}`} />
                  <PendingSyncChip pending={!e.synced} testid={`encounter-pending-${e.id}`} />
                  <button
                    type="button"
                    data-testid={`encounter-print-btn-${e.id}`}
                    onClick={printAppointment}
                    onMouseDown={(ev) => ev.stopPropagation()}
                    disabled={printingId === e.id}
                    className="grid h-11 w-11 place-items-center rounded-md border border-border text-primary transition-colors hover:bg-secondary disabled:opacity-50"
                    title="Print visit summary"
                    aria-label="Print visit summary"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  {pt.phone && (
                    <>
                      <a
                        href={`tel:${pt.phone.replace(/\s/g, "")}`}
                        data-testid={`encounter-call-btn-${e.id}`}
                        onClick={(ev) => ev.stopPropagation()}
                        className="grid h-11 w-11 place-items-center rounded-md border border-border text-primary transition-colors hover:bg-secondary"
                        title={`Call ${pt.phone}`}
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                      <a
                        href={`https://wa.me/${pt.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        data-testid={`encounter-whatsapp-btn-${e.id}`}
                        onClick={(ev) => ev.stopPropagation()}
                        className="grid h-11 w-11 place-items-center rounded-md border border-border text-green-700 transition-colors hover:bg-green-50"
                        title={`WhatsApp ${pt.phone}`}
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                      </a>
                    </>
                  )}
                  <ChevronRight className="hidden h-5 w-5 text-muted-foreground sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="stagger space-y-3" data-testid="patient-list">
        {loadingPatients && rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
            <p className="font-semibold">Loading patients…</p>
            <p className="mt-1 text-sm text-muted-foreground">Fetching registered patients for your facility.</p>
          </div>
        )}
        {!loadingPatients && rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
            <p className="font-semibold">No patients match your filters</p>
            <p className="mt-1 text-sm text-muted-foreground">Adjust the filters or register a new patient.</p>
          </div>
        )}
        {rows.map((p) => {
          const encs = encounters.filter((e) => e.patientId === p.id);
          const unsynced = encs.some((e) => !e.synced);
          const lastEnc = [...encs].sort((a, b) => b.date.localeCompare(a.date))[0];
          const statusRecords = patientStatusRecords(p, encounters, settings);
          const printPatientEncounters = async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (printingId) return;
            setPrintingId(p.id);
            try {
              let visits = encs
                .filter((e) => e.pendingStart === false || e.complete === true || e.status === "Complete" || (e.data && Object.keys(e.data).length))
                .slice();
              // Include all non-pending if we have any; otherwise all local encounters
              if (!visits.length) {
                visits = encs.filter((e) => !e.pendingStart).slice();
              }
              if (!visits.length) {
                visits = encs.slice();
              }

              try {
                const episodeRows = (await syncPatientEpisodes?.(p.id, { force: true })) || [];
                const phiVisits = (episodeRows.length ? episodeRows : visits).map((row) => ({
                  visitId: row.visitId || row.id,
                  recordId: row.recordId || row.episodeId || "",
                  disease: row.disease,
                  featureCode: row.featureCode,
                  encounterId: row.encounterId,
                }));
                const loaded = await syncPatientVisitPhi?.(p.id, { visits: phiVisits });
                const byVisit = new Map((loaded || []).map((r) => [String(r.visitId), r]));
                // Prefer hydrated list: merge PHI onto local encounters, keep chronological order
                const base = (episodeRows.length
                  ? episodeRows.map((row) => {
                      const id = String(row.visitId || row.id);
                      const local = encs.find((e) => String(e.id) === id || String(e.visitId) === id);
                      return {
                        ...(local || {}),
                        id,
                        visitId: id,
                        patientId: p.id,
                        recordId: row.recordId || local?.recordId || "",
                        disease: String(row.disease || local?.disease || "").toLowerCase(),
                        facility: row.locationName || local?.facility || "",
                        type: row.visitType || local?.type || "",
                        worker: row.clinicianName || local?.worker || "",
                        date: local?.date || (row.visitDate ? `${String(row.visitDate).slice(0, 10)}T12:00:00` : new Date().toISOString()),
                        diagnosis: local?.diagnosis || "",
                        outcome: local?.outcome || "",
                        data: local?.data || {},
                        pendingStart: row.pendingStart === true,
                        complete: row.pendingStart === false,
                      };
                    })
                  : visits
                ).filter((e) => !e.pendingStart || e.complete || (e.data && Object.keys(e.data).length));

                visits = (base.length ? base : visits).map((e) => {
                  const hit = byVisit.get(String(e.visitId || e.id));
                  if (!hit?.form) return e;
                  return {
                    ...e,
                    data: { ...(e.data || {}), ...hit.form },
                    diagnosis: hit.form.diagnosis || e.diagnosis || "",
                    outcome: hit.form.outcome || e.outcome || "",
                  };
                });
              } catch (err) {
                console.warn("patient print PHI sync failed", err);
              }

              visits = [...visits].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
              if (!visits.length) {
                toast.error("No encounters to print for this patient");
                return;
              }

              const clinicAddress = [
                branding?.address,
                [p.village, p.district, p.province].filter(Boolean).join(", "),
              ]
                .filter(Boolean)
                .join(branding?.address ? " · " : "");

              const html = buildPatientEncountersPrintHtml({
                patient: {
                  ...p,
                  ageLabel: patientAgeLabel(p),
                },
                clinic: {
                  name: branding?.clientName || p.facility || lastEnc?.facility || "Clinic",
                  phone: branding?.phone || "",
                  email: branding?.email || "",
                  address: clinicAddress,
                },
                clinician: {
                  name: user?.name || lastEnc?.worker || "",
                  specialty: user?.role || user?.specialty || "",
                },
                encounters: visits.map((e) => ({
                  diseaseName: DISEASE_SPECS[e.disease]?.name || e.disease || "Encounter",
                  encounter: {
                    ...e,
                    date: e.date ? fmtDateTime(e.date) : "",
                  },
                  featureRows: featureRowsFromVisits([e]),
                  caption: [e.type, e.facility].filter(Boolean).join(" · "),
                })),
                worker: user?.name || "",
              });
              setPrintPreviewHtml(html);
            } finally {
              setPrintingId("");
            }
          };
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/patients/${p.id}`, { state: { from: "/patients" } })}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/patients/${p.id}`, { state: { from: "/patients" } })}
              data-testid={`patient-card-${p.id}`}
              className="flex cursor-pointer items-center gap-4 rounded-lg border border-border bg-white p-4 transition-colors hover:border-primary sm:p-5"
            >
              <Avatar patient={p} testid={`patient-photo-${p.id}`} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-head text-lg font-semibold leading-tight sm:truncate">{p.name}</p>
                  <StatusChips
                    records={statusRecords}
                    testid={`patient-status-${p.id}`}
                  />
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {patientAgeLabel(p)} · {p.sex || p.gender || "—"} · {p.weight != null && p.weight !== "" ? `${p.weight}kg` : "—"} · Date of Birth {fmtDate(p.dob || dobFromAge(p.age, p.createdAt))} · Blood {p.bloodGroup || "Unknown"} · {[p.village, p.district].filter(Boolean).join(", ") || "—"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {p.patientCode ? `PID ${p.patientCode}` : "PID —"} · Last encounter {lastEnc ? fmtDate(lastEnc.date) : "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PendingSyncChip pending={unsynced} testid={`patient-pending-${p.id}`} />
                <button
                  type="button"
                  data-testid={`patient-print-btn-${p.id}`}
                  onClick={printPatientEncounters}
                  onMouseDown={(ev) => ev.stopPropagation()}
                  disabled={printingId === p.id}
                  className="grid h-11 w-11 place-items-center rounded-md border border-border text-primary transition-colors hover:bg-secondary disabled:opacity-50"
                  title="Print all encounters"
                  aria-label="Print all encounters"
                >
                  <Printer className="h-4 w-4" />
                </button>
                {p.phone && (
                  <>
                    <a
                      href={`tel:${p.phone.replace(/\s/g, "")}`}
                      data-testid={`call-btn-${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="grid h-11 w-11 place-items-center rounded-md border border-border text-primary transition-colors hover:bg-secondary"
                      title={`Call ${p.phone}`}
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    <a
                      href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`whatsapp-btn-${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="grid h-11 w-11 place-items-center rounded-md border border-border text-green-700 transition-colors hover:bg-green-50"
                      title={`WhatsApp ${p.phone}`}
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </a>
                  </>
                )}
                <ChevronRight className="hidden h-5 w-5 text-muted-foreground sm:block" />
              </div>
            </div>
          );
        })}
      </div>
      )}

      <Dialog open={Boolean(printPreviewHtml)} onOpenChange={(o) => !o && setPrintPreviewHtml("")}>
        <DialogContent
          className="flex max-h-[92vh] w-[min(960px,calc(100vw-1rem))] max-w-[min(960px,calc(100vw-1rem))] flex-col gap-3 overflow-hidden p-3 sm:p-4"
          data-testid="visit-summary-preview-dialog"
        >
          <DialogHeader className="shrink-0 space-y-1 pr-8">
            <DialogTitle className="font-head text-lg sm:text-xl">Visit Summary</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-white">
            {printPreviewHtml ? (
              <iframe
                title="Visit summary preview"
                srcDoc={printPreviewHtml}
                className="h-[min(70vh,720px)] w-full border-0 bg-white"
                data-testid="visit-summary-preview-frame"
              />
            ) : null}
          </div>
          <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto"
              data-testid="visit-summary-preview-close"
              onClick={() => setPrintPreviewHtml("")}
            >
              Close
            </Button>
            <Button
              className="h-11 w-full sm:w-auto"
              data-testid="visit-summary-preview-print"
              onClick={() => {
                if (!printHtmlDocument(printPreviewHtml)) {
                  toast.error("Could not prepare print view");
                }
              }}
            >
              <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
