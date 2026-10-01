import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { AreaField, SectionCard, AlertPanel, CheckGrid } from "@/components/Fields";
import { PhotoCapture } from "@/components/Capture";
import PatientSidebar from "@/components/PatientSidebar";
import { SUSPECT_OPTIONS, assessmentSpecs, localISODate } from "@/mock/specs";
import { DISEASES } from "@/mock/data";
import { useFormDirty } from "@/lib/useFormDirty";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, ShieldQuestion, PanelLeft } from "lucide-react";

export default function SuspectScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {
    patients,
    encounters,
    facilities,
    addSuspect,
    addDisease,
    startSuspectEpisode,
    settings,
    user,
    online,
    authSession,
    canAccessDisease,
  } = useStore();
  const p = patients.find((x) => x.id === id);
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  const myDiseases = useMemo(() => assessmentSpecs(id, { encounters: patientEncs }), [id, patientEncs]);

  const facilityName = params.get("fac") || p?.facility || "";
  const visitType = params.get("vt") || settings.visitTypes?.[0] || "Initial encounter";
  const referral = params.get("ref") || "No";
  const visitDate = params.get("date") || localISODate();
  const locationId =
    params.get("loc") ||
    facilities.find((f) => f.name === facilityName)?.id ||
    "";

  const [symptoms, setSymptoms] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [suspect, setSuspect] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [lhs, setLhs] = useState(true);
  const formState = useMemo(() => ({ symptoms, photos, suspect, notes }), [symptoms, photos, suspect, notes]);
  const { dirty, markSaved } = useFormDirty(formState, `${id}-suspect`);

  if (!p)
    return (
      <AppShell title="Patient not found">
        <Button className="h-12" onClick={() => navigate("/patients")}>Back to patients</Button>
      </AppShell>
    );

  const options = SUSPECT_OPTIONS.filter(
    (o) => o.id === "other" || o.id === "none" || canAccessDisease(o.id)
  );
  const accessibleDiseases = DISEASES.filter((d) => canAccessDisease(d.id));

  const persistSuspect = async (diseaseId) => {
    if (!symptoms.length) {
      toast.error("Select at least one presenting complaint");
      return null;
    }
    if (!suspect) {
      toast.error("Choose the suspected NTD, or None");
      return null;
    }
    if (!visitType) {
      toast.error("Visit type is missing — start again from Add Pathways");
      return null;
    }
    if (!locationId) {
      toast.error("Location is missing — start again from Add Pathways and choose a location");
      return null;
    }
    if (!authSession?.facilityId) {
      // Demo / no HMIS session — local only (not queued for HMIS)
      const rec = addSuspect({ patientId: p.id, symptoms, photos, suspect, notes });
      if (diseaseId) addDisease(p.id, diseaseId);
      return { suspect: rec, encounter: null, localOnly: true };
    }

    const data = await startSuspectEpisode({
      patientId: p.id,
      disease: diseaseId || undefined,
      suspect,
      symptoms,
      notes,
      photos,
      visitType,
      locationId,
      locationName: facilityName,
      visitDate,
      referral,
      clinicianName: user?.name,
    });
    return data;
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Save screening only (no disease episode yet)
      const result = await persistSuspect(undefined);
      if (!result) return;
      const rec = result.suspect || result;
      setSaved(rec);
      markSaved(formState);
      toast.success(
        result.localOnly
          ? online
            ? `Suspect screening ${rec.id} saved to device`
            : `Suspect screening ${rec.id} saved locally · queued until you are online`
          : "Suspect screening saved"
      );
    } catch (err) {
      toast.error(err?.message || "Failed to save suspect screening");
    } finally {
      setSaving(false);
    }
  };

  const startEncounter = async (diseaseId) => {
    if (starting) return;
    setStarting(true);
    try {
      const result = await persistSuspect(diseaseId);
      if (!result) return;
      const rec = result.suspect || saved;
      setSaved(rec);
      markSaved(formState);
      addDisease(p.id, diseaseId);
      const visitId = result.visitId || result.encounter?.id;
      toast.success(`${accessibleDiseases.find((d) => d.id === diseaseId)?.name || DISEASES.find((d) => d.id === diseaseId)?.name || "Disease"} pathway started`);
      if (visitId) {
        navigate(
          `/patients/${p.id}/encounter/${diseaseId}?enc=${encodeURIComponent(visitId)}&fac=${encodeURIComponent(facilityName)}&vt=${encodeURIComponent(visitType)}&ref=${encodeURIComponent(referral)}`
        );
      } else {
        navigate(`/patients/${p.id}/encounter/${diseaseId}?sus=${encodeURIComponent(rec?.id || "")}`);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to start pathway from suspect screening");
    } finally {
      setStarting(false);
    }
  };

  const requestLeave = () => {
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes and leave?");
      if (!ok) return;
    }
    navigate(`/patients/${p.id}`);
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
              <p className="text-xs text-muted-foreground" data-testid="suspect-context">
                {facilityName || "No facility"} · {visitType} · Step 1 — presenting complaints
              </p>
            </div>
            <Button variant="outline" className="h-11" data-testid="back-btn" onClick={requestLeave}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Exit to record
            </Button>
          </div>

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

          {(saved || suspect) && (
            <SectionCard
              title={saved ? "Screening saved" : "Ready to start"}
              desc={
                saved
                  ? `${saved.id} · ${(saved.symptoms || symptoms).length} complaint(s) · ${(saved.photos || photos).length} photo(s)`
                  : "Save screening, or start a disease pathway to persist symptoms in HMIS"
              }
            >
              {["none", "other"].includes(suspect) || !accessibleDiseases.find((d) => d.id === suspect) ? (
                <AlertPanel level="routine" title="🟢 Suspect Non-NTDs Skin Condition" testid="suspect-none-result">
                  No disease flow is required. Advise the patient to return if symptoms change.
                </AlertPanel>
              ) : (
                <>
                  <AlertPanel level="review" title={`🟠 ${SUSPECT_OPTIONS.find((d) => d.id === suspect)?.label}`} testid="suspect-result">
                    Start the {accessibleDiseases.find((d) => d.id === suspect)?.name || "disease"} clinical flow to record history, assessment,
                    diagnosis and treatment. Symptoms will be saved with the pathway visit.
                  </AlertPanel>
                  <Button
                    className="h-12 w-full text-base"
                    disabled={!user?.canEdit || starting}
                    data-testid="start-encounter-btn"
                    onClick={() => startEncounter(suspect)}
                  >
                    {starting ? "Starting…" : `Start ${accessibleDiseases.find((d) => d.id === suspect)?.name} pathway`}
                  </Button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {accessibleDiseases.filter((d) => d.id !== suspect).map((d) => (
                      <Button
                        key={d.id}
                        variant="outline"
                        className="h-12"
                        disabled={!user?.canEdit || starting}
                        data-testid={`start-other-${d.id}`}
                        onClick={() => startEncounter(d.id)}
                      >
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
            {saved ? (dirty ? "Unsaved changes" : `Saved: ${saved.id}`) : dirty ? "Unsaved changes" : "Not saved yet"}
          </span>
          <Button
            className="ml-auto h-12 flex-1 text-base sm:flex-none sm:px-10"
            data-testid="save-suspect-btn"
            disabled={!dirty || !user?.canEdit || saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save suspect screening"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
