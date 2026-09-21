import { useLayoutEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TextField, SelectField, Field, AreaField, SectionCard, AlertPanel, MultiSelectField } from "@/components/Fields";
import { PhotoCapture } from "@/components/Capture";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GEO, DISEASES, DRUG_FREQUENCIES, DRUG_DURATION_UNITS } from "@/mock/data";
import { DISEASE_SPECS, SPEC_LIST } from "@/mock/specs";
import { COMPARE_OPS, formatRegimenAge, formatRegimenWeight, isRegimenActive } from "@/lib/medications";
import { CONDITION_LABELS } from "@/mock/masters";
import { scrollViewToTop } from "@/lib/scroll";
import { toast } from "sonner";
import { UserPlus, Trash2, Plus, KeyRound, Building2, Users, Library } from "lucide-react";

const SCOPES = {
  own: "Own records only",
  province: "All records in Province",
  all: "All records across the programme",
};

const TABS = [
  { id: "users", label: "Users", icon: Users },
  { id: "facilities", label: "Facilities", icon: Building2 },
  { id: "masters", label: "Masters", icon: Library },
];

const MASTER_TABS = [
  { id: "drugs", label: "Drugs" },
  { id: "regiment", label: "Regiment" },
  { id: "immunization", label: "Immunization schedule" },
  { id: "labmaster", label: "Lab master" },
  { id: "features", label: "Feature config" },
  { id: "symptoms", label: "Symptoms" },
  { id: "visits", label: "Visit type" },
  { id: "rules", label: "Programme rules" },
];

export default function Admin() {
  const s = useStore();
  const [tab, setTab] = useState("users");
  const [master, setMaster] = useState("drugs");

  useLayoutEffect(() => {
    scrollViewToTop();
  }, [tab, master]);

  if (s.user?.role !== "Admin")
    return (
      <AppShell title="Admin">
        <AlertPanel level="review" title="Restricted" testid="admin-restricted">
          Only an Admin can manage users, facilities and master data. Sign in as admin@trias.health to review this module.
        </AlertPanel>
      </AppShell>
    );

  return (
    <AppShell title="Admin" subtitle="Users, facilities and master data for the programme">
      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-border pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            data-testid={`admin-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex h-12 shrink-0 items-center gap-2 rounded-t-md border-b-2 px-5 text-sm font-semibold transition-colors ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:bg-muted"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab s={s} />}
      {tab === "facilities" && <FacilitiesTab s={s} />}
      {tab === "masters" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {MASTER_TABS.map((m) => (
              <button
                key={m.id}
                data-testid={`master-tab-${m.id}`}
                onClick={() => setMaster(m.id)}
                className={`h-11 rounded-md border px-4 text-sm font-semibold ${
                  master === m.id ? "border-primary bg-primary text-white" : "border-border bg-white text-muted-foreground hover:bg-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {master === "drugs" && <DrugsMaster s={s} />}
          {master === "regiment" && <RegimentMaster s={s} />}
          {master === "immunization" && <ImmunizationMaster s={s} />}
          {master === "labmaster" && <LabMaster s={s} />}
          {master === "features" && <FeatureConfigMaster s={s} />}
          {master === "symptoms" && <SymptomsMaster s={s} />}
          {master === "visits" && <VisitTypeMaster s={s} />}
          {master === "rules" && <RulesMaster s={s} />}
        </div>
      )}
    </AppShell>
  );
}

const UsersTab = ({ s }) => {
  const [open, setOpen] = useState(false);
  const [resetPopup, setResetPopup] = useState(null);
  const [nf, setNf] = useState({ name: "", email: "", password: "", role: "Health Worker", province: "", scope: "own", canEdit: true, photo: "" });

  const create = () => {
    if (!nf.name || !nf.email || !nf.password) return toast.error("Name, email and password are required");
    s.addUser(nf);
    setOpen(false);
    setNf({ name: "", email: "", password: "", role: "Health Worker", province: "", scope: "own", canEdit: true, photo: "" });
    toast.success("User created with the selected access level");
  };

  return (
    <>
      <SectionCard
        title="Users &amp; access control"
        desc="Users are not tied to a facility — the facility is chosen when an encounter is created"
        right={
          <Button className="h-12" data-testid="add-user-btn" onClick={() => setOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Register new user
          </Button>
        }
      >
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[760px] text-sm" data-testid="user-table">
            <thead className="bg-muted">
              <tr>
                {["User", "Role", "Province", "Data access", "Edit", "Active", "Password"].map((h) => (
                  <th key={h} className="p-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.users.map((u) => (
                <tr key={u.id} className="border-t border-border" data-testid={`user-row-${u.id}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {u.photo ? (
                        <img src={u.photo} alt={u.name} className="h-10 w-10 rounded-md border border-border object-cover" data-testid={`user-photo-${u.id}`} />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-xs font-bold text-primary" data-testid={`user-photo-${u.id}`}>
                          {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </span>
                      )}
                      <div>
                        <p className="font-semibold">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">{u.province || "—"}</td>
                  <td className="p-3">
                    <select
                      data-testid={`scope-select-${u.id}`}
                      value={u.scope}
                      onChange={(e) => {
                        s.updateUser(u.id, { scope: e.target.value });
                        toast.success(`${u.name}: ${SCOPES[e.target.value]}`);
                      }}
                      className="h-11 w-full rounded-md border border-input bg-white px-2 text-sm"
                    >
                      {Object.entries(SCOPES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <Switch data-testid={`edit-toggle-${u.id}`} checked={u.canEdit} onCheckedChange={(v) => s.updateUser(u.id, { canEdit: v })} />
                  </td>
                  <td className="p-3">
                    <Switch
                      data-testid={`active-toggle-${u.id}`}
                      checked={u.active}
                      onCheckedChange={(v) => {
                        s.updateUser(u.id, { active: v });
                        toast.success(`${u.name} ${v ? "activated" : "deactivated"}`);
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <Button
                      variant="outline"
                      className="h-11"
                      data-testid={`reset-password-${u.id}`}
                      onClick={() => {
                        const temp = `Temp@${Math.floor(1000 + Math.random() * 9000)}`;
                        s.resetPassword(u.id, temp);
                        setResetPopup({ name: u.name, password: temp });
                      }}
                    >
                      <KeyRound className="mr-2 h-3.5 w-3.5" /> Reset
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AlertPanel level="info" title="How access control applies" testid="access-note">
          Patients, encounters and every MIS indicator are filtered by the signed-in user’s access scope — own records,
          all records in their Province, or the whole programme. Deactivated users cannot sign in.
        </AlertPanel>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg" data-testid="create-user-dialog">
          <DialogHeader>
            <DialogTitle className="font-head text-xl">Register new user</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <PhotoCapture label="User photo" photos={nf.photo ? [nf.photo] : []} onChange={(ph) => setNf({ ...nf, photo: ph[0] || "" })} testid="new-user-photo" max={1} />
            <TextField label="Full name" testid="new-user-name" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
            <TextField label="Email" testid="new-user-email" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} />
            <TextField label="Temporary password" testid="new-user-password" value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} />
            <SelectField label="Role" options={["Admin", "Supervisor", "Health Worker"]} value={nf.role} onChange={(v) => setNf({ ...nf, role: v })} testid="new-user-role" />
            <SelectField label="Province" options={Object.keys(GEO)} value={nf.province} onChange={(v) => setNf({ ...nf, province: v })} testid="new-user-province" />
            <SelectField
              label="Data access"
              options={Object.values(SCOPES)}
              value={SCOPES[nf.scope]}
              onChange={(v) => setNf({ ...nf, scope: Object.keys(SCOPES).find((k) => SCOPES[k] === v) })}
              testid="new-user-scope"
            />
            <div className="flex items-center justify-between rounded-md border border-border p-4">
              <span className="text-sm font-semibold">Allow editing records</span>
              <Switch data-testid="new-user-edit-toggle" checked={nf.canEdit} onCheckedChange={(v) => setNf({ ...nf, canEdit: v })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12" onClick={() => setOpen(false)} data-testid="create-user-cancel">Cancel</Button>
            <Button className="h-12" onClick={create} data-testid="create-user-submit">Create user</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetPopup} onOpenChange={(next) => { if (!next) setResetPopup(null); }}>
        <DialogContent
          className="sm:max-w-md"
          data-testid="reset-password-dialog"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="font-head text-xl">Temporary password</DialogTitle>
            <DialogDescription>
              Share this password with {resetPopup?.name}. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted px-4 py-3" data-testid="reset-password-value">
            <p className="break-all font-mono text-lg font-semibold tracking-wide">{resetPopup?.password}</p>
          </div>
          <DialogFooter>
            <Button className="h-12" data-testid="reset-password-close" onClick={() => setResetPopup(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const FacilitiesTab = ({ s }) => {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", country: "Papua New Guinea", province: "", district: "", village: "" });
  const districts = f.province ? Object.keys(GEO[f.province] || {}) : [];
  const villages = f.province && f.district ? GEO[f.province]?.[f.district] || [] : [];

  const create = () => {
    if (!f.name || !f.province) return toast.error("Facility name and province are required");
    s.addFacility(f);
    setOpen(false);
    setF({ name: "", country: "Papua New Guinea", province: "", district: "", village: "" });
    toast.success("Facility created");
  };

  return (
    <>
      <SectionCard
        title="Facilities"
        desc="Facilities are selected when an encounter is created, so mobile workers can serve many sites"
        right={
          <Button className="h-12" data-testid="add-facility-btn" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create facility
          </Button>
        }
      >
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[700px] text-sm" data-testid="facility-table">
            <thead className="bg-muted">
              <tr>
                {["Facility", "Country", "Province", "District", "Village", ""].map((h) => (
                  <th key={h} className="p-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.facilities.map((x) => (
                <tr key={x.id} className="border-t border-border" data-testid={`facility-row-${x.id}`}>
                  <td className="p-3">
                    <p className="font-semibold">{x.name}</p>
                    <p className="text-xs text-muted-foreground">{x.id}</p>
                  </td>
                  <td className="p-3">{x.country}</td>
                  <td className="p-3">{x.province}</td>
                  <td className="p-3">{x.district}</td>
                  <td className="p-3">{x.village}</td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-red-600"
                      data-testid={`remove-facility-${x.id}`}
                      onClick={() => {
                        s.removeFacility(x.id);
                        toast.success("Facility removed");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg" data-testid="create-facility-dialog">
          <DialogHeader>
            <DialogTitle className="font-head text-xl">Create facility</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <TextField label="Facility name" testid="facility-name-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <TextField label="Country" testid="facility-country-input" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
            <SelectField label="Province" options={Object.keys(GEO)} value={f.province} onChange={(v) => setF({ ...f, province: v, district: "", village: "" })} testid="facility-province-select" />
            <SelectField label="District" options={districts} value={f.district} onChange={(v) => setF({ ...f, district: v, village: "" })} testid="facility-district-select" />
            <SelectField label="Village" options={villages} value={f.village} onChange={(v) => setF({ ...f, village: v })} testid="facility-village-select" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12" onClick={() => setOpen(false)} data-testid="create-facility-cancel">Cancel</Button>
            <Button className="h-12" onClick={create} data-testid="create-facility-submit">Create facility</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const DrugsMaster = ({ s }) => {
  const [d, setD] = useState({ name: "", form: "Oral", strength: "" });
  return (
    <SectionCard title="Drugs" desc="Drug catalogue used by the treatment section — configurable per country protocol" right={<Badge variant="outline" className="rounded" data-testid="drug-count">{s.settings.drugs.length} drugs</Badge>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField label="Drug name" testid="new-drug-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <SelectField label="Form" options={["Oral", "Topical", "Injection"]} value={d.form} onChange={(v) => setD({ ...d, form: v })} testid="new-drug-form" />
        <TextField label="Strength" testid="new-drug-strength" value={d.strength} onChange={(e) => setD({ ...d, strength: e.target.value })} />
      </div>
      <Button
        className="h-12"
        data-testid="add-drug-btn"
        onClick={() => {
          if (!d.name.trim()) return toast.error("Drug name is required");
          s.addDrug({ name: d.name.trim(), form: d.form, strength: d.strength });
          setD({ name: "", form: "Oral", strength: "" });
          toast.success("Drug added to the catalogue");
        }}
      >
        <Plus className="mr-2 h-4 w-4" /> Add drug
      </Button>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[560px] text-sm" data-testid="drug-table">
          <thead className="bg-muted">
            <tr>{["Drug", "Form", "Strength", ""].map((h) => (<th key={h} className="p-3 text-left font-semibold">{h}</th>))}</tr>
          </thead>
          <tbody>
            {s.settings.drugs.map((x) => (
              <tr key={x.name} className="border-t border-border">
                <td className="p-3 font-semibold">{x.name}</td>
                <td className="p-3">{x.form}</td>
                <td className="p-3">{x.strength}</td>
                <td className="p-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-red-600"
                    data-testid={`remove-drug-${x.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    onClick={() => {
                      s.removeDrug(x.name);
                      toast.success("Drug removed");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

const EMPTY_REGIMEN = { name: "", disease: "scabies", diagnosis: "", ageOp: "", ageValue: "", weightOp: "", weightValue: "", frequency: "", duration: "", durationUnit: "", clinicianNotes: "", patientAdvice: "", drugs: [] };

const CompareField = ({ label, op, value, onOp, onValue, unit, testid, className = "" }) => (
  <Field label={label} className={className}>
    <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)] gap-2">
      <Select value={op || "any"} onValueChange={(v) => onOp(v === "any" ? "" : v)}>
        <SelectTrigger className="h-12 w-full min-w-0 bg-white text-base" data-testid={`${testid}-op`}>
          <SelectValue placeholder="Any" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any" className="text-base" data-testid={`${testid}-op-any`}>Any</SelectItem>
          {COMPARE_OPS.map((o) => (
            <SelectItem key={o.id} value={o.id} className="text-base" data-testid={`${testid}-op-${o.id}`}>
              {o.symbol} {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-12 w-full min-w-0 bg-white text-base"
        type="number"
        min="0"
        placeholder={unit}
        data-testid={`${testid}-value`}
        value={value}
        onChange={(e) => onValue(e.target.value)}
      />
    </div>
  </Field>
);

const formatRegimenDuration = (x) => {
  if (!x?.durationUnit && (x?.duration === "" || x?.duration == null)) return "—";
  if (["As needed", "Ongoing", "BOLUS"].includes(x.durationUnit) && (x.duration === "" || x.duration == null)) return x.durationUnit;
  return [x.duration, x.durationUnit].filter((v) => v !== "" && v != null).join(" ") || "—";
};

const RegimentMaster = ({ s }) => {
  const [r, setR] = useState({ ...EMPTY_REGIMEN });
  const regimens = s.settings.regimens || [];
  const spec = DISEASE_SPECS[r.disease];
  const diseaseDrugs = (s.settings.drugs || [])
    .filter((d) => !(d.diseases || []).length || (d.diseases || []).includes(r.disease))
    .map((d) => d.name);
  return (
    <SectionCard title="Regiment" desc="Build treatment regimens from the drug list; matching diagnosis, age and weight auto-populate Medications"
      right={<Badge variant="outline" className="rounded" data-testid="regimen-count">{regimens.length} regimens</Badge>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Regimen name" testid="new-regimen-name" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
        <SelectField label="Condition" options={SPEC_LIST.map((x) => x.name)} value={spec?.name} onChange={(v) => setR({ ...r, disease: SPEC_LIST.find((x) => x.name === v).id, diagnosis: "", drugs: [] })} testid="new-regimen-disease" />
        <SelectField label="Diagnosis criteria" options={["Any", ...(spec?.diagnosis || [])]} value={r.diagnosis || "Any"} onChange={(v) => setR({ ...r, diagnosis: v === "Any" ? "" : v })} testid="new-regimen-diagnosis" />
        <CompareField label="Age (y)" op={r.ageOp} value={r.ageValue} onOp={(v) => setR({ ...r, ageOp: v })} onValue={(v) => setR({ ...r, ageValue: v })} unit="y" testid="new-regimen-age" className="lg:col-span-2" />
        <CompareField label="Weight (kg)" op={r.weightOp} value={r.weightValue} onOp={(v) => setR({ ...r, weightOp: v })} onValue={(v) => setR({ ...r, weightValue: v })} unit="kg" testid="new-regimen-weight" className="lg:col-span-2" />
        <SelectField label="Frequency" options={DRUG_FREQUENCIES} value={r.frequency} onChange={(v) => setR({ ...r, frequency: v })} testid="new-regimen-frequency" />
        <Field label="Duration" className="lg:col-span-2">
          <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-2">
            <Input
              className="h-12 w-full min-w-0 bg-white text-base"
              type="number"
              min="0"
              placeholder={`Enter ${r.durationUnit || "Day(s)"}`}
              data-testid="new-regimen-duration"
              value={r.duration}
              onChange={(e) => setR({ ...r, duration: e.target.value })}
            />
            <Select value={r.durationUnit || undefined} onValueChange={(v) => setR({ ...r, durationUnit: v })}>
              <SelectTrigger className="h-12 w-full min-w-0 bg-white text-base" data-testid="new-regimen-duration-unit">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {DRUG_DURATION_UNITS.map((o) => (
                  <SelectItem key={o} value={o} className="text-base" data-testid={`new-regimen-duration-unit-opt-${o}`}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Field>
      </div>
      <MultiSelectField
        label="Drugs"
        options={diseaseDrugs}
        value={r.drugs}
        onChange={(v) => setR({ ...r, drugs: v })}
        placeholder="Select drugs…"
        testid="new-regimen-drug"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <AreaField label="Clinician Notes" testid="new-regimen-clinician-notes" rows={4} value={r.clinicianNotes} onChange={(e) => setR({ ...r, clinicianNotes: e.target.value })} placeholder="Notes for the treating clinician" />
        <AreaField label="Patient Advice" testid="new-regimen-patient-advice" rows={4} value={r.patientAdvice} onChange={(e) => setR({ ...r, patientAdvice: e.target.value })} placeholder="Advice to give the patient or caregiver" />
      </div>
      <Button className="h-12" data-testid="add-regimen-btn" onClick={() => {
        if (!r.name.trim() || !r.drugs.length) return toast.error("Regimen name and at least one drug are required");
        if (r.ageOp && (r.ageValue === "" || r.ageValue == null)) return toast.error("Enter an age for the selected comparison");
        if (r.weightOp && (r.weightValue === "" || r.weightValue == null)) return toast.error("Enter a weight for the selected comparison");
        s.addRegimen(r); setR({ ...EMPTY_REGIMEN });
        toast.success("Regimen added");
      }}>
        <Plus className="mr-2 h-4 w-4" /> Add regimen
      </Button>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[1200px] text-sm" data-testid="regimen-table">
          <thead className="bg-muted"><tr>{["Regimen", "Condition", "Diagnosis", "Age", "Weight", "Frequency", "Duration", "Drugs", "Clinician Notes", "Patient Advice", "Status"].map((h) => (<th key={h} className="p-3 text-left font-semibold">{h}</th>))}</tr></thead>
          <tbody>
            {regimens.map((x) => (
              <tr key={x.id} className={`border-t border-border ${isRegimenActive(x) ? "" : "bg-muted/40 text-muted-foreground"}`} data-testid={`regimen-row-${x.id}`}>
                <td className="p-3"><p className="font-semibold text-foreground">{x.name}</p><p className="text-xs text-muted-foreground">{x.id}</p></td>
                <td className="p-3">{DISEASE_SPECS[x.disease]?.name}</td>
                <td className="p-3">{x.diagnosis || "Any"}</td>
                <td className="p-3">{formatRegimenAge(x)}</td>
                <td className="p-3">{formatRegimenWeight(x)}</td>
                <td className="p-3">{x.frequency || "—"}</td>
                <td className="p-3">{formatRegimenDuration(x)}</td>
                <td className="p-3">{Array.isArray(x.drugs) ? x.drugs.join(", ") : x.drugs}</td>
                <td className="max-w-[220px] p-3"><p className="line-clamp-3 whitespace-pre-wrap">{x.clinicianNotes || "—"}</p></td>
                <td className="max-w-[220px] p-3"><p className="line-clamp-3 whitespace-pre-wrap">{x.patientAdvice || "—"}</p></td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      data-testid={`regimen-status-${x.id}`}
                      checked={isRegimenActive(x)}
                      onCheckedChange={(v) => {
                        s.setRegimenStatus(x.id, v ? "Active" : "Inactive");
                        toast.success(`${x.name} marked ${v ? "Active" : "Inactive"}`);
                      }}
                    />
                    <span className="text-xs font-semibold">{isRegimenActive(x) ? "Active" : "Inactive"}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

const SymptomsMaster = ({ s }) => {
  const [v, setV] = useState("");
  return (
    <SectionCard title="Symptoms" desc="Presenting complaints used by Suspect screening — written in the patient's own words" right={<Badge variant="outline" className="rounded" data-testid="symptom-count">{s.settings.symptoms.length} complaints</Badge>}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input className="h-12 w-full min-w-0 bg-white text-base" placeholder="Add a new complaint, e.g. My skin is burning" data-testid="new-symptom-input" value={v} onChange={(e) => setV(e.target.value)} />
        <Button
          className="h-12 sm:px-8"
          data-testid="add-symptom-btn"
          onClick={() => {
            if (!v.trim()) return toast.error("Type the complaint first");
            s.addSymptom(v.trim());
            setV("");
            toast.success("Complaint added to the library");
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="symptom-library">
        {s.settings.symptoms.map((x) => (
          <li key={x} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <span className="flex-1">{x}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-red-600"
              data-testid={`remove-symptom-${x.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              onClick={() => {
                s.removeSymptom(x);
                toast.success("Complaint removed");
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
};

const VisitTypeMaster = ({ s }) => {
  const [v, setV] = useState("");
  return (
    <SectionCard title="Visit type" desc="Chosen together with the facility whenever a new encounter is created" right={<Badge variant="outline" className="rounded" data-testid="visit-type-count">{s.settings.visitTypes.length} types</Badge>}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input className="h-12 w-full min-w-0 bg-white text-base" placeholder="Add a visit type, e.g. School screening" data-testid="new-visit-type-input" value={v} onChange={(e) => setV(e.target.value)} />
        <Button
          className="h-12 sm:px-8"
          data-testid="add-visit-type-btn"
          onClick={() => {
            if (!v.trim()) return toast.error("Type the visit type first");
            s.addVisitType(v.trim());
            setV("");
            toast.success("Visit type added");
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="visit-type-list">
        {s.settings.visitTypes.map((x) => (
          <li key={x} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <span className="flex-1">{x}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-red-600"
              data-testid={`remove-visit-type-${x.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              onClick={() => {
                s.removeVisitType(x);
                toast.success("Visit type removed");
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
};

const RulesMaster = ({ s }) => {
  const [local, setLocal] = useState(() => ({ ...s.settings.ltfuByDisease }));
  return (
    <SectionCard title="Programme rules — lost to follow-up" desc="Days after the drug end date with no new encounter, set separately for each disease">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DISEASES.map((d) => (
          <TextField
            key={d.id}
            label={`${d.name} (days)`}
            type="number"
            testid={`ltfu-input-${d.id}`}
            value={String(local[d.id] ?? "")}
            onChange={(e) => setLocal({ ...local, [d.id]: e.target.value })}
          />
        ))}
      </div>
      <Button
        className="h-12"
        data-testid="save-ltfu-btn"
        onClick={() => {
          DISEASES.forEach((d) => s.setLtfu(d.id, local[d.id]));
          toast.success("Lost to follow-up rules saved for all diseases");
        }}
      >
        Save rules
      </Button>
      <AlertPanel level="info" title="Where this applies" testid="ltfu-note">
        A patient with no new encounter this many days after their treatment end date is tagged “Lost to follow-up” in the
        patient list and MIS, using the threshold of their most recent disease record.
      </AlertPanel>
    </SectionCard>
  );
};


/* ---------------- Immunization schedule master ---------------- */
const ImmunizationMaster = ({ s }) => {
  const schedules = s.settings.immunizationSchedules || [];
  const vaccineList = (s.settings.drugs || []).filter((d) => d.type === "Vaccine" || d.form === "Vaccine");
  const [sel, setSel] = useState(schedules[0]?.id || "");
  const current = schedules.find((x) => x.id === sel) || schedules[0];
  const [nf, setNf] = useState({ name: "", condition: "wellbaby" });
  const [vacName, setVacName] = useState("");

  const addSchedule = () => {
    if (!nf.name) return toast.error("Schedule name required");
    s.addImmunizationSchedule({ name: nf.name, condition: nf.condition, vaccines: [] });
    setNf({ name: "", condition: "wellbaby" });
    toast.success("Schedule added");
  };
  const addVaccine = () => {
    if (!current || !vacName) return;
    const id = vacName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.floor(Math.random() * 1000);
    s.updateImmunizationSchedule(current.id, { vaccines: [...(current.vaccines || []), { id, name: vacName, offsetDays: 0, note: "" }] });
    setVacName("");
  };
  const updVac = (vid, patch) => s.updateImmunizationSchedule(current.id, { vaccines: current.vaccines.map((v) => (v.id === vid ? { ...v, ...patch } : v)) });
  const rmVac = (vid) => s.updateImmunizationSchedule(current.id, { vaccines: current.vaccines.filter((v) => v.id !== vid) });

  return (
    <SectionCard title="Immunization schedule" desc="Build schedules from the vaccine list (drug type = Vaccine). Used by Well Baby & Ante Natal." right={<Badge variant="outline" className="rounded" data-testid="imm-count">{schedules.length} schedules</Badge>}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr]">
        <TextField label="New schedule name" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} testid="imm-new-name" />
        <div className="flex items-end gap-2">
          <SelectField label="Condition" options={Object.keys(CONDITION_LABELS).map((k) => CONDITION_LABELS[k])} value={CONDITION_LABELS[nf.condition]} onChange={(v) => setNf({ ...nf, condition: Object.keys(CONDITION_LABELS).find((k) => CONDITION_LABELS[k] === v) })} testid="imm-new-condition" />
          <Button className="h-11" onClick={addSchedule} data-testid="imm-add-schedule"><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {schedules.map((sc) => (
          <button key={sc.id} type="button" data-testid={`imm-sel-${sc.id}`} onClick={() => setSel(sc.id)} className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${current?.id === sc.id ? "border-primary bg-primary text-white" : "border-border bg-white"}`}>
            {sc.name} <span className="opacity-70">({CONDITION_LABELS[sc.condition] || sc.condition})</span>
            <Trash2 className="h-3.5 w-3.5" onClick={(e) => { e.stopPropagation(); s.removeImmunizationSchedule(sc.id); setSel(""); }} />
          </button>
        ))}
      </div>

      {current && (
        <div className="mt-4 space-y-2" data-testid="imm-vaccines">
          <div className="flex items-end gap-2">
            {vaccineList.length > 0 ? (
              <SelectField label="Add vaccine from list" options={vaccineList.map((v) => v.name)} value={vacName} onChange={setVacName} testid="imm-vac-select" />
            ) : (
              <TextField label="Vaccine name" value={vacName} onChange={(e) => setVacName(e.target.value)} testid="imm-vac-name" />
            )}
            <Button className="h-11" onClick={addVaccine} data-testid="imm-add-vaccine"><Plus className="mr-1 h-4 w-4" /> Add vaccine</Button>
          </div>
          {(current.vaccines || []).map((v) => (
            <div key={v.id} className="grid grid-cols-[1fr_120px_1fr_40px] items-center gap-2 rounded-md border border-border bg-white p-2" data-testid={`imm-vac-${v.id}`}>
              <span className="text-sm font-semibold">{v.name}</span>
              <TextField label="" type="number" value={v.offsetDays} onChange={(e) => updVac(v.id, { offsetDays: Number(e.target.value) })} hint="days from birth/contact" />
              <TextField label="" value={v.note} onChange={(e) => updVac(v.id, { note: e.target.value })} placeholder="note" />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={() => rmVac(v.id)} data-testid={`imm-vac-remove-${v.id}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

/* ---------------- Lab master ---------------- */
const LabMaster = ({ s }) => {
  const tests = s.settings.labMaster || [];
  const facilityHasLab = (s.facilities || []).some((f) => f.hasLab);
  const [t, setT] = useState({ name: "", results: "", location: "Bedside" });
  const add = () => {
    if (!t.name) return toast.error("Test name required");
    s.addLabTest({ name: t.name, results: t.results.split(",").map((x) => x.trim()).filter(Boolean), location: t.location });
    setT({ name: "", results: "", location: "Bedside" });
    toast.success("Test added");
  };
  return (
    <SectionCard title="Lab master" desc="Standard lab tests with result options and default location. Bedside is the default; Lab is available when a facility has a lab." right={<Badge variant="outline" className="rounded" data-testid="lab-count">{tests.length} tests</Badge>}>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px_auto]">
        <TextField label="Test name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} testid="lab-new-name" />
        <TextField label="Result options (comma separated)" value={t.results} onChange={(e) => setT({ ...t, results: e.target.value })} testid="lab-new-results" />
        <SelectField label="Default location" options={facilityHasLab ? ["Bedside", "Lab"] : ["Bedside"]} value={t.location} onChange={(v) => setT({ ...t, location: v })} testid="lab-new-location" />
        <div className="flex items-end"><Button className="h-11" onClick={add} data-testid="lab-add"><Plus className="mr-1 h-4 w-4" /> Add</Button></div>
      </div>
      <div className="mt-4 space-y-2" data-testid="lab-list">
        {tests.map((test) => (
          <div key={test.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-white p-3" data-testid={`lab-row-${test.id}`}>
            <div><p className="font-semibold">{test.name}</p><p className="text-xs text-muted-foreground">{(test.results || []).join(" · ") || "free text result"} · default {test.location}</p></div>
            <div className="flex items-center gap-2">
              <SelectField label="" options={facilityHasLab ? ["Bedside", "Lab"] : ["Bedside"]} value={test.location} onChange={(v) => s.updateLabTest(test.id, { location: v })} testid={`lab-loc-${test.id}`} />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={() => s.removeLabTest(test.id)} data-testid={`lab-remove-${test.id}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

/* ---------------- Feature config master ---------------- */
const FeatureConfigMaster = ({ s }) => {
  const config = s.settings.featureConfig || {};
  const conditions = Object.keys(CONDITION_LABELS);
  const [cond, setCond] = useState(conditions[0]);
  const features = [...(config[cond] || [])].sort((a, b) => a.order - b.order);

  const save = (next) => s.setFeatureConfig(cond, next);
  const move = (i, dir) => {
    const arr = [...features];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    save(arr.map((f, idx) => ({ ...f, order: idx })));
  };
  const toggle = (key, field) => save(features.map((f) => (f.key === key ? { ...f, [field]: !f[field] } : f)));

  return (
    <SectionCard title="Feature configuration" desc="Choose which features appear for each condition, their sequence, and whether they print in the summary.">
      <div className="mb-4 flex flex-wrap gap-2">
        {conditions.map((c) => (
          <button key={c} type="button" data-testid={`feat-cond-${c}`} onClick={() => setCond(c)} className={`h-10 rounded-md border px-4 text-sm font-semibold ${cond === c ? "border-primary bg-primary text-white" : "border-border bg-white"}`}>{CONDITION_LABELS[c]}</button>
        ))}
      </div>
      <div className="space-y-2" data-testid="feat-list">
        {features.map((f, i) => (
          <div key={f.key} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-white p-3" data-testid={`feat-row-${f.key}`}>
            <div className="flex flex-col">
              <button type="button" className="text-muted-foreground hover:text-primary" onClick={() => move(i, -1)} data-testid={`feat-up-${f.key}`}>▲</button>
              <button type="button" className="text-muted-foreground hover:text-primary" onClick={() => move(i, 1)} data-testid={`feat-down-${f.key}`}>▼</button>
            </div>
            <span className="min-w-0 flex-1 font-semibold">{f.label}</span>
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.enabled !== false} onCheckedChange={() => toggle(f.key, "enabled")} data-testid={`feat-enabled-${f.key}`} /> Enabled</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.print} onCheckedChange={() => toggle(f.key, "print")} data-testid={`feat-print-${f.key}`} /> Print in summary</label>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};
