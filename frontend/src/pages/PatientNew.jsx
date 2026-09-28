import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { AlertPanel } from "@/components/Fields";
import PatientForm, { emptyPatientForm, formFromPatient, patientPayload, validateNtdForHmis } from "@/components/PatientForm";
import { useFormDirty } from "@/lib/useFormDirty";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function PatientNew() {
  const { id } = useParams();
  const {
    addPatient,
    updatePatient,
    patients,
    user,
    online,
    facilities,
    authSession,
    patientRegisterDraft,
    setPatientRegisterDraft,
  } = useStore();
  const navigate = useNavigate();
  const existing = id ? patients.find((x) => x.id === id) : null;
  const isEdit = Boolean(id);
  const [f, setF] = useState(() => {
    if (existing) return formFromPatient(existing, user, facilities);
    if (patientRegisterDraft) return patientRegisterDraft;
    return emptyPatientForm(user, facilities);
  });
  const [saving, setSaving] = useState(false);
  const { dirty, markSaved } = useFormDirty(f, existing?.id || "new-patient");
  const formRef = useRef(f);
  formRef.current = f;
  const setDraftRef = useRef(setPatientRegisterDraft);
  setDraftRef.current = setPatientRegisterDraft;

  // Persist draft only on unmount / leave (not every keystroke)
  useEffect(() => {
    if (isEdit) return undefined;
    return () => {
      setDraftRef.current(formRef.current);
    };
  }, [isEdit]);

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

  const isUnsyncedLocal =
    isEdit &&
    existing &&
    (existing.localOnly || String(existing.id || "").startsWith("local-"));

  if (isEdit && !online) {
    return (
      <AppShell title="Edit patient details">
        <AlertPanel level="review" title="Online required" testid="edit-patient-offline">
          Patient details can only be edited while online. Changes are saved to HMIS (real database), not on this device.
        </AlertPanel>
        <Button className="mt-4 h-12" data-testid="back-btn" onClick={() => navigate(`/patients/${id}`)}>
          Back to record
        </Button>
      </AppShell>
    );
  }

  if (isEdit && isUnsyncedLocal) {
    return (
      <AppShell title="Edit patient details">
        <AlertPanel level="review" title="Sync required first" testid="edit-patient-unsynced">
          This patient is still queued from offline register. Tap Sync to create them in HMIS, then you can edit.
        </AlertPanel>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="h-12" data-testid="edit-go-sync" onClick={() => navigate("/sync")}>
            Go to Sync
          </Button>
          <Button variant="outline" className="h-12" data-testid="back-btn" onClick={() => navigate(`/patients/${id}`)}>
            Back to record
          </Button>
        </div>
      </AppShell>
    );
  }

  const save = async (thenEncounter) => {
    if (saving) return;
    const validationError = validateNtdForHmis(f);
    if (validationError) return toast.error(validationError);

    if (isEdit) {
      if (!online) {
        return toast.error("Go online to edit patient details — changes save to HMIS only");
      }
      setSaving(true);
      try {
        const payload = patientPayload(f);
        const rec = await updatePatient(existing.id, payload);
        markSaved(f);
        toast.success(`Patient ${rec.patientCode || "record"} updated in HMIS`);
        navigate(`/patients/${rec.id}`);
      } catch (err) {
        toast.error(err?.message || "Failed to update patient");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!authSession?.facilityId) {
      return toast.error("Sign in with programme credentials before registering a patient to HMIS");
    }

    setSaving(true);
    try {
      const rec = await addPatient(f);
      markSaved(f);
      toast.success(
        rec.localOnly
          ? `Patient saved offline · tap Sync when you are online`
          : `Patient ${rec.patientCode || "record"} registered in HMIS`
      );
      navigate(thenEncounter ? `/patients/${rec.id}/suspect` : `/patients/${rec.id}`);
    } catch (err) {
      toast.error(err?.message || "Failed to register patient");
    } finally {
      setSaving(false);
    }
  };

  const leaveTo = isEdit ? `/patients/${id}` : "/patients";
  const requestLeave = () => {
    if (isEdit && dirty) {
      const ok = window.confirm("Discard unsaved changes and leave?");
      if (!ok) return;
    }
    if (!isEdit) setPatientRegisterDraft(f);
    navigate(leaveTo);
  };

  return (
    <AppShell
      title={isEdit ? "Edit patient details" : "Quick registration"}
      subtitle={isEdit ? "Update identity, location and consent. Clinical encounters are not changed." : "Registers to the same HMIS database as Apex — name, DOB/age, gender and phone required"}
      action={
        <Button variant="outline" className="h-12" data-testid="back-btn" onClick={requestLeave}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {isEdit ? "Back to record" : "Back to patients"}
        </Button>
      }
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <PatientForm f={f} setF={setF} patientId={existing?.id || ""} patientCode={existing?.patientCode || ""} mode={isEdit ? "edit" : "create"} />
          <div className="space-y-3 rounded-lg border border-border bg-white p-5">
            {isEdit ? (
              <Button className="h-12 w-full text-base" data-testid="save-patient-btn" disabled={!dirty || saving} onClick={() => save(false)}>
                Save details
              </Button>
            ) : (
              <>
                <Button className="h-12 w-full text-base" data-testid="save-and-encounter-btn" disabled={!dirty || saving} onClick={() => save(true)}>
                  {saving ? "Registering…" : "Save & start suspect screening"}
                </Button>
                <Button variant="outline" className="h-12 w-full text-base" data-testid="save-patient-btn" disabled={!dirty || saving} onClick={() => save(false)}>
                  {saving ? "Registering…" : "Save patient only"}
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
