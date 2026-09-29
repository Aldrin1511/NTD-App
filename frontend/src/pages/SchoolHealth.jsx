import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TextField, SelectField, AreaField, ChoiceRow, MultiSelectField, AlertPanel, Field } from "@/components/Fields";
import { ChoiceChips, YesNo } from "@/components/EntryKit";
import { PhotoCapture, ageYmdFromDob, dobFromAgeYmd } from "@/components/Capture";
import { GEO } from "@/mock/data";
import { fmtDate, localISODate } from "@/mock/specs";
import {
  SCHOOL_FORM_TYPES,
  PHYSICAL_EXAM_ITEMS,
  SCHOOL_IMMUNIZATION,
  childStatus,
  emptyChild,
  formatChildAge,
  negativeExamItems,
  immunSummary,
  isSuspectedNtd,
  deriveVisitStatus,
  visitStatusBadgeCls,
  visitImmunTotals,
} from "@/mock/schoolhealth";
import { useFormDirty } from "@/lib/useFormDirty";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Users, Pencil, Trash2, FileText, Printer, School,
  Search, SlidersHorizontal, Info, CloudOff,
} from "lucide-react";

const dot = { red: "bg-red-500", amber: "bg-amber-500", green: "bg-green-500" };

/* ------------------------------- LIST VIEW ------------------------------- */
export default function SchoolHealth() {
  const navigate = useNavigate();
  const { schoolHealth, addSchoolVisit, user, users, schools, donors } = useStore();
  const [dlg, setDlg] = useState(false);
  const [v, setV] = useState({
    date: localISODate(),
    formType: SCHOOL_FORM_TYPES[0],
    province: "",
    district: "",
    village: "",
    school: "",
    donor: "",
  });
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [fProvince, setFProvince] = useState("");
  const [fDistrict, setFDistrict] = useState("");
  const [fSchool, setFSchool] = useState("");
  const [fDonor, setFDonor] = useState("");
  const [fCreatedBy, setFCreatedBy] = useState("");
  const [fFormType, setFFormType] = useState("");
  const canEdit = user?.canEdit;

  const schoolNames = (schools || []).map((s) => s.name);
  const donorNames = (donors || []).map((d) => d.name);
  const creatorOptions = useMemo(() => {
    const names = new Set((users || []).map((u) => u.name).filter(Boolean));
    (schoolHealth || []).forEach((visit) => { if (visit.worker) names.add(visit.worker); });
    return [...names].sort();
  }, [users, schoolHealth]);

  const activeFilters = [fProvince, fDistrict, fSchool, fDonor, fCreatedBy, fFormType].filter(Boolean).length;

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (schoolHealth || []).filter((visit) => {
      if (fProvince && visit.province !== fProvince) return false;
      if (fDistrict && visit.district !== fDistrict) return false;
      if (fSchool && visit.school !== fSchool) return false;
      if (fDonor && visit.donor !== fDonor) return false;
      if (fFormType && visit.formType !== fFormType) return false;
      if (fCreatedBy && visit.worker !== fCreatedBy) return false;
      if (qq) {
        const hay = [
          visit.school, visit.donor, visit.formType, visit.province, visit.district,
          visit.village, visit.worker, visit.id,
          ...(visit.children || []).flatMap((c) => [c.firstName, c.lastName]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [schoolHealth, q, fProvince, fDistrict, fSchool, fDonor, fCreatedBy, fFormType]);

  const onPickSchool = (name) => {
    const master = (schools || []).find((s) => s.name === name);
    if (master) {
      setV((s) => ({
        ...s,
        school: name,
        province: master.province || s.province,
        district: master.district || s.district,
        village: master.village || s.village,
      }));
    } else setV((s) => ({ ...s, school: name }));
  };

  const create = () => {
    if (!v.province || !v.school) return toast.error("Province and School are required");
    if (!v.formType) return toast.error("Form type is required");
    const rec = addSchoolVisit({
      ...v,
      worker: user?.name || "",
      status: "New",
    });
    setDlg(false);
    setV({
      date: localISODate(),
      formType: SCHOOL_FORM_TYPES[0],
      province: "",
      district: "",
      village: "",
      school: "",
      donor: "",
    });
    navigate(`/school-health/${rec.id}`);
  };

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <School className="h-6 w-6 text-primary" />
          <h1 className="font-head text-2xl font-bold tracking-tight">School Health</h1>
        </div>
        <Button className="ml-auto h-11" disabled={!canEdit} data-testid="sh-add-visit" onClick={() => setDlg(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add School health visit
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9"
            placeholder="Search school, donor, child, created by…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="sh-search"
          />
        </div>
        <Button
          variant={activeFilters ? "default" : "outline"}
          className="h-11"
          data-testid="sh-filters-toggle"
          onClick={() => setShowFilters((x) => !x)}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
          {activeFilters > 0 && <span className="ml-2 text-xs font-bold">{activeFilters}</span>}
        </Button>
      </div>

      {showFilters && (
        <div className="mb-4 grid gap-3 rounded-lg border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="sh-filters">
          <SelectField label="Province" options={Object.keys(GEO)} value={fProvince} onChange={(x) => { setFProvince(x); setFDistrict(""); }} placeholder="All provinces" testid="sh-filter-province" />
          <SelectField label="District" options={Object.keys(GEO[fProvince] || {})} value={fDistrict} onChange={setFDistrict} placeholder="All districts" testid="sh-filter-district" />
          <SelectField label="School" options={schoolNames} value={fSchool} onChange={setFSchool} placeholder="All schools" testid="sh-filter-school" />
          <SelectField label="Donor" options={donorNames} value={fDonor} onChange={setFDonor} placeholder="All donors" testid="sh-filter-donor" />
          <SelectField label="Created by" options={creatorOptions} value={fCreatedBy} onChange={setFCreatedBy} placeholder="Anyone" testid="sh-filter-created-by" />
          <SelectField label="Form type" options={SCHOOL_FORM_TYPES} value={fFormType} onChange={setFFormType} placeholder="All form types" testid="sh-filter-form-type" />
          <Button
            variant="ghost"
            className="h-12"
            data-testid="sh-clear-filters"
            onClick={() => { setFProvince(""); setFDistrict(""); setFSchool(""); setFDonor(""); setFCreatedBy(""); setFFormType(""); }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {filtered.length === 0 && (
        <AlertPanel level="info" title="No school health visits yet" testid="sh-empty">
          Click Add School health visit to record a new screening. Manage Schools and Donors under Admin → Masters.
        </AlertPanel>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="sh-list">
        {filtered.map((visit) => {
          const m = (visit.children || []).filter((c) => c.gender === "Male").length;
          const f = (visit.children || []).filter((c) => c.gender === "Female").length;
          const status = deriveVisitStatus(visit);
          return (
            <button
              key={visit.id}
              type="button"
              data-testid={`sh-card-${visit.id}`}
              onClick={() => navigate(`/school-health/${visit.id}`)}
              className={`rounded-lg border p-4 text-left hover:shadow-sm ${
                status === "Completed"
                  ? "border-green-300 bg-green-50/40 hover:border-green-400"
                  : "border-border bg-white hover:border-primary"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-head text-lg font-bold">{visit.school}</p>
                <Badge variant="outline" className={`rounded font-semibold ${visitStatusBadgeCls(status)}`} data-testid={`sh-card-status-${visit.id}`}>{status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[visit.formType, visit.village, visit.district, visit.province].filter(Boolean).join(" · ")}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-1.5 text-sm">
                <div><dt className="text-[11px] text-muted-foreground">Date</dt><dd className="font-semibold">{fmtDate(visit.date)}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Donor</dt><dd className="font-semibold">{visit.donor || "—"}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Students (M/F)</dt><dd className="font-semibold">{m}/{f} · {visit.children?.length || 0}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Created by</dt><dd className="font-semibold">{visit.worker || "—"}</dd></div>
              </dl>
            </button>
          );
        })}
      </div>

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md" data-testid="sh-add-dialog">
          <DialogHeader><DialogTitle className="font-head text-xl">Add School health visit</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <SelectField label="Province" options={Object.keys(GEO)} value={v.province || ""} onChange={(x) => setV({ ...v, province: x, district: "", village: "" })} testid="sh-province" />
            <SelectField label="District" options={Object.keys(GEO[v.province] || {})} value={v.district || ""} onChange={(x) => setV({ ...v, district: x, village: "" })} testid="sh-district" />
            <SelectField label="Village" options={(GEO[v.province]?.[v.district]) || []} value={v.village || ""} onChange={(x) => setV({ ...v, village: x })} testid="sh-village" />
            <SelectField label="School" options={schoolNames} value={v.school || ""} onChange={onPickSchool} testid="sh-school" hint="Admin → Masters → Schools" />
            <SelectField label="Donor" options={donorNames} value={v.donor || ""} onChange={(x) => setV({ ...v, donor: x })} testid="sh-donor" hint="Admin → Masters → Donors" />
            <ChoiceChips label="Form type" options={SCHOOL_FORM_TYPES} value={v.formType || ""} onChange={(ft) => setV({ ...v, formType: ft })} testid="sh-form-type" />
            <TextField label="Date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} testid="sh-date" />
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <span className="text-muted-foreground">Created by:</span> <strong>{user?.name || "—"}</strong>
              <p className="mt-1 text-xs text-muted-foreground">Status starts as New, then In Progress when children are added, Completed after the report is finished.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={() => setDlg(false)}>Cancel</Button>
            <Button className="h-11" data-testid="sh-create" onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/* ------------------------------ DETAIL VIEW ------------------------------ */
export function SchoolHealthVisit() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const {
    schoolHealth, saveSchoolChild, removeSchoolChild, saveSchoolReport,
    updateSchoolVisit, user, users, online,
  } = useStore();
  const visit = schoolHealth.find((v) => v.id === visitId);
  const canEdit = user?.canEdit;
  const [child, setChild] = useState(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [reportMode, setReportMode] = useState(false);
  const [summary, setSummary] = useState("");
  const [conductedBy, setConductedBy] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [conductedQ, setConductedQ] = useState("");
  const [offlineInfo, setOfflineInfo] = useState(null);

  const dirtyKey = child ? `${child.id || "new"}-${visitId}` : "idle";
  const { dirty, markSaved } = useFormDirty(child || {}, dirtyKey);

  if (!visit) {
    return (
      <AppShell>
        <AlertPanel level="info" title="Visit not found" testid="shv-missing">
          <Button onClick={() => navigate("/school-health")}>Back</Button>
        </AlertPanel>
      </AppShell>
    );
  }

  const status = deriveVisitStatus(visit);
  const children = visit.children || [];
  const mCount = children.filter((c) => c.gender === "Male").length;
  const fCount = children.filter((c) => c.gender === "Female").length;
  const totals = visitImmunTotals(visit);

  const userNames = (users || []).map((u) => u.name).filter(Boolean).sort();
  const conductedOptions = userNames.filter((n) => {
    if (conductedBy.includes(n)) return true;
    if (!conductedQ.trim()) return true;
    return n.toLowerCase().includes(conductedQ.trim().toLowerCase());
  });

  const setC = (patch) => setChild((c) => ({ ...c, ...patch }));
  const setExam = (item, opt) =>
    setChild((c) => ({
      ...c,
      exam: {
        ...c.exam,
        [item]: { ...(c.exam?.[item] || {}), result: c.exam?.[item]?.result === opt ? "" : opt },
      },
    }));
  const setImmun = (k, val) => setChild((c) => ({ ...c, immun: { ...c.immun, [k]: val } }));

  const setAgePart = (part, value) => {
    setChild((c) => {
      const next = { ...c, [part]: value };
      next.dob = dobFromAgeYmd({ y: next.ageY, m: next.ageM, d: next.ageD });
      next.age = next.ageY || "";
      return next;
    });
  };

  const setDob = (dob) => {
    const parts = ageYmdFromDob(dob);
    setChild((c) => ({ ...c, dob, ageY: parts.y, ageM: parts.m, ageD: parts.d, age: parts.y }));
  };

  const openChild = (c) => {
    const base = c ? { ...emptyChild(), ...c } : emptyChild();
    if (!base.ageY && base.age) base.ageY = String(base.age);
    if (base.dob && !base.ageY) {
      const parts = ageYmdFromDob(base.dob);
      Object.assign(base, { ageY: parts.y, ageM: parts.m, ageD: parts.d });
    }
    setChild(base);
  };

  const requestCloseChild = () => {
    if (dirty) setDiscardOpen(true);
    else setChild(null);
  };

  const saveChild = () => {
    if (!child.firstName) return toast.error("First name is required");
    saveSchoolChild(visit.id, child);
    markSaved(child);
    toast.success(online ? "Child saved" : "Child saved · queued until online");
    setChild(null);
    setDiscardOpen(false);
  };

  const openReport = () => {
    setSummary(visit.report?.summary || "");
    setConductedBy(visit.report?.conductedBy || []);
    setPhotos(visit.report?.photos || []);
    setConductedQ("");
    setReportMode(true);
  };

  const saveRep = (complete = false) => {
    const t = visitImmunTotals(visit);
    saveSchoolReport(visit.id, {
      summary,
      conductedBy,
      photos,
      completed: complete || visit.report?.completed || false,
      totals: t,
      generatedBy: user?.name,
      generatedAt: localISODate(),
    });
    toast.success(complete ? "Report completed" : "Report saved");
    if (complete) setReportMode(false);
  };

  if (reportMode) {
    return (
      <AppShell>
        <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
          <Button variant="outline" className="h-11" onClick={() => setReportMode(false)} data-testid="shv-report-back">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" className="h-11" onClick={() => saveRep(false)} data-testid="shv-report-save">Save report</Button>
            <Button className="h-11" onClick={() => saveRep(true)} data-testid="shv-report-complete">Save &amp; mark Completed</Button>
            <Button className="h-11" variant="secondary" onClick={() => window.print()} data-testid="shv-report-print">
              <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-3xl space-y-4 rounded-lg border border-border bg-white p-6" data-testid="shv-report">
          <h1 className="font-head text-2xl font-bold">School Health Report</h1>
          <p className="text-sm text-muted-foreground">
            {visit.school} · {[visit.formType, visit.village, visit.district, visit.province].filter(Boolean).join(", ")}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              ["Date", fmtDate(visit.date)],
              ["Donor", visit.donor || "—"],
              ["Status", status],
              ["Created by", visit.worker || "—"],
              ["Students (M/F)", `${mCount}/${fCount}`],
              ["Total children", String(children.length)],
            ].map(([k, val]) => (
              <div key={k}><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="font-semibold">{val}</dd></div>
            ))}
          </dl>

          <div className="space-y-3 print:hidden">
            <Input
              className="h-11"
              placeholder="Search users for Conducted by…"
              value={conductedQ}
              onChange={(e) => setConductedQ(e.target.value)}
              data-testid="shv-conducted-search"
            />
            <MultiSelectField
              label="Conducted by"
              options={conductedOptions}
              value={conductedBy}
              onChange={setConductedBy}
              placeholder="Add clinician…"
              testid="shv-conducted-by"
            />
            <PhotoCapture label="Visit photos" photos={photos} onChange={setPhotos} testid="shv-photos" max={6} />
            <AreaField label="Visit summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} testid="shv-report-summary" />
          </div>

          {(conductedBy.length > 0 || summary) && (
            <div className="hidden print:block space-y-2">
              {conductedBy.length > 0 && (
                <div>
                  <p className="text-sm font-semibold">Conducted by</p>
                  <p className="text-sm">{conductedBy.join(", ")}</p>
                </div>
              )}
              {summary && (
                <div>
                  <p className="text-sm font-semibold">Summary</p>
                  <p className="whitespace-pre-line text-sm">{summary}</p>
                </div>
              )}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 text-sm sm:grid-cols-5" data-testid="shv-report-totals">
            <div><dt className="text-[11px] text-muted-foreground">Measles Rubella</dt><dd className="text-lg font-semibold">{totals.mr}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Vitamin A</dt><dd className="text-lg font-semibold">{totals.vita}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">TT</dt><dd className="text-lg font-semibold">{totals.tt}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Deworming</dt><dd className="text-lg font-semibold">{totals.deworm}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Suspected NTD</dt><dd className="text-lg font-semibold">{totals.ntd}</dd></div>
          </dl>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="shv-report-photos">
              {photos.map((ph, i) => (
                <img key={i} src={ph} alt={`Visit photo ${i + 1}`} className="h-28 w-full rounded-md border border-border object-cover" />
              ))}
            </div>
          )}

          <h2 className="font-head text-lg font-semibold">Children screened</h2>
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-1">Name</th>
                <th>Sex / Age</th>
                <th>Wt/Ht/MUAC</th>
                <th>Negative exam</th>
                <th>Immunization</th>
                <th>NTD</th>
                <th>Referred</th>
              </tr>
            </thead>
            <tbody>
              {children.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-1">{c.firstName} {c.lastName}</td>
                  <td>{c.gender || "—"} · {formatChildAge(c)}</td>
                  <td>{c.weight || "—"}/{c.height || "—"}/{c.muac || "—"}</td>
                  <td>{negativeExamItems(c).join(", ") || "—"}</td>
                  <td>{immunSummary(c)}</td>
                  <td>{isSuspectedNtd(c) ? "Yes" : "No"}</td>
                  <td>{c.referred === "Yes" ? `Yes — ${c.referNote || ""}` : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" className="h-11" onClick={() => navigate("/school-health")} data-testid="shv-back">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="min-w-0">
          <h1 className="font-head text-2xl font-bold tracking-tight">{visit.school}</h1>
          <p className="text-sm text-muted-foreground">
            {[visit.formType, visit.village, visit.district, visit.province].filter(Boolean).join(", ")} · {fmtDate(visit.date)}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`rounded h-9 px-3 text-sm font-semibold ${visitStatusBadgeCls(status)}`} data-testid="shv-status">{status}</Badge>
          <Button className="h-11" onClick={openReport} data-testid="shv-create-report">
            <FileText className="mr-2 h-4 w-4" />{" "}
            {(visit.report?.completed
              || visit.report?.summary
              || (visit.report?.conductedBy || []).length > 0
              || (visit.report?.photos || []).length > 0)
              ? "Edit report"
              : "Create report"}
          </Button>
        </div>
      </div>

      <div className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Created by:</span> <strong>{visit.worker || "—"}</strong>
        {!online && (
          <span className="ml-3 inline-flex items-center gap-1 text-orange-700">
            <CloudOff className="h-4 w-4" /> Offline — entries queue until sync is confirmed
          </span>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{children.length} children · {mCount}M / {fCount}F</span>
        <Button className="ml-auto h-10" disabled={!canEdit} data-testid="shv-add-child" onClick={() => openChild(null)}>
          <Plus className="mr-1 h-4 w-4" /> Add child
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm" data-testid="shv-children-table">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="min-w-[14rem] p-3 font-semibold sm:min-w-[18rem]">Name</th>
              <th className="whitespace-nowrap p-3 font-semibold">Wt/Ht/MUAC</th>
              <th className="min-w-[14rem] max-w-[22rem] p-3 font-semibold">Negative exam</th>
              <th className="p-3 font-semibold">Immunization</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Referred</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {children.length === 0 && (
              <tr><td colSpan={7} className="p-3 text-muted-foreground">No children added yet.</td></tr>
            )}
            {children.map((c) => {
              const offline = c.offlineEntered || visit.synced === false;
              return (
                <tr key={c.id} className="border-b border-border/60" data-testid={`shv-child-row-${c.id}`}>
                  <td className="min-w-[14rem] p-3 sm:min-w-[18rem]">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-muted-foreground">{formatChildAge(c)} · {c.gender || "—"}</p>
                      </div>
                      {offline && (
                        <button
                          type="button"
                          className="mt-0.5 shrink-0 rounded p-1 text-orange-700 hover:bg-orange-50"
                          title="Offline entered details"
                          data-testid={`shv-offline-${c.id}`}
                          onClick={() => setOfflineInfo(c)}
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap p-3">{c.weight || "—"}/{c.height || "—"}/{c.muac || "—"}</td>
                  <td className="max-w-[22rem] p-3 text-xs">
                    <p className="whitespace-normal break-words leading-snug">
                      {negativeExamItems(c).join(", ") || "—"}
                    </p>
                  </td>
                  <td className="p-3 text-xs">{immunSummary(c)}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5 font-semibold capitalize">
                      <span className={`h-2.5 w-2.5 rounded-full ${dot[childStatus(c)]}`} />
                      {childStatus(c)}
                    </span>
                  </td>
                  <td className="p-3">{c.referred === "Yes" ? "Yes" : "No"}</td>
                  <td className="p-3 text-right">
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openChild(c)} data-testid={`shv-edit-child-${c.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => removeSchoolChild(visit.id, c.id)} data-testid={`shv-remove-child-${c.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!child} onOpenChange={(o) => { if (!o) requestCloseChild(); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl" data-testid="shv-child-dialog" onPointerDownOutside={(e) => { if (dirty) { e.preventDefault(); setDiscardOpen(true); } }}>
          <DialogHeader>
            <DialogTitle className="font-head text-xl">{child?.id ? "Edit child" : "Add child"}</DialogTitle>
          </DialogHeader>
          {child && (
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="First name" value={child.firstName} onChange={(e) => setC({ firstName: e.target.value })} testid="shv-c-first" />
                  <TextField label="Last (father's) name" value={child.lastName} onChange={(e) => setC({ lastName: e.target.value })} testid="shv-c-last" />
                </div>
                <ChoiceRow label="Gender" options={["Male", "Female", "Other"]} value={child.gender} onChange={(g) => setC({ gender: g })} testid="shv-c-gender" />
              </section>

              <section className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,11.5rem)_1fr] sm:items-start">
                  <TextField label="Date of birth" type="date" value={child.dob || ""} allowEmpty onChange={(e) => setDob(e.target.value)} testid="shv-c-dob" />
                  <Field label="Age">
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="Years"
                        aria-label="Years"
                        className="h-12 w-full min-w-0 bg-white text-base"
                        value={child.ageY || ""}
                        onChange={(e) => setAgePart("ageY", e.target.value)}
                        data-testid="shv-c-age-y"
                      />
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={11}
                        placeholder="Months"
                        aria-label="Months"
                        className="h-12 w-full min-w-0 bg-white text-base"
                        value={child.ageM || ""}
                        onChange={(e) => setAgePart("ageM", e.target.value)}
                        data-testid="shv-c-age-m"
                      />
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={31}
                        placeholder="Days"
                        aria-label="Days"
                        className="h-12 w-full min-w-0 bg-white text-base"
                        value={child.ageD || ""}
                        onChange={(e) => setAgePart("ageD", e.target.value)}
                        data-testid="shv-c-age-d"
                      />
                    </div>
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <p className="font-head text-sm font-semibold text-primary">Anthropometry</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField label="Weight (kg)" type="number" value={child.weight} onChange={(e) => setC({ weight: e.target.value })} testid="shv-c-weight" />
                  <TextField label="Height (cm)" type="number" value={child.height} onChange={(e) => setC({ height: e.target.value })} testid="shv-c-height" />
                  <TextField label="MUAC (cm)" type="number" value={child.muac} onChange={(e) => setC({ muac: e.target.value })} testid="shv-c-muac" />
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">Vitals status</span>
                  <span className="font-semibold capitalize">
                    <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle ${dot[childStatus(child)]}`} />
                    {childStatus(child)}
                  </span>
                </div>
              </section>

              <section className="space-y-3">
                <p className="font-head text-sm font-semibold text-primary">Physical examination</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PHYSICAL_EXAM_ITEMS.map((item) => (
                    <div key={item} className="flex flex-col gap-2 rounded-md border border-border bg-white p-3">
                      <span className="text-sm font-medium leading-snug">{item}</span>
                      <div className="flex gap-2">
                        {["Normal", "Abnormal"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            data-testid={`shv-exam-${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${opt.toLowerCase()}`}
                            onClick={() => setExam(item, opt)}
                            className={`h-9 flex-1 rounded-md px-2 text-xs font-semibold transition-colors ${
                              child.exam?.[item]?.result === opt
                                ? opt === "Abnormal"
                                  ? "bg-red-600 text-white"
                                  : "bg-primary text-white"
                                : "border border-border bg-white hover:bg-muted"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3" data-testid="shv-immun">
                <p className="font-head text-sm font-semibold text-primary">Immunization</p>
                <div className="space-y-3">
                  {SCHOOL_IMMUNIZATION.map((v) => (
                    <ChoiceChips
                      key={v.k}
                      label={v.label}
                      options={["Yes", "No"]}
                      value={child.immun?.[v.k] || ""}
                      onChange={(val) => setImmun(v.k, val)}
                      testid={`shv-immun-${v.k}`}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <YesNo label="To be referred?" value={child.referred} onChange={(v) => setC({ referred: v })} testid="shv-referred" />
                {child.referred === "Yes" && (
                  <AreaField label="Referral reason" rows={2} value={child.referNote} onChange={(e) => setC({ referNote: e.target.value })} testid="shv-refer-note" />
                )}
              </section>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={requestCloseChild} data-testid="shv-child-cancel">Cancel</Button>
            <Button className="h-11" data-testid="shv-save-child" onClick={saveChild}>Save child</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="sm:max-w-md" data-testid="shv-discard-dialog">
          <DialogHeader>
            <DialogTitle>Save changes?</DialogTitle>
            <DialogDescription>You have entered information that is not saved yet. Save the child, or clear and discard?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="h-11"
              data-testid="shv-discard-clear"
              onClick={() => { setDiscardOpen(false); setChild(null); }}
            >
              Clear
            </Button>
            <Button className="h-11" data-testid="shv-discard-save" onClick={saveChild}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!offlineInfo} onOpenChange={(o) => !o && setOfflineInfo(null)}>
        <DialogContent className="sm:max-w-md" data-testid="shv-offline-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudOff className="h-5 w-5 text-orange-700" /> Offline entry details
            </DialogTitle>
            <DialogDescription>This child record was entered offline or is waiting to sync.</DialogDescription>
          </DialogHeader>
          {offlineInfo && (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-[11px] text-muted-foreground">Child</dt><dd className="font-semibold">{offlineInfo.firstName} {offlineInfo.lastName}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Age / Sex</dt><dd className="font-semibold">{formatChildAge(offlineInfo)} · {offlineInfo.gender || "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Offline at</dt><dd className="font-semibold">{offlineInfo.offlineAt ? new Date(offlineInfo.offlineAt).toLocaleString() : "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Immunization</dt><dd className="font-semibold">{immunSummary(offlineInfo)}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Negative exam</dt><dd className="font-semibold">{negativeExamItems(offlineInfo).join(", ") || "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Visit sync</dt><dd className="font-semibold">{visit.synced === false ? "Pending sync" : "Synced"}</dd></div>
            </dl>
          )}
          <DialogFooter>
            <Button className="h-11" onClick={() => setOfflineInfo(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
