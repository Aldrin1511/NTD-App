import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/Fields";
import { Camera, X, Fingerprint, FileUp, FileText, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { HandRenderer, FINGER_LABELS } from "@/components/HandRenderer";
import { FINGER_CODES } from "@/components/handConstants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const PhotoCapture = ({ label = "Photos", photos = [], onChange, testid = "photo", max = 6 }) => {
  const galleryInput = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      toast.error("Camera access denied or unavailable — try Upload from gallery");
    }
  };

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [cameraOpen]);

  useEffect(() => () => stopCamera(), []);

  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return toast.error("Camera not ready yet");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    onChange([...photos, dataUrl].slice(0, max));
    toast.success("Photo captured — stored on the device until sync");
    closeCamera();
  };

  const pick = (e) => {
    const files = [...(e.target.files || [])].slice(0, max - photos.length);
    files.forEach((f) => {
      const r = new FileReader();
      r.onload = () => onChange([...photos, r.result].slice(0, max));
      r.readAsDataURL(f);
    });
    if (files.length) toast.success(`${files.length} photo(s) attached — stored on the device until sync`);
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid={`${testid}-add-btn`}
                className="grid h-24 w-24 place-items-center rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
              >
                <span className="text-center">
                  <Camera className="mx-auto h-5 w-5" />
                  <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide">Capture</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem data-testid={`${testid}-camera-option`} onSelect={() => openCamera()}>
                <Camera className="mr-2 h-4 w-4" /> Take photo
              </DropdownMenuItem>
              <DropdownMenuItem data-testid={`${testid}-gallery-option`} onSelect={() => galleryInput.current?.click()}>
                <ImagePlus className="mr-2 h-4 w-4" /> Upload from gallery
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={pick} data-testid={`${testid}-input`} />

      <Dialog open={cameraOpen} onOpenChange={(open) => (open ? setCameraOpen(true) : closeCamera())}>
        <DialogContent className="sm:max-w-md" data-testid={`${testid}-camera-dialog`}>
          <DialogHeader>
            <DialogTitle>Take photo</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border border-border bg-black">
            <video ref={videoRef} playsInline muted autoPlay className="aspect-[4/3] w-full object-cover" />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="h-11" onClick={closeCamera}>
              Cancel
            </Button>
            <Button type="button" className="h-11" data-testid={`${testid}-snap-btn`} onClick={snapPhoto}>
              <Camera className="mr-2 h-4 w-4" /> Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

export const FingerprintCapture = ({ value, onChange }) => {
  const [selectedFinger, setSelectedFinger] = useState(null);
  const prints = normalizeFingerprints(value);
  const savedFingers = Object.keys(prints);
  const selectedSaved = selectedFinger ? prints[selectedFinger] : null;
  const count = savedFingers.length;

  const capture = () => {
    if (!selectedFinger) {
      toast.error("Select a finger on the hand diagram first");
      return;
    }
    const template = `FP-${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
    const next = {
      ...prints,
      [selectedFinger]: { template, label: FINGER_LABELS[selectedFinger] },
    };
    onChange(next);
    toast.success(`${FINGER_LABELS[selectedFinger]} template ${selectedSaved ? "updated" : "captured"} (${Object.keys(next).length}/10)`);
  };

  const removeSelected = () => {
    if (!selectedFinger || !prints[selectedFinger]) return;
    const next = { ...prints };
    delete next[selectedFinger];
    onChange(Object.keys(next).length ? next : {});
    toast.success(`${FINGER_LABELS[selectedFinger]} template removed`);
  };

  return (
    <Field label="Fingerprint templates" hint="Select each finger and capture — a patient can register all 10 fingers. Templates are stored on device until sync (mock scanner in this prototype).">
      <div className="min-w-0 space-y-4 overflow-hidden rounded-md border border-border p-4">
        <HandRenderer selectedFinger={selectedFinger} savedFingers={savedFingers} onSelectFinger={setSelectedFinger} />
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-md ${count ? "bg-green-50 text-green-700" : "bg-secondary text-primary"}`}>
            <Fingerprint className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {selectedFinger ? FINGER_LABELS[selectedFinger] : count ? `${count} finger${count === 1 ? "" : "s"} registered` : "No finger selected"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {selectedSaved
                ? `${selectedSaved.template} · already captured — capture again to replace`
                : selectedFinger
                  ? `Ready to scan ${FINGER_LABELS[selectedFinger].toLowerCase()} (${count}/10)`
                  : count
                    ? `${count}/10 fingers registered — select another finger to add`
                    : "Tap a finger on the diagram, then capture"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {selectedSaved && (
              <Button type="button" variant="outline" className="h-12 text-red-600 hover:text-red-700" data-testid="fingerprint-remove-btn" onClick={removeSelected}>
                Remove
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-12"
              data-testid="fingerprint-capture-btn"
              disabled={!selectedFinger}
              onClick={capture}
            >
              {selectedSaved ? "Re-capture" : "Capture fingerprint"}
            </Button>
          </div>
        </div>
        {count > 0 && (
          <ul className="flex flex-wrap gap-2" data-testid="fingerprint-list">
            {FINGER_CODES.filter((code) => prints[code]).map((code) => (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => setSelectedFinger(code)}
                  className={`rounded border px-2.5 py-1 text-xs font-medium ${
                    selectedFinger === code ? "border-green-600 bg-green-50 text-green-800" : "border-border bg-white text-foreground"
                  }`}
                >
                  {prints[code].label || FINGER_LABELS[code]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
};

/** Normalize legacy string fingerprint or map of finger → template */
export const normalizeFingerprints = (value) => {
  if (!value) return {};
  if (typeof value === "string") return { LEGACY: { template: value, label: "Fingerprint" } };
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value.filter((x) => x?.finger).map((x) => [x.finger, { template: x.template, label: x.label || FINGER_LABELS[x.finger] }])
    );
  }
  return value;
};

export const fingerprintSummary = (value) => {
  const prints = normalizeFingerprints(value);
  const keys = Object.keys(prints);
  if (!keys.length) return "";
  if (keys.length === 1 && keys[0] === "LEGACY") return prints.LEGACY.template;
  return `${keys.length} finger${keys.length === 1 ? "" : "s"}`;
};

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
