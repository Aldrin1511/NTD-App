import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { AreaField, SectionCard, AlertPanel, CheckGrid } from "@/components/Fields";
import { PhotoCapture } from "@/components/Capture";
import PatientSidebar from "@/components/PatientSidebar";
import { SUSPECT_OPTIONS, SPEC_LIST } from "@/mock/specs";
import { DISEASES } from "@/mock/data";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, ShieldQuestion, PanelLeft } from "lucide-react";

export default function SuspectScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { patients, encounters, addSuspect, addDisease, settings, user } = useStore();
  const p = patients.find((x) => x.id === id);
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  const myDiseases = SPEC_LIST.filter((s) => (p?.diseases || []).includes(s.id));

  const [symptoms, setSymptoms] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [suspect, setSuspect] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(null);
  const [lhs, setLhs] = useState(true);

  if (!p)
    return (
      <AppShell title="Patient not found">
        <Button className="h-12" onClick={() => navigate("/patients")}>Back to patients</Button>
      </AppShell>
    );

  const options = SUSPECT_OPTIONS;

  const save = () => {
    if (!symptoms.length) return toast.error("Select at least one presenting complaint");
    if (!suspect) return toast.error("Choose the suspected NTD, or None");
    const rec = addSuspect({ patientId: p.id, symptoms, photos, suspect, notes });
    setSaved(rec);
    toast.success(`Suspect screening ${rec.id} saved locally`);
  };

  const startEncounter = (diseaseId) => {
    addDisease(p.id, diseaseId);
    navigate(`/patients/${p.id}/encounter/${diseaseId}?sus=${saved?.id || ""}`);
  };

  return (
    <AppShell>
      <div className={`grid gap-6 pb-28 ${lhs ? "lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
        {lhs && (
          <PatientSidebar
            patient={p}
            encounters={patientEncs}
            diseases={myDiseases}
            onCollapse={() => setLhs(false)}
            testid="suspect-lhs-panel"
          />
        )}

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {!lhs && (
              <Button variant="outline" size="icon" className="h-11 w-11" data-testid="lhs-expand-btn" onClick={() => setLhs(true)}>
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-head text-xl font-bold tracking-tight sm:text-2xl">NTD Suspect</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground" data-testid="suspect-context">
                {p.facility || "No facility"} · Step 1 — presenting complaints
              </p>
            </div>
            <Button variant="outline" className="h-11" data-testid="back-btn" onClick={() => navigate(`/patients/${p.id}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Exit to record
            </Button>
          </div>

          {/* <AlertPanel level="info" title="Step 1 — what is the patient telling you?" testid="suspect-intro">
            Tick everything the patient reports in their own words, take photos of the skin, then choose which NTD you
            suspect. The complaint list is maintained by your programme administrator.
          </AlertPanel> */}

          <SectionCard title="Presenting complaints / symptoms" desc={`${settings.symptoms.length} complaints configured by the programme`}>
            <CheckGrid label="" options={settings.symptoms} value={symptoms} onChange={setSymptoms} testid="symptom" cols="sm:grid-cols-2" />
          </SectionCard>

          <SectionCard title="What is the NTD suspected?" desc="One choice only — this decides which disease flow opens next">
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((o) => {
                const active = suspect === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    data-testid={`suspect-${o.id}`}
                    onClick={() => setSuspect(o.id)}
                    className={`flex min-h-14 items-center gap-3 rounded-md border px-4 text-left font-semibold transition-colors ${
                      active ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${active ? "bg-white/20" : "bg-secondary text-primary"}`}>
                      {["none", "other"].includes(o.id) ? <ShieldQuestion className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                    </span>
                    {o.label}
                  </button>
                );
              })}
            </div>
            <AreaField label="Screening note (optional)" testid="suspect-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </SectionCard>

          <SectionCard title="Skin photographs" desc="Stored with the screening and uploaded on sync">
            <PhotoCapture label="Capture skin photos" photos={photos} onChange={setPhotos} testid="suspect-photo" />
          </SectionCard>

          {saved && (
            <SectionCard title="Screening saved" desc={`${saved.id} · ${symptoms.length} complaint(s) · ${photos.length} photo(s)`}>
              {["none", "other"].includes(suspect) || !DISEASES.find((d) => d.id === suspect) ? (
                <AlertPanel level="routine" title="🟢 Suspect Non-NTDs Skin Condition" testid="suspect-none-result">
                  No disease flow is required. Advise the patient to return if symptoms change.
                </AlertPanel>
              ) : (
                <>
                  <AlertPanel level="review" title={`🟠 ${SUSPECT_OPTIONS.find((d) => d.id === suspect)?.label}`} testid="suspect-result">
                    Start the {DISEASES.find((d) => d.id === suspect)?.name || "disease"} clinical flow to record history, assessment,
                    diagnosis and treatment.
                  </AlertPanel>
                  <Button className="h-12 w-full text-base" disabled={!user?.canEdit} data-testid="start-encounter-btn" onClick={() => startEncounter(suspect)}>
                    Start {DISEASES.find((d) => d.id === suspect)?.name} episode
                  </Button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {DISEASES.filter((d) => d.id !== suspect).map((d) => (
                      <Button key={d.id} variant="outline" className="h-12" data-testid={`start-other-${d.id}`} onClick={() => startEncounter(d.id)}>
                        Use {d.name} flow instead
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>
          )}
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-white lg:bottom-0">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <span className="hidden text-xs text-muted-foreground sm:block" data-testid="suspect-saved-indicator">
            {saved ? `Saved: ${saved.id}` : "Not saved yet"}
          </span>
          <Button className="ml-auto h-12 flex-1 text-base sm:flex-none sm:px-10" data-testid="save-suspect-btn" onClick={save}>
            Save suspect screening
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
