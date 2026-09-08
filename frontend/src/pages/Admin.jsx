import { useState } from "react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TextField, SelectField, SectionCard, AlertPanel } from "@/components/Fields";
import { PhotoCapture } from "@/components/Capture";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GEO, DISEASES } from "@/mock/data";
import { DISEASE_SPECS, SPEC_LIST } from "@/mock/specs";
import { toast } from "sonner";
import { UserPlus, Upload, Trash2, Plus, KeyRound, Building2, Users, Library } from "lucide-react";

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
  { id: "symptoms", label: "Symptoms" },
  { id: "visits", label: "Visit type" },
  { id: "rules", label: "Programme rules" },
  { id: "branding", label: "Client & branding" },
];

export default function Admin() {
  const s = useStore();
  const [tab, setTab] = useState("users");
  const [master, setMaster] = useState("drugs");

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
          {master === "symptoms" && <SymptomsMaster s={s} />}
          {master === "visits" && <VisitTypeMaster s={s} />}
          {master === "rules" && <RulesMaster s={s} />}
          {master === "branding" && <BrandingMaster s={s} />}
        </div>
      )}
    </AppShell>
  );
}

const UsersTab = ({ s }) => {
  const [open, setOpen] = useState(false);
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
                        toast.success(`Temporary password for ${u.name}: ${temp}`);
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
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{x.id}</p>
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
  const [d, setD] = useState({ name: "", form: "Oral", strength: "", disease: "scabies" });
  return (
    <SectionCard title="Drugs" desc="Drug catalogue used by the treatment section — configurable per country protocol" right={<Badge variant="outline" className="rounded" data-testid="drug-count">{s.settings.drugs.length} drugs</Badge>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Drug name" testid="new-drug-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <SelectField label="Form" options={["Oral", "Topical", "Injection"]} value={d.form} onChange={(v) => setD({ ...d, form: v })} testid="new-drug-form" />
        <TextField label="Strength" testid="new-drug-strength" value={d.strength} onChange={(e) => setD({ ...d, strength: e.target.value })} />
        <SelectField label="Disease" options={DISEASES.map((x) => x.name)} value={DISEASES.find((x) => x.id === d.disease)?.name} onChange={(v) => setD({ ...d, disease: DISEASES.find((x) => x.name === v)?.id })} testid="new-drug-disease" />
      </div>
      <Button
        className="h-12"
        data-testid="add-drug-btn"
        onClick={() => {
          if (!d.name.trim()) return toast.error("Drug name is required");
          s.addDrug({ name: d.name.trim(), form: d.form, strength: d.strength, diseases: [d.disease] });
          setD({ name: "", form: "Oral", strength: "", disease: "scabies" });
          toast.success("Drug added to the catalogue");
        }}
      >
        <Plus className="mr-2 h-4 w-4" /> Add drug
      </Button>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[560px] text-sm" data-testid="drug-table">
          <thead className="bg-muted">
            <tr>{["Drug", "Form", "Strength", "Disease", ""].map((h) => (<th key={h} className="p-3 text-left font-semibold">{h}</th>))}</tr>
          </thead>
          <tbody>
            {s.settings.drugs.map((x) => (
              <tr key={x.name} className="border-t border-border">
                <td className="p-3 font-semibold">{x.name}</td>
                <td className="p-3">{x.form}</td>
                <td className="p-3">{x.strength}</td>
                <td className="p-3">{(x.diseases || []).map((id) => DISEASES.find((y) => y.id === id)?.name).join(", ")}</td>
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

const RegimentMaster = ({ s }) => {
  const [r, setR] = useState({ name: "", disease: "scabies", diagnosis: "", ageMin: "", ageMax: "", weightMin: "", weightMax: "", drugs: "" });
  const regimens = s.settings.regimens || [];
  const spec = DISEASE_SPECS[r.disease];
  return (
    <SectionCard title="Regiment" desc="Build treatment regimens from the drug list; criteria drive auto-population in the Drugs feature after assessment"
      right={<Badge variant="outline" className="rounded" data-testid="regimen-count">{regimens.length} regimens</Badge>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Regimen name" testid="new-regimen-name" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
        <SelectField label="Condition" options={SPEC_LIST.map((x) => x.name)} value={spec?.name} onChange={(v) => setR({ ...r, disease: SPEC_LIST.find((x) => x.name === v).id, diagnosis: "" })} testid="new-regimen-disease" />
        <SelectField label="Diagnosis criteria" options={spec?.diagnosis || []} value={r.diagnosis} onChange={(v) => setR({ ...r, diagnosis: v })} testid="new-regimen-diagnosis" />
        <SelectField label="Drug" options={s.settings.drugs.map((d) => d.name)} value={r.drugs} onChange={(v) => setR({ ...r, drugs: v })} testid="new-regimen-drug" />
        <TextField label="Age min (y)" type="number" testid="new-regimen-age-min" value={r.ageMin} onChange={(e) => setR({ ...r, ageMin: e.target.value })} />
        <TextField label="Age max (y)" type="number" testid="new-regimen-age-max" value={r.ageMax} onChange={(e) => setR({ ...r, ageMax: e.target.value })} />
        <TextField label="Weight min (kg)" type="number" testid="new-regimen-weight-min" value={r.weightMin} onChange={(e) => setR({ ...r, weightMin: e.target.value })} />
        <TextField label="Weight max (kg)" type="number" testid="new-regimen-weight-max" value={r.weightMax} onChange={(e) => setR({ ...r, weightMax: e.target.value })} />
      </div>
      <Button className="h-12" data-testid="add-regimen-btn" onClick={() => {
        if (!r.name.trim() || !r.drugs) return toast.error("Regimen name and drug are required");
        s.addRegimen(r); setR({ name: "", disease: "scabies", diagnosis: "", ageMin: "", ageMax: "", weightMin: "", weightMax: "", drugs: "" });
        toast.success("Regimen added");
      }}>
        <Plus className="mr-2 h-4 w-4" /> Add regimen
      </Button>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[820px] text-sm" data-testid="regimen-table">
          <thead className="bg-muted"><tr>{["Regimen", "Condition", "Diagnosis", "Age", "Weight", "Drugs", ""].map((h) => (<th key={h} className="p-3 text-left font-semibold">{h}</th>))}</tr></thead>
          <tbody>
            {regimens.map((x) => (
              <tr key={x.id} className="border-t border-border" data-testid={`regimen-row-${x.id}`}>
                <td className="p-3"><p className="font-semibold">{x.name}</p><p className="text-xs uppercase tracking-wider text-muted-foreground">{x.id}</p></td>
                <td className="p-3">{DISEASE_SPECS[x.disease]?.name}</td>
                <td className="p-3">{x.diagnosis || "Any"}</td>
                <td className="p-3">{x.ageMin || 0}–{x.ageMax || 120}y</td>
                <td className="p-3">{x.weightMin || 0}–{x.weightMax || 200}kg</td>
                <td className="p-3">{x.drugs}</td>
                <td className="p-3"><Button variant="ghost" size="icon" className="h-10 w-10 text-red-600" data-testid={`remove-regimen-${x.id}`} onClick={() => { s.removeRegimen(x.id); toast.success("Regimen removed"); }}><Trash2 className="h-4 w-4" /></Button></td>
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

const BrandingMaster = ({ s }) => {
  const [b, setB] = useState(s.branding);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Client &amp; branding" desc="Shown on the login screen, app header and printed reports">
        <TextField label="Client / programme name" testid="client-name-input" value={b.clientName} onChange={(e) => setB({ ...b, clientName: e.target.value })} />
        <TextField label="Programme subtitle" testid="programme-input" value={b.programme} onChange={(e) => setB({ ...b, programme: e.target.value })} />
        <TextField label="Logo URL" testid="logo-input" value={b.logo} onChange={(e) => setB({ ...b, logo: e.target.value })} placeholder="https://…" hint="File upload will be wired to object storage in the build phase" />
        <div className="flex items-center gap-4 rounded-md border border-dashed border-border p-4">
          {b.logo ? (
            <img src={b.logo} alt="logo preview" className="h-14 w-14 rounded-md border border-border object-cover" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-md bg-secondary text-primary"><Upload className="h-5 w-5" /></span>
          )}
          <p className="text-sm text-muted-foreground">Logo preview</p>
        </div>
        <Button
          className="h-12 w-full"
          data-testid="save-branding-btn"
          onClick={() => {
            s.setBranding(b);
            toast.success("Branding updated");
          }}
        >
          Save branding
        </Button>
      </SectionCard>
      <SectionCard title="Prototype controls">
        <Button
          variant="outline"
          className="h-12 w-full"
          data-testid="reset-demo-btn"
          onClick={() => {
            s.resetDemo();
            toast.success("Demo data reset");
          }}
        >
          Reset demo data
        </Button>
      </SectionCard>
    </div>
  );
};
