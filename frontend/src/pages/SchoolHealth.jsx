import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TextField, SelectField, AreaField, ChoiceRow, AlertPanel } from "@/components/Fields";
import { YesNo } from "@/components/EntryKit";
import { GEO } from "@/mock/data";
import { fmtDate, localISODate } from "@/mock/specs";
import { SCHOOL_STATUSES, PHYSICAL_EXAM_ITEMS, SCHOOL_IMMUNIZATION, childStatus, emptyChild } from "@/mock/schoolhealth";
import { toast } from "sonner";
import { ArrowLeft, Plus, Users, Pencil, Trash2, FileText, Printer, School } from "lucide-react";

const dot = { red: "bg-red-500", amber: "bg-amber-500", green: "bg-green-500" };

/* ------------------------------- LIST VIEW ------------------------------- */
export default function SchoolHealth() {
  const navigate = useNavigate();
  const { schoolHealth, addSchoolVisit, user } = useStore();
  const [dlg, setDlg] = useState(false);
  const [v, setV] = useState({ date: localISODate(), status: "Planned", conductedBy: user?.name || "" });
  const canEdit = user?.canEdit;

  const create = () => {
    if (!v.province || !v.school) return toast.error("Province and School are required");
    const rec = addSchoolVisit(v);
    setDlg(false);
    setV({ date: localISODate(), status: "Planned", conductedBy: user?.name || "" });
    navigate(`/school-health/${rec.id}`);
  };

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2"><School className="h-6 w-6 text-primary" /><h1 className="font-head text-2xl font-bold tracking-tight">School Health</h1></div>
        <Button className="ml-auto h-11" disabled={!canEdit} data-testid="sh-add-visit" onClick={() => setDlg(true)}><Plus className="mr-1 h-4 w-4" /> Add visit</Button>
      </div>

      {schoolHealth.length === 0 && <AlertPanel level="info" title="No school health visits yet" testid="sh-empty">Click Add visit to record a new school health screening.</AlertPanel>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="sh-list">
        {schoolHealth.map((visit) => {
          const m = (visit.children || []).filter((c) => c.gender === "Male").length;
          const f = (visit.children || []).filter((c) => c.gender === "Female").length;
          return (
            <button key={visit.id} type="button" data-testid={`sh-card-${visit.id}`} onClick={() => navigate(`/school-health/${visit.id}`)} className="rounded-lg border border-border bg-white p-4 text-left hover:border-primary hover:shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-head text-lg font-bold">{visit.school}</p>
                <Badge variant="outline" className="rounded">{visit.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{[visit.village, visit.district, visit.province].filter(Boolean).join(", ")}</p>
              <dl className="mt-3 grid grid-cols-2 gap-1.5 text-sm">
                <div><dt className="text-[11px] text-muted-foreground">Date</dt><dd className="font-semibold">{fmtDate(visit.date)}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Donor</dt><dd className="font-semibold">{visit.donor || "—"}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Students (M/F)</dt><dd className="font-semibold">{m}/{f} · {visit.children?.length || 0}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Conducted by</dt><dd className="font-semibold">{visit.conductedBy || "—"}</dd></div>
              </dl>
            </button>
          );
        })}
      </div>

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md" data-testid="sh-add-dialog">
          <DialogHeader><DialogTitle className="font-head text-xl">Add school health visit</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <SelectField label="Province" options={Object.keys(GEO)} value={v.province || ""} onChange={(x) => setV({ ...v, province: x, district: "", village: "" })} testid="sh-province" />
            <SelectField label="District" options={Object.keys(GEO[v.province] || {})} value={v.district || ""} onChange={(x) => setV({ ...v, district: x, village: "" })} testid="sh-district" />
            <SelectField label="Village" options={(GEO[v.province]?.[v.district]) || []} value={v.village || ""} onChange={(x) => setV({ ...v, village: x })} testid="sh-village" />
            <TextField label="School" value={v.school || ""} onChange={(e) => setV({ ...v, school: e.target.value })} testid="sh-school" />
            <TextField label="Donor" value={v.donor || ""} onChange={(e) => setV({ ...v, donor: e.target.value })} testid="sh-donor" />
            <SelectField label="Status" options={SCHOOL_STATUSES} value={v.status} onChange={(x) => setV({ ...v, status: x })} testid="sh-status" />
            <TextField label="Conducted by" value={v.conductedBy || ""} onChange={(e) => setV({ ...v, conductedBy: e.target.value })} testid="sh-conducted" />
            <TextField label="Date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} testid="sh-date" />
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" className="h-11" onClick={() => setDlg(false)}>Cancel</Button><Button className="h-11" data-testid="sh-create" onClick={create}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/* ------------------------------ DETAIL VIEW ------------------------------ */
export function SchoolHealthVisit() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const { schoolHealth, saveSchoolChild, removeSchoolChild, saveSchoolReport, updateSchoolVisit, user } = useStore();
  const visit = schoolHealth.find((v) => v.id === visitId);
  const canEdit = user?.canEdit;
  const [child, setChild] = useState(null);
  const [reportMode, setReportMode] = useState(false);
  const [summary, setSummary] = useState(visit?.report?.summary || "");

  if (!visit) return <AppShell><AlertPanel level="info" title="Visit not found" testid="shv-missing"><Button onClick={() => navigate("/school-health")}>Back</Button></AlertPanel></AppShell>;

  const setC = (patch) => setChild((c) => ({ ...c, ...patch }));
  const setExam = (item, patch) => setChild((c) => ({ ...c, exam: { ...c.exam, [item]: { ...(c.exam?.[item] || {}), ...patch } } }));
  const toggleImmun = (k, dose) => setChild((c) => { const cur = c.immun?.[k] || []; const next = cur.includes(dose) ? cur.filter((x) => x !== dose) : [...cur, dose]; return { ...c, immun: { ...c.immun, [k]: next } }; });
  const saveChild = () => { if (!child.firstName) return toast.error("First name is required"); saveSchoolChild(visit.id, child); toast.success("Child saved"); setChild(null); };

  const children = visit.children || [];
  const mCount = children.filter((c) => c.gender === "Male").length;
  const fCount = children.filter((c) => c.gender === "Female").length;

  if (reportMode) {
    const saveRep = () => { saveSchoolReport(visit.id, { summary, generatedBy: user?.name, generatedAt: localISODate() }); toast.success("Report saved"); };
    return (
      <AppShell>
        <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
          <Button variant="outline" className="h-11" onClick={() => setReportMode(false)} data-testid="shv-report-back"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" className="h-11" onClick={saveRep} data-testid="shv-report-save">Save report</Button>
            <Button className="h-11" onClick={() => window.print()} data-testid="shv-report-print"><Printer className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
          </div>
        </div>
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-white p-6" data-testid="shv-report">
          <h1 className="font-head text-2xl font-bold">School Health Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">{visit.school} · {[visit.village, visit.district, visit.province].filter(Boolean).join(", ")}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[["Date", fmtDate(visit.date)], ["Donor", visit.donor || "—"], ["Status", visit.status], ["Conducted by", visit.conductedBy || "—"], ["Students (M/F)", `${mCount}/${fCount}`], ["Total", String(children.length)]].map(([k, val]) => (
              <div key={k}><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="font-semibold">{val}</dd></div>
            ))}
          </dl>
          <div className="mt-5 print:hidden">
            <AreaField label="Visit summary (free text)" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} testid="shv-report-summary" />
          </div>
          {summary && <div className="mt-5 hidden print:block"><p className="text-sm font-semibold">Summary</p><p className="whitespace-pre-line text-sm">{summary}</p></div>}
          <h2 className="mt-6 font-head text-lg font-semibold">Children screened</h2>
          <table className="mt-2 w-full text-xs">
            <thead><tr className="border-b border-border text-left"><th className="py-1">Name</th><th>Sex</th><th>Age</th><th>Wt/Ht/MUAC</th><th>Status</th><th>Referred</th></tr></thead>
            <tbody>{children.map((c) => (
              <tr key={c.id} className="border-b border-border/60"><td className="py-1">{c.firstName} {c.lastName}</td><td>{c.gender || "—"}</td><td>{c.age || "—"}</td><td>{c.weight || "—"}/{c.height || "—"}/{c.muac || "—"}</td><td className="capitalize">{childStatus(c)}</td><td>{c.referred === "Yes" ? `Yes — ${c.referNote || ""}` : "No"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" className="h-11" onClick={() => navigate("/school-health")} data-testid="shv-back"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <div className="min-w-0"><h1 className="font-head text-2xl font-bold tracking-tight">{visit.school}</h1><p className="text-sm text-muted-foreground">{[visit.village, visit.district, visit.province].filter(Boolean).join(", ")} · {fmtDate(visit.date)}</p></div>
        <div className="ml-auto flex gap-2">
          <SelectField label="" options={SCHOOL_STATUSES} value={visit.status} onChange={(s) => updateSchoolVisit(visit.id, { status: s })} testid="shv-status" />
          <Button className="h-11" onClick={() => { setSummary(visit.report?.summary || ""); setReportMode(true); }} data-testid="shv-create-report"><FileText className="mr-2 h-4 w-4" /> {visit.report ? "Edit report" : "Create report"}</Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-semibold">{children.length} children · {mCount}M / {fCount}F</span>
        <Button className="ml-auto h-10" disabled={!canEdit} data-testid="shv-add-child" onClick={() => setChild(emptyChild())}><Plus className="mr-1 h-4 w-4" /> Add child</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm" data-testid="shv-children-table">
          <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-3 font-semibold">Name</th><th className="p-3 font-semibold">Sex</th><th className="p-3 font-semibold">Age</th><th className="p-3 font-semibold">Wt/Ht/MUAC</th><th className="p-3 font-semibold">Status</th><th className="p-3 font-semibold">Referred</th><th className="p-3"></th></tr></thead>
          <tbody>
            {children.length === 0 && <tr><td colSpan={7} className="p-3 text-muted-foreground">No children added yet.</td></tr>}
            {children.map((c) => (
              <tr key={c.id} className="border-b border-border/60" data-testid={`shv-child-row-${c.id}`}>
                <td className="p-3 font-semibold">{c.firstName} {c.lastName}</td>
                <td className="p-3">{c.gender || "—"}</td>
                <td className="p-3">{c.age || "—"}</td>
                <td className="p-3">{c.weight || "—"}/{c.height || "—"}/{c.muac || "—"}</td>
                <td className="p-3"><span className="inline-flex items-center gap-1.5 font-semibold capitalize"><span className={`h-2.5 w-2.5 rounded-full ${dot[childStatus(c)]}`} />{childStatus(c)}</span></td>
                <td className="p-3">{c.referred === "Yes" ? "Yes" : "No"}</td>
                <td className="p-3 text-right">{canEdit && <><Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setChild(c)} data-testid={`shv-edit-child-${c.id}`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => removeSchoolChild(visit.id, c.id)} data-testid={`shv-remove-child-${c.id}`}><Trash2 className="h-4 w-4" /></Button></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!child} onOpenChange={(o) => !o && setChild(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl" data-testid="shv-child-dialog">
          <DialogHeader><DialogTitle className="font-head text-xl">{child?.id ? "Edit child" : "Add child"}</DialogTitle></DialogHeader>
          {child && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="First name" value={child.firstName} onChange={(e) => setC({ firstName: e.target.value })} testid="shv-c-first" />
                <TextField label="Last (father's) name" value={child.lastName} onChange={(e) => setC({ lastName: e.target.value })} testid="shv-c-last" />
                <SelectField label="Gender" options={["Male", "Female"]} value={child.gender} onChange={(v) => setC({ gender: v })} testid="shv-c-gender" />
                <TextField label="Age (years)" type="number" value={child.age} onChange={(e) => setC({ age: e.target.value })} testid="shv-c-age" />
                <TextField label="DOB" type="date" value={child.dob} onChange={(e) => setC({ dob: e.target.value })} testid="shv-c-dob" />
                <TextField label="Weight (kg)" type="number" value={child.weight} onChange={(e) => setC({ weight: e.target.value })} testid="shv-c-weight" />
                <TextField label="Height (cm)" type="number" value={child.height} onChange={(e) => setC({ height: e.target.value })} testid="shv-c-height" />
                <TextField label="MUAC (cm)" type="number" value={child.muac} onChange={(e) => setC({ muac: e.target.value })} testid="shv-c-muac" />
              </div>
              <div className="rounded-md border border-border p-2 text-sm">Vitals status: <span className="font-semibold capitalize"><span className={`mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle ${dot[childStatus(child)]}`} />{childStatus(child)}</span></div>

              <div>
                <p className="mb-2 font-head text-sm font-semibold text-primary">Physical examination</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PHYSICAL_EXAM_ITEMS.map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-md border border-border p-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{item}</span>
                      <div className="flex gap-1">
                        {["Normal", "Abnormal"].map((opt) => (
                          <button key={opt} type="button" data-testid={`shv-exam-${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${opt.toLowerCase()}`} onClick={() => setExam(item, { result: child.exam?.[item]?.result === opt ? "" : opt })} className={`h-8 rounded px-2 text-xs font-semibold ${child.exam?.[item]?.result === opt ? (opt === "Abnormal" ? "bg-red-500 text-white" : "bg-primary text-white") : "border border-border bg-white"}`}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 font-head text-sm font-semibold text-primary">Immunization</p>
                {SCHOOL_IMMUNIZATION.map((v) => (
                  <div key={v.k} className="mb-2 flex flex-wrap items-center gap-2"><span className="w-32 text-sm font-medium">{v.label}</span>{v.doses.map((dose) => { const on = (child.immun?.[v.k] || []).includes(dose); return <button key={dose} type="button" data-testid={`shv-immun-${v.k}-${dose}`} onClick={() => toggleImmun(v.k, dose)} className={`h-8 w-10 rounded border text-sm font-semibold ${on ? "border-green-600 bg-green-600 text-white" : "border-border bg-white"}`}>{dose}</button>; })}</div>
                ))}
              </div>

              <YesNo label="To be referred?" value={child.referred} onChange={(v) => setC({ referred: v })} testid="shv-referred" />
              {child.referred === "Yes" && <AreaField label="Referral reason" rows={2} value={child.referNote} onChange={(e) => setC({ referNote: e.target.value })} testid="shv-refer-note" />}
            </div>
          )}
          <DialogFooter className="gap-2"><Button variant="outline" className="h-11" onClick={() => setChild(null)}>Cancel</Button><Button className="h-11" data-testid="shv-save-child" onClick={saveChild}>Save child</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
