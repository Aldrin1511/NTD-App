import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TextField, SelectField, AreaField, ChoiceRow, MultiSelectField, AlertPanel, Field } from "@/components/Fields";
import { ConditionEntryShell, ChoiceChips, YesNo } from "@/components/EntryKit";
import { PhotoCapture, ageYmdFromDob, dobFromAgeYmd, dobFromAge } from "@/components/Capture";
import { GEO } from "@/mock/data";
import {
  SCHOOL_HEALTH_ID,
  SCHOOL_HEALTH_NAME,
  SCHOOL_FORM_TYPES,
  PHYSICAL_EXAM_ITEMS,
  SCHOOL_IMMUNIZATION,
  emptySchoolHealthData,
  newSchoolHealthEpisodeId,
  childStatus,
  formatChildAge,
  negativeExamItems,
  isSuspectedNtd,
} from "@/mock/schoolhealth";
import { useFormDirty } from "@/lib/useFormDirty";
import { toast } from "sonner";
import { CloudOff } from "lucide-react";

const dot = { red: "bg-red-500", amber: "bg-amber-500", green: "bg-green-500" };

const prefillFromPatient = (p) => {
  const dob = p?.dob || dobFromAge(p?.age, p?.createdAt) || "";
  const parts = dob ? ageYmdFromDob(dob) : { y: p?.age != null ? String(p.age) : "", m: "", d: "" };
  return {
    gender: p?.gender || p?.sex || "",
    dob,
    ageY: parts.y,
    ageM: parts.m,
    ageD: parts.d,
    weight: p?.weight != null ? String(p.weight) : "",
    height: p?.height != null ? String(p.height) : "",
    province: p?.province || "",
    district: p?.district || "",
    village: p?.village || "",
  };
};

export default function SchoolHealthEncounter() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { patients, encounters, saveEncounter, user, users, online, schools, donors } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.id === params.get("enc") && e.disease === SCHOOL_HEALTH_ID);
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  const [d, setD] = useState(() => {
    const base = { ...emptySchoolHealthData(), ...(existing?.data || {}) };
    if (!existing) Object.assign(base, prefillFromPatient(p));
    return base;
  });
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [conductedQ, setConductedQ] = useState("");
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "School health visit";
  const dirtyKey = `${existing?.id || "new"}-${params.get("enc") || params.get("new") || "draft"}`;
  const { dirty, markSaved } = useFormDirty(d, dirtyKey);

  const schoolNames = (schools || []).map((s) => s.name);
  const donorNames = (donors || []).map((x) => x.name);
  const userNames = (users || []).map((u) => u.name).filter(Boolean).sort();
  const conductedBy = d.report?.conductedBy || [];
  const conductedOptions = userNames.filter((n) => {
    if (conductedBy.includes(n)) return true;
    if (!conductedQ.trim()) return true;
    return n.toLowerCase().includes(conductedQ.trim().toLowerCase());
  });

  const onPickSchool = (name) => {
    const master = (schools || []).find((s) => s.name === name);
    if (master) {
      set({
        school: name,
        province: master.province || d.province,
        district: master.district || d.district,
        village: master.village || d.village,
      });
    } else set({ school: name });
  };

  if (!p) {
    return (
      <div className="p-8">
        Patient not found. <Button onClick={() => navigate("/patients")}>Back</Button>
      </div>
    );
  }

  const set = (patch) => setD((s) => ({ ...s, ...patch }));
  const setExam = (item, result) =>
    setD((s) => ({
      ...s,
      exam: { ...s.exam, [item]: { ...(s.exam?.[item] || {}), result: s.exam?.[item]?.result === result ? "" : result } },
    }));
  const setImmun = (k, val) => setD((s) => ({ ...s, immun: { ...s.immun, [k]: val } }));
  const setReport = (patch) => setD((s) => ({ ...s, report: { ...(s.report || {}), ...patch } }));

  const setAgePart = (part, value) => {
    setD((s) => {
      const next = { ...s, [part]: value };
      next.dob = dobFromAgeYmd({ y: next.ageY, m: next.ageM, d: next.ageD });
      return next;
    });
  };

  const setDob = (dob) => {
    const parts = ageYmdFromDob(dob);
    setD((s) => ({ ...s, dob, ageY: parts.y, ageM: parts.m, ageD: parts.d }));
  };

  const deriveStatus = (data, completeReport) => {
    if (completeReport || data.report?.completed) return "Completed";
    const started =
      data.school ||
      Object.values(data.exam || {}).some((x) => x?.result) ||
      Object.values(data.immun || {}).some(Boolean) ||
      data.weight ||
      data.height ||
      data.muac;
    if (started || existing) return "In Progress";
    return data.status || "New";
  };

  const persist = (close, { completeReport = false } = {}) => {
    const status = deriveStatus(d, completeReport);
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    const report = {
      ...(d.report || {}),
      completed: completeReport || d.report?.completed || false,
      totals: {
        mr: d.immun?.mr === "Yes" ? 1 : 0,
        vita: d.immun?.vita === "Yes" ? 1 : 0,
        tt: d.immun?.tt === "Yes" ? 1 : 0,
        deworm: d.immun?.deworm === "Yes" ? 1 : 0,
        ntd: isSuspectedNtd(d) ? 1 : 0,
      },
    };
    const payload = {
      ...d,
      status,
      report,
      offlineEntered: offline || d.offlineEntered || false,
      offlineAt: offline ? new Date().toISOString() : d.offlineAt,
    };
    const episodeId =
      existing?.episodeId ||
      patientEncs.filter((e) => e.disease === SCHOOL_HEALTH_ID)[0]?.episodeId ||
      newSchoolHealthEpisodeId();
    saveEncounter({
      id: existing?.id,
      patientId: p.id,
      episodeId,
      disease: SCHOOL_HEALTH_ID,
      facility,
      worker: user?.name,
      type: visitType,
      diagnosis: [d.formType, d.school].filter(Boolean).join(" · ") || SCHOOL_HEALTH_NAME,
      outcome: status === "Completed" ? "Completed" : status,
      data: payload,
    });
    setD(payload);
    markSaved(payload);
    setSavedAt(new Date().toLocaleTimeString());
    if (close) navigate(`/patients/${p.id}?tab=${SCHOOL_HEALTH_ID}`);
    toast.success(online ? (close ? "School Health visit saved" : "Saved to device") : "Saved · queued until online");
  };

  const requestLeave = () => {
    if (dirty) setCancelOpen(true);
    else navigate(`/patients/${p.id}?tab=${SCHOOL_HEALTH_ID}`);
  };

  const examDone = Object.values(d.exam || {}).some((x) => x?.result);
  const immunDone = Object.values(d.immun || {}).some(Boolean);
  const caseDone = !!(d.school && d.formType);
  const reportDone = !!(d.report?.completed || (d.report?.summary && (d.report?.conductedBy || []).length));

  const sections = [
    {
      title: "Visit details",
      done: caseDone,
      body: (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Province" options={Object.keys(GEO)} value={d.province || ""} onChange={(x) => set({ province: x, district: "", village: "" })} testid="sh-enc-province" />
            <SelectField label="District" options={Object.keys(GEO[d.province] || {})} value={d.district || ""} onChange={(x) => set({ district: x, village: "" })} testid="sh-enc-district" />
            <SelectField label="Village" options={(GEO[d.province]?.[d.district]) || []} value={d.village || ""} onChange={(x) => set({ village: x })} testid="sh-enc-village" />
            <SelectField label="School" options={schoolNames} value={d.school || ""} onChange={onPickSchool} testid="sh-enc-school" hint="Admin → Masters → Schools" />
            <SelectField label="Donor" options={donorNames} value={d.donor || ""} onChange={(x) => set({ donor: x })} testid="sh-enc-donor" hint="Admin → Masters → Donors" />
          </div>
          <ChoiceChips label="Form type" options={SCHOOL_FORM_TYPES} value={d.formType || ""} onChange={(ft) => set({ formType: ft })} testid="sh-enc-form-type" />
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p><span className="text-muted-foreground">Created by:</span> <strong>{user?.name || "—"}</strong></p>
            <p className="mt-1"><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="ml-1 rounded" data-testid="sh-enc-status">{deriveStatus(d)}</Badge></p>
          </div>
        </div>
      ),
    },
    {
      title: "Child details",
      done: !!(d.gender && (d.ageY || d.dob)),
      body: (
        <div className="space-y-4">
          <div>
            <p className="font-semibold">{p.name}{p.lastName ? ` ${p.lastName}` : ""}</p>
            <p className="text-sm text-muted-foreground">{formatChildAge(d)} · {d.gender || "—"}</p>
          </div>
          <ChoiceRow label="Gender" options={["Male", "Female", "Other"]} value={d.gender} onChange={(g) => set({ gender: g })} testid="sh-enc-gender" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[minmax(0,11.5rem)_1fr]">
              <TextField label="Date of birth" type="date" value={d.dob || ""} allowEmpty onChange={(e) => setDob(e.target.value)} testid="sh-enc-dob" />
              <Field label="Age">
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="Years"
                    aria-label="Years"
                    className="h-12 w-full min-w-0 bg-white text-base"
                    value={d.ageY || ""}
                    onChange={(e) => setAgePart("ageY", e.target.value)}
                    data-testid="sh-enc-age-y"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={11}
                    placeholder="Months"
                    aria-label="Months"
                    className="h-12 w-full min-w-0 bg-white text-base"
                    value={d.ageM || ""}
                    onChange={(e) => setAgePart("ageM", e.target.value)}
                    data-testid="sh-enc-age-m"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={31}
                    placeholder="Days"
                    aria-label="Days"
                    className="h-12 w-full min-w-0 bg-white text-base"
                    value={d.ageD || ""}
                    onChange={(e) => setAgePart("ageD", e.target.value)}
                    data-testid="sh-enc-age-d"
                  />
                </div>
              </Field>
            </div>
            <TextField label="Weight (kg)" type="number" value={d.weight || ""} onChange={(e) => set({ weight: e.target.value })} testid="sh-enc-weight" />
            <TextField label="Height (cm)" type="number" value={d.height || ""} onChange={(e) => set({ height: e.target.value })} testid="sh-enc-height" />
            <TextField label="MUAC (cm)" type="number" value={d.muac || ""} onChange={(e) => set({ muac: e.target.value })} testid="sh-enc-muac" />
          </div>
          <div className="rounded-md border border-border p-2 text-sm">
            Vitals status:{" "}
            <span className="font-semibold capitalize">
              <span className={`mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle ${dot[childStatus(d)]}`} />
              {childStatus(d)}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: "Physical examination",
      done: examDone,
      body: (
        <div className="grid gap-2 sm:grid-cols-2" data-testid="sh-enc-exam">
          {PHYSICAL_EXAM_ITEMS.map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-md border border-border p-2">
              <span className="min-w-0 flex-1 truncate text-sm">{item}</span>
              <div className="flex gap-1">
                {["Normal", "Abnormal"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    data-testid={`sh-enc-exam-${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${opt.toLowerCase()}`}
                    onClick={() => setExam(item, opt)}
                    className={`h-8 rounded px-2 text-xs font-semibold ${
                      d.exam?.[item]?.result === opt
                        ? opt === "Abnormal"
                          ? "bg-red-500 text-white"
                          : "bg-primary text-white"
                        : "border border-border bg-white"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {examDone && (
            <div className="sm:col-span-2">
              <AlertPanel level="info" title="Negative findings" testid="sh-enc-neg-exam">
                {negativeExamItems(d).join(", ") || "None marked Normal yet"}
              </AlertPanel>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Immunization",
      done: immunDone,
      body: (
        <div className="space-y-3" data-testid="sh-enc-immun">
          {SCHOOL_IMMUNIZATION.map((v) => (
            <ChoiceChips key={v.k} label={v.label} options={["Yes", "No"]} value={d.immun?.[v.k] || ""} onChange={(val) => setImmun(v.k, val)} testid={`sh-enc-immun-${v.k}`} />
          ))}
        </div>
      ),
    },
    {
      title: "Referral",
      done: !!d.referred,
      body: (
        <div className="space-y-3">
          <YesNo label="To be referred?" value={d.referred} onChange={(v) => set({ referred: v })} testid="sh-enc-referred" />
          {d.referred === "Yes" && (
            <AreaField label="Referral reason" rows={2} value={d.referNote || ""} onChange={(e) => set({ referNote: e.target.value })} testid="sh-enc-refer-note" />
          )}
        </div>
      ),
    },
    {
      title: "Report",
      done: reportDone,
      body: (
        <div className="space-y-4" data-testid="sh-enc-report">
          <Input className="h-11" placeholder="Search users for Conducted by…" value={conductedQ} onChange={(e) => setConductedQ(e.target.value)} data-testid="sh-enc-conducted-search" />
          <MultiSelectField label="Conducted by" options={conductedOptions} value={conductedBy} onChange={(list) => setReport({ conductedBy: list })} placeholder="Add clinician…" testid="sh-enc-conducted-by" />
          <PhotoCapture label="Visit photos" photos={d.report?.photos || []} onChange={(ph) => setReport({ photos: ph })} testid="sh-enc-photos" max={6} />
          <AreaField label="Visit summary" rows={3} value={d.report?.summary || ""} onChange={(e) => setReport({ summary: e.target.value })} testid="sh-enc-summary" />
          <dl className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 text-sm sm:grid-cols-3" data-testid="sh-enc-totals">
            <div><dt className="text-[11px] text-muted-foreground">Measles Rubella</dt><dd className="font-semibold text-lg">{d.immun?.mr === "Yes" ? 1 : 0}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Vitamin A</dt><dd className="font-semibold text-lg">{d.immun?.vita === "Yes" ? 1 : 0}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">TT</dt><dd className="font-semibold text-lg">{d.immun?.tt === "Yes" ? 1 : 0}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Deworming</dt><dd className="font-semibold text-lg">{d.immun?.deworm === "Yes" ? 1 : 0}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Suspected NTD</dt><dd className="font-semibold text-lg">{isSuspectedNtd(d) ? 1 : 0}</dd></div>
          </dl>
          <Button className="h-11" data-testid="sh-enc-complete-report" onClick={() => persist(false, { completeReport: true })}>
            Save report &amp; mark Completed
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ConditionEntryShell
        patient={p}
        patientEncs={patientEncs}
        sidebarDiseases={[{ id: SCHOOL_HEALTH_ID, name: SCHOOL_HEALTH_NAME }]}
        title={SCHOOL_HEALTH_NAME}
        context={`${facility || "—"} · ${visitType} · Created by ${user?.name || "—"}`}
        sections={sections}
        savedAt={savedAt}
        onSave={(close) => persist(close)}
        backTo={requestLeave}
        preface={
          !online ? (
            <AlertPanel level="urgent" title="Offline" testid="sh-enc-offline">
              <span className="inline-flex items-center gap-2"><CloudOff className="h-4 w-4" /> Entries stay on this device. When internet returns, confirm the sync popup.</span>
            </AlertPanel>
          ) : null
        }
      />
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md" data-testid="sh-enc-discard-dialog">
          <DialogHeader>
            <DialogTitle>Save changes?</DialogTitle>
            <DialogDescription>You have entered information that is not saved yet. Save the visit, or clear and discard it?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-11" data-testid="sh-enc-discard-clear" onClick={() => { setCancelOpen(false); navigate(`/patients/${p.id}?tab=${SCHOOL_HEALTH_ID}`); }}>Clear</Button>
            <Button className="h-11" data-testid="sh-enc-discard-save" onClick={() => { setCancelOpen(false); persist(true); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
