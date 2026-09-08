import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/Fields";
import { Camera, X, Fingerprint, FileUp, FileText } from "lucide-react";
import { toast } from "sonner";

export const PhotoCapture = ({ label = "Photos", photos = [], onChange, testid = "photo", max = 6 }) => {
  const input = useRef(null);

  const pick = (e) => {
    const files = [...(e.target.files || [])].slice(0, max - photos.length);
    files.forEach((f) => {
      const r = new FileReader();
      r.onload = () => onChange([...photos, r.result].slice(0, max));
      r.readAsDataURL(f);
    });
    toast.success(`${files.length} photo(s) attached — stored on the device until sync`);
    e.target.value = "";
  };

  return (
    <Field label={label} hint="Camera or gallery. Photos are held on the device and upload with the record.">
      <div className="flex flex-wrap gap-3">
        {photos.map((src, i) => (
          <div key={i} className="relative h-24 w-24 overflow-hidden rounded-md border border-border">
            <img src={src} alt={`capture ${i + 1}`} className="h-full w-full object-cover" data-testid={`${testid}-thumb-${i}`} />
            <button
              type="button"
              data-testid={`${testid}-remove-${i}`}
              onClick={() => onChange(photos.filter((_, x) => x !== i))}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded bg-white/90 text-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            data-testid={`${testid}-add-btn`}
            onClick={() => input.current?.click()}
            className="grid h-24 w-24 place-items-center rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
          >
            <span className="text-center">
              <Camera className="mx-auto h-5 w-5" />
              <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide">Capture</span>
            </span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={pick} data-testid={`${testid}-input`} />
    </Field>
  );
};

/** Paper consent / scanned form — image or PDF, stored on device until sync */
export const DocumentCapture = ({
  label = "Consent document",
  value,
  onChange,
  testid = "consent-doc",
  hint = "Upload a photo or PDF of the signed paper consent form.",
}) => {
  const input = useRef(null);

  const pick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      onChange({ name: file.name, type: file.type, dataUrl: r.result });
      toast.success("Consent document attached — stored on the device until sync");
    };
    r.readAsDataURL(file);
    e.target.value = "";
  };

  const isImage = value?.type?.startsWith("image/") || value?.dataUrl?.startsWith("data:image/");

  return (
    <Field label={label} hint={hint}>
      {value ? (
        <div className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-white p-3" data-testid={`${testid}-preview`}>
          {isImage ? (
            <img src={value.dataUrl} alt={value.name || "consent"} className="h-14 w-14 shrink-0 rounded border border-border object-cover" />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-secondary text-primary">
              <FileText className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{value.name || "Consent document"}</p>
            <p className="text-xs text-muted-foreground">Attached · will upload on sync</p>
          </div>
          <Button type="button" variant="outline" className="h-10 shrink-0" data-testid={`${testid}-remove-btn`} onClick={() => onChange(null)}>
            <X className="mr-1 h-4 w-4" /> Remove
          </Button>
        </div>
      ) : (
        <button
          type="button"
          data-testid={`${testid}-add-btn`}
          onClick={() => input.current?.click()}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
        >
          <FileUp className="h-4 w-4" /> Upload consent document
        </button>
      )}
      <input ref={input} type="file" accept="image/*,application/pdf" hidden onChange={pick} data-testid={`${testid}-input`} />
    </Field>
  );
};

export const FingerprintCapture = ({ value, onChange }) => (
  <Field label="Fingerprint template" hint="Biometric template used as the patient's unique identifier (mock scanner in this prototype)">
    <div className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-md border border-border p-4 sm:flex-row sm:items-center">
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-md ${value ? "bg-green-50 text-green-700" : "bg-secondary text-primary"}`}>
        <Fingerprint className="h-7 w-7" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{value ? "Template captured" : "No template captured"}</p>
        <p className="truncate text-sm text-muted-foreground">{value || "Place the patient's right index finger on the scanner"}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-12"
        data-testid="fingerprint-capture-btn"
        onClick={() => {
          const t = `FP-${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
          onChange(t);
          toast.success("Fingerprint template captured");
        }}
      >
        {value ? "Re-capture" : "Capture fingerprint"}
      </Button>
    </div>
  </Field>
);

export const Avatar = ({ patient, size = "h-12 w-12", testid }) =>
  patient.photo ? (
    <img
      src={patient.photo}
      alt={patient.name}
      data-testid={testid}
      className={`${size} shrink-0 rounded-md border border-border object-cover`}
    />
  ) : (
    <span
      data-testid={testid}
      className={`${size} grid shrink-0 place-items-center rounded-md bg-secondary font-head text-base font-bold text-primary`}
    >
      {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
    </span>
  );

export const isLostToFollowUp = (patient, encounters, settings) => {
  if (!patient.treatmentEnd || patient.outcome) return false;
  const encs = encounters.filter((e) => e.patientId === patient.id);
  const last = encs.map((e) => e.date).sort().pop();
  const diseaseId = encs.sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0]?.disease || (patient.diseases || [])[0] || "scabies";
  const days = settings?.ltfuByDisease?.[diseaseId] ?? settings?.lostToFollowUpDays ?? 30;
  const ref = new Date(last && last > patient.treatmentEnd ? last : patient.treatmentEnd);
  return (Date.now() - ref.getTime()) / 86400000 > Number(days);
};

export const ageFromDob = (dob, refDate) => {
  if (!dob) return "";
  const d = new Date(dob);
  const r = refDate ? new Date(refDate) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  let a = r.getFullYear() - d.getFullYear();
  const m = r.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < d.getDate())) a -= 1;
  return a >= 0 ? String(a) : "";
};

/** e.g. "4Y 5M 3D" from date of birth */
export const formatAgeYMD = (dob, refDate) => {
  if (!dob) return "";
  const birth = new Date(dob);
  const ref = refDate ? new Date(refDate) : new Date();
  if (Number.isNaN(birth.getTime()) || birth > ref) return "";

  let y = ref.getFullYear() - birth.getFullYear();
  let m = ref.getMonth() - birth.getMonth();
  let d = ref.getDate() - birth.getDate();

  if (d < 0) {
    m -= 1;
    d += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
  }
  if (m < 0) {
    y -= 1;
    m += 12;
  }
  if (y < 0) return "";
  return `${y}Y ${m}M ${d}D`;
};

export const dobFromAge = (age, refDate) => {
  if (age === "" || age === null || Number.isNaN(Number(age))) return "";
  const r = refDate ? new Date(refDate) : new Date();
  const d = new Date(r.getFullYear() - Number(age), r.getMonth(), r.getDate());
  return d.toISOString().slice(0, 10);
};
