import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { AlertPanel } from "@/components/Fields";
import PatientForm, { emptyPatientForm, formFromPatient, patientPayload } from "@/components/PatientForm";
import { useFormDirty } from "@/lib/useFormDirty";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function PatientNew() {
  const { id } = useParams();
  const { addPatient, updatePatient, patients, user, online, facilities } = useStore();
  const navigate = useNavigate();
  const existing = id ? patients.find((x) => x.id === id) : null;
  const isEdit = Boolean(id);
  const [f, setF] = useState(() => (existing ? formFromPatient(existing, user, facilities) : emptyPatientForm(user, facilities)));
  const { dirty, markSaved } = useFormDirty(f, existing?.id || "new-patient");

  if (isEdit && !existing) {
    return (
      <AppShell title="Patient not found">
        <Button className="h-12" data-testid="back-btn" onClick={() => navigate("/patients")}>Back to patients</Button>
      </AppShell>
    );
  }

  if (isEdit && user && user.canEdit === false) {
    return (
      <AppShell title="Edit patient details">
        <AlertPanel level="review" title="View-only access" testid="edit-patient-restricted">
          Your access level allows viewing this record but not editing patient details.
        </AlertPanel>
        <Button className="mt-4 h-12" data-testid="back-btn" onClick={() => navigate(`/patients/${id}`)}>Back to record</Button>
      </AppShell>
    );
  }

  const save = (thenEncounter) => {
    const hasAge = f.dob || f.ageY !== "" || f.ageM !== "" || f.ageD !== "" || f.age !== "";
    if (!f.name || !hasAge || !f.gender) return toast.error("Name, age and gender are required");
    const payload = patientPayload(f);
    if (isEdit) {
      const rec = updatePatient(existing.id, payload);
      markSaved(f);
      toast.success(
        online
          ? `Patient ${rec.id} details updated`
          : `Patient ${rec.id} updated locally · queued until you are online`
      );
      navigate(`/patients/${rec.id}`);
      return;
    }
    const rec = addPatient(payload);
    markSaved(f);
    toast.success(
      online
        ? `Patient ${rec.id} saved to device`
        : `Patient ${rec.id} saved locally · queued until you are online`
    );
    navigate(thenEncounter ? `/patients/${rec.id}/suspect` : `/patients/${rec.id}`);
  };

  const leaveTo = isEdit ? `/patients/${id}` : "/patients";
  const requestLeave = () => {
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes and leave?");
      if (!ok) return;
    }
    navigate(leaveTo);
  };

  return (
    <AppShell
      title={isEdit ? "Edit patient details" : "Quick registration"}
      subtitle={isEdit ? "Update identity, location and consent. Clinical encounters are not changed." : "Six essential fields first — everything else can be captured during the encounter"}
      action={
        <Button variant="outline" className="h-12" data-testid="back-btn" onClick={requestLeave}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {isEdit ? "Back to record" : "Back to patients"}
        </Button>
      }
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <PatientForm f={f} setF={setF} patientId={existing?.id || ""} mode={isEdit ? "edit" : "create"} />
          <div className="space-y-3 rounded-lg border border-border bg-white p-5">
            {isEdit ? (
              <Button className="h-12 w-full text-base" data-testid="save-patient-btn" disabled={!dirty} onClick={() => save(false)}>
                Save details
              </Button>
            ) : (
              <>
                <Button className="h-12 w-full text-base" data-testid="save-and-encounter-btn" disabled={!dirty} onClick={() => save(true)}>
                  Save &amp; start suspect screening
                </Button>
                <Button variant="outline" className="h-12 w-full text-base" data-testid="save-patient-btn" disabled={!dirty} onClick={() => save(false)}>
                  Save patient only
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="hidden lg:block" aria-hidden="true" />
      </div>
    </AppShell>
  );
}
