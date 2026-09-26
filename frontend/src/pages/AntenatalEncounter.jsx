import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import PatientSidebar from "@/components/PatientSidebar";
import { Field, TextField, AreaField, SelectField, ChoiceRow, CheckGrid, AlertPanel, ItemActions } from "@/components/Fields";
import { localISODate } from "@/mock/specs";
import {
  ANTENATAL_ID, ANTENATAL_NAME, MOTHER_VITALS, MOTHER_VITAL_CHOICES,
  FETAL_VITALS, FETAL_VITAL_CHOICES, vitalStatus, ANC_LAB_TESTS, RADIOLOGY_SCANS,
  ANC_IMMUNIZATION, immunizationDueDate, isImmunizationOverdue,
  BABY_OUTCOMES, BABY_SEX, BABY_COMPLICATIONS, BABY_OUTCOME_ALERTS, ANC_OUTCOMES, resolveDating, trimesterLabel, newAncEpisodeId,
  isAncEpisodeClosed, babyName, MEDICAL_HISTORY_OPTIONS, RISK_FACTOR_OPTIONS, autoRiskFactors,
  YES_NO, PRESENT_ABSENT, DYSMENORRHEA, MENSTRUAL_FLOW, CYCLE_REGULARITY,
  DELIVERY_TYPES, DELIVERY_COMPLICATIONS, FETUS_COUNTS, FAMILY_PLANNING, POSTPARTUM_COMPLICATIONS,
  DELIVERY_OUTCOMES, PHYSICAL_EXAM_FIELDS, COUNT_0_10, obstetricCountValue,
} from "@/mock/antenatal";
import { ImmunizationEntryCards } from "@/components/ImmunizationCards";
import AntenatalMedications from "@/components/AntenatalMedications";
import { GEO } from "@/mock/data";
import { toast } from "sonner";
import { ArrowLeft, Check, Save, ChevronDown, CircleCheck, Plus, Trash2 } from "lucide-react";

const emptyBaby = (deliveryType = "") => ({
  sex: "", weightKg: "", lengthCm: "", headCm: "", apgar1: "", apgar5: "", apgar10: "",
  resuscitation: "", complications: [], outcome: "", deliveryType, registered: false,
  physicalExam: {},
});

const syncBabiesToFetuses = (babies, count, deliveryType = "") => {
  const n = Math.max(0, Number(count) || 0);
  const next = [...(babies || [])];
  while (next.length < n) next.push(emptyBaby(deliveryType));
  return next.slice(0, n);
};

const empty = () => ({
  caseDetails: {},
  history: { medical: [], riskFactors: [], riskFactorsDismissed: [], menstrual: {} },
  vitals: { mother: {}, fetal: {} },
  lab: [],
  radiology: [],
  drugs: [],
  posology: {},
  medCourses: {},
  immunization: {},
  notes: [""],
  delivery: { babies: [], postpartum: [], fetusLengths: {} },
  physicalExam: {},
  outcome: { status: "Active" },
});

const statusRing = { green: "border-green-500", amber: "border-amber-500", red: "border-red-500", "": "border-border" };
const statusText = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", "": "text-foreground" };

const roundStep = (v, step) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  if (step < 1) {
    const p = Math.round(1 / step);
    return Math.round(n * p) / p;
  }
  return Math.round(n);
};

const SliderStat = ({ field, value, onChange, testid }) => {
  const has = value !== undefined && value !== "" && value !== null;
  const st = has ? vitalStatus(field, value) : "";
  const cur = has ? Number(value) : (field.normal ? (field.normal[0] + field.normal[1]) / 2 : (field.min + field.max) / 2);
  const [draft, setDraft] = useState(has ? String(value) : "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(has ? String(value) : "");
  }, [value, has, editing]);

  const commit = (raw) => {
    setEditing(false);
    if (raw === "" || raw === "-" || raw === ".") { onChange(""); setDraft(""); return; }
    const n = Number(raw);
    if (!Number.isFinite(n)) { setDraft(has ? String(value) : ""); return; }
    const next = roundStep(Math.min(field.max, Math.max(field.min, n)), field.step);
    onChange(next);
    setDraft(String(next));
  };

  return (
    <div className={`rounded-md border ${statusRing[st]} bg-white p-3`} data-testid={testid}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{field.label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step={field.step}
            min={field.min}
            max={field.max}
            className={`h-8 w-20 rounded border border-input bg-white px-2 text-right text-sm font-bold tabular-nums ${statusText[st]}`}
            value={editing ? draft : (has ? value : "")}
            placeholder="—"
            onFocus={(e) => {
              setEditing(true);
              setDraft(has ? String(value) : "");
              requestAnimationFrame(() => {
                try { e.target.select(); } catch { /* ignore */ }
              });
            }}
            onChange={(e) => { setEditing(true); setDraft(e.target.value); }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            data-testid={`${testid}-input`}
          />
          <span className="text-xs font-medium text-muted-foreground">{field.unit}</span>
        </div>
      </div>
      <Slider
        className="mt-3"
        min={field.min}
        max={field.max}
        step={field.step}
        value={[has ? Number(value) : roundStep(cur, field.step)]}
        onValueChange={([v]) => {
          const next = roundStep(v, field.step);
          onChange(next);
          setDraft(String(next));
          setEditing(false);
        }}
        data-testid={`${testid}-slider`}
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{field.min}</span>
        {field.normal && <span>normal {field.normal[0]}–{field.normal[1]}</span>}
        <span>{field.max}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Type or drag · 1 decimal</p>
    </div>
  );
};

const ChoiceChips = ({ label, options, value, onChange, testid, alertOptions = [] }) => (
  <Field label={label}>
    <div className="flex flex-wrap gap-2.5">
      {options.map((o) => {
        const on = value === o;
        const alert = on && alertOptions.includes(o);
        return (
          <button
            key={o}
            type="button"
            data-testid={`${testid}-${String(o).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            onClick={() => onChange(on ? "" : o)}
            className={`min-h-12 min-w-[4.5rem] rounded-lg border px-5 text-sm font-bold transition-colors ${
              alert
                ? "border-red-600 bg-red-600 text-white"
                : on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white text-foreground hover:bg-muted"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  </Field>
);

const MultiChips = ({ label, options, value = [], onChange, testid, alertWhenSelected = false, autoOptions = [] }) => {
  const items = [...options];
  value.forEach((v) => { if (v && !items.includes(v)) items.push(v); });
  return (
    <CheckGrid
      label={label}
      options={items}
      value={value}
      onChange={onChange}
      testid={testid}
      cols="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      alertWhenSelected={alertWhenSelected}
      autoOptions={autoOptions}
    />
  );
};

export default function AntenatalEncounter() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { patients, encounters, saveEncounter, user, settings, facilities, registerBaby, online } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.id === params.get("enc") && e.disease === ANTENATAL_ID);
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);

  const [d, setD] = useState(() => {
    const priorAnc = !existing
      ? [...patientEncs.filter((e) => e.disease === ANTENATAL_ID)].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
      : null;
    const priorHist = priorAnc?.data?.history || {};
    const base = { ...empty(), ...(existing?.data || {}) };
    const seededMedical = [...new Set([...(priorHist.medical || []), ...(base.history?.medical || [])])];
    const seededRisks = [...new Set([...(priorHist.riskFactors || []), ...(base.history?.riskFactors || [])])];
    const seededDismissed = [...new Set([...(priorHist.riskFactorsDismissed || []), ...(base.history?.riskFactorsDismissed || [])])];
    base.history = {
      medical: seededMedical,
      riskFactors: seededRisks,
      riskFactorsDismissed: seededDismissed,
      menstrual: { ...(priorHist.menstrual || {}), ...(base.history?.menstrual || {}) },
    };
    if (!existing && priorAnc?.data?.caseDetails) {
      base.caseDetails = { ...priorAnc.data.caseDetails };
    }
    base.vitals = { mother: {}, fetal: {}, ...(base.vitals || {}) };
    base.posology = { ...(base.posology || {}) };
    base.medCourses = { ...(base.medCourses || {}) };
    if (!Array.isArray(base.drugs)) base.drugs = [];
    if (!Array.isArray(base.lab)) base.lab = [];
    if (!base.lab.length) {
      base.lab = ANC_LAB_TESTS.map((t) => ({
        test: t.name,
        result: "",
        analyte: "",
        location: "Bedside",
        date: localISODate(),
        sentToLab: false,
        completed: false,
      }));
    }
    base.delivery = { babies: [], postpartum: [], fetusLengths: {}, ...(base.delivery || {}) };
    if (base.delivery.fetuses) {
      base.delivery.babies = syncBabiesToFetuses(
        base.delivery.babies,
        base.delivery.fetuses,
        base.delivery.type || base.delivery.mode || "",
      );
    }
    // Migrate legacy visit-level physicalExam onto baby 1 when babies lack their own exam.
    const legacyExam = { ...(base.physicalExam || {}) };
    if (Object.keys(legacyExam).some((k) => legacyExam[k]) && (base.delivery.babies || []).length) {
      base.delivery.babies = base.delivery.babies.map((b, i) => {
        const hasOwn = b.physicalExam && Object.keys(b.physicalExam).some((k) => b.physicalExam[k]);
        if (hasOwn) return { ...b, physicalExam: b.physicalExam || {} };
        if (i === 0) return { ...b, physicalExam: { ...legacyExam } };
        return { ...b, physicalExam: b.physicalExam || {} };
      });
    } else {
      base.delivery.babies = (base.delivery.babies || []).map((b) => ({
        ...b,
        physicalExam: b.physicalExam || {},
      }));
    }
    base.physicalExam = {};
    base.outcome = { status: "Active", ...(base.outcome || {}) };
    if (!Array.isArray(base.notes) || !base.notes.length) base.notes = [""];
    return base;
  });
  const [open, setOpen] = useState({});
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const [labOther, setLabOther] = useState("");
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "ANC visit";
  const focusSection = params.get("section");

  useEffect(() => {
    const n = focusSection != null && focusSection !== "" ? Number(focusSection) : null;
    if (n == null || Number.isNaN(n) || n < 1) return undefined;
    setOpen((o) => ({ ...o, [n]: true }));
    const timer = window.setTimeout(() => {
      document.querySelector(`[data-testid="anc-section-${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusSection]);

  const dating = useMemo(() => resolveDating(d.caseDetails), [d.caseDetails]);
  const facilityHasLab = useMemo(() => facilities.some((f) => f.name === facility && f.hasLab), [facilities, facility]);
  const vaccineDrugs = useMemo(() => (settings.drugs || []).filter((x) => x.type === "Vaccine" || x.form === "Vaccine"), [settings.drugs]);
  const firstContact = existing?.date || d.caseDetails?.firstContact || localISODate();

  const autoSuggestedRisks = useMemo(
    () => autoRiskFactors(d, p),
    // Intentionally narrow deps — same triggers as auto-add effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      d.caseDetails.neonatalDeath,
      d.caseDetails.stillBirth,
      d.vitals.mother.systolic,
      d.vitals.mother.diastolic,
      d.vitals.mother.weight,
      d.delivery.fetuses,
      p?.age,
      p?.ageYears,
    ]
  );

  // Auto-add clinical risk suggestions; never re-add items the user cleared
  useEffect(() => {
    const suggested = autoSuggestedRisks;
    setD((s) => {
      const cur = s.history?.riskFactors || [];
      const dismissed = s.history?.riskFactorsDismissed || [];
      const toAdd = suggested.filter((x) => !cur.includes(x) && !dismissed.includes(x));
      if (!toAdd.length) return s;
      return { ...s, history: { ...s.history, riskFactors: [...cur, ...toAdd] } };
    });
  }, [autoSuggestedRisks]);

  // Autofill menstrual LMP from case details
  useEffect(() => {
    if (!d.caseDetails.lmp) return;
    setD((s) => {
      if (s.history?.menstrual?.lmp === d.caseDetails.lmp) return s;
      return { ...s, history: { ...s.history, menstrual: { ...s.history.menstrual, lmp: d.caseDetails.lmp } } };
    });
  }, [d.caseDetails.lmp]);

  // Ensure every catalogue test is listed (named section + at least one result row)
  useEffect(() => {
    setD((s) => {
      const missing = ANC_LAB_TESTS.filter((t) => !(s.lab || []).some((r) => r.test === t.name));
      if (!missing.length) return s;
      return {
        ...s,
        lab: [
          ...(s.lab || []),
          ...missing.map((t) => ({
            test: t.name,
            result: "",
            analyte: "",
            location: "Bedside",
            date: localISODate(),
            sentToLab: false,
            completed: false,
          })),
        ],
      };
    });
  }, []);

  const setCase = (patch) => setD((s) => ({ ...s, caseDetails: { ...s.caseDetails, ...patch } }));
  const setHist = (patch) => setD((s) => ({ ...s, history: { ...s.history, ...patch } }));
  const setRiskFactors = (next) => {
    setD((s) => {
      const prev = s.history?.riskFactors || [];
      const removed = prev.filter((x) => !next.includes(x));
      const dismissed = [...new Set([...(s.history?.riskFactorsDismissed || []), ...removed])].filter((x) => !next.includes(x));
      return { ...s, history: { ...s.history, riskFactors: next, riskFactorsDismissed: dismissed } };
    });
  };
  const setMenstrual = (patch) => setD((s) => ({ ...s, history: { ...s.history, menstrual: { ...s.history.menstrual, ...patch } } }));
  const setMotherV = (k, v) => setD((s) => ({ ...s, vitals: { ...s.vitals, mother: { ...s.vitals.mother, [k]: v } } }));
  const setFetalV = (k, v) => setD((s) => ({ ...s, vitals: { ...s.vitals, fetal: { ...s.vitals.fetal, [k]: v } } }));
  const updBabyExam = (i, k, v) =>
    setD((s) => ({
      ...s,
      delivery: {
        ...s.delivery,
        babies: s.delivery.babies.map((b, j) =>
          j === i ? { ...b, physicalExam: { ...(b.physicalExam || {}), [k]: v } } : b
        ),
      },
    }));

  const labTestNames = ANC_LAB_TESTS.map((t) => t.name);
  const otherLabNames = [...new Set((d.lab || []).map((r) => r.test).filter((n) => n && !labTestNames.includes(n)))];
  const labGroups = [...labTestNames, ...otherLabNames];

  const emptyLabRow = (name) => ({
    test: name || ANC_LAB_TESTS[0]?.name || "Other",
    result: "",
    analyte: "",
    location: "Bedside",
    date: localISODate(),
    sentToLab: false,
    completed: false,
  });
  const addLabForTest = (testName, afterGlobalIndex = null) => {
    setD((s) => {
      const row = emptyLabRow(testName);
      if (afterGlobalIndex == null || afterGlobalIndex < 0) {
        const lastIdx = s.lab.reduce((acc, r, i) => (r.test === testName ? i : acc), -1);
        if (lastIdx < 0) return { ...s, lab: [row, ...s.lab] };
        const next = [...s.lab];
        next.splice(lastIdx + 1, 0, row);
        return { ...s, lab: next };
      }
      const next = [...s.lab];
      next.splice(afterGlobalIndex + 1, 0, row);
      return { ...s, lab: next };
    });
  };
  const addLabOther = () => {
    const name = labOther.trim();
    if (!name) return;
    const known = ANC_LAB_TESTS.find((t) => t.name.toLowerCase() === name.toLowerCase());
    addLabForTest(known?.name || name);
    setLabOther("");
  };
  const updLab = (i, patch) => setD((s) => ({ ...s, lab: s.lab.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const rmLab = (i) => setD((s) => {
    const removed = s.lab[i];
    const next = s.lab.filter((_, j) => j !== i);
    if (removed && ANC_LAB_TESTS.some((t) => t.name === removed.test) && !next.some((r) => r.test === removed.test)) {
      return { ...s, lab: [...next, emptyLabRow(removed.test)] };
    }
    return { ...s, lab: next };
  });

  if (!p) return <AppShell title="Patient not found"><Button className="h-12" onClick={() => navigate("/patients")}>Back</Button></AppShell>;

  const addRadiology = () => setD((s) => ({ ...s, radiology: [{ scan: "Early Pregnancy scan", findings: "", comments: "", edd: "", date: localISODate() }, ...s.radiology] }));
  const updRad = (i, patch) => {
    setD((s) => {
      const next = s.radiology.map((x, j) => (j === i ? { ...x, ...patch } : x));
      const row = next[i];
      let casePatch = {};
      if (row?.scan === "Early Pregnancy scan" || row?.scan === "Dating scan") {
        if (patch.edd != null || patch.date != null) {
          casePatch = {
            ...(patch.date != null ? { scanDate: patch.date } : {}),
            ...(patch.edd != null ? { scanEdd: patch.edd, finalSource: s.caseDetails.finalSource || "Scan" } : {}),
          };
        }
      }
      return { ...s, radiology: next, caseDetails: { ...s.caseDetails, ...casePatch } };
    });
  };
  const rmRad = (i) => setD((s) => ({ ...s, radiology: s.radiology.filter((_, j) => j !== i) }));

  const setNote = (i, v) => setD((s) => ({ ...s, notes: s.notes.map((n, j) => (j === i ? v : n)) }));
  const addNote = () => setD((s) => ({ ...s, notes: ["", ...s.notes] }));
  const rmNote = (i) => setD((s) => ({ ...s, notes: s.notes.length <= 1 ? [""] : s.notes.filter((_, j) => j !== i) }));

  const toggleVaccine = (item) =>
    setD((s) => {
      const cur = s.immunization[item.id];
      return { ...s, immunization: { ...s.immunization, [item.id]: cur?.given ? { ...cur, given: false } : { given: true, date: localISODate() } } };
    });
  const setVaccineDate = (idKey, date) => setD((s) => ({ ...s, immunization: { ...s.immunization, [idKey]: { ...s.immunization[idKey], given: true, date } } }));

  const catalogueDrugs = (settings.drugs || []).filter((x) => x.type !== "Vaccine" && x.form !== "Vaccine");

  const babies = d.delivery.babies || [];
  const fetusCount = Number(d.delivery.fetuses || 0);
  const setDelivery = (patch) => setD((s) => ({ ...s, delivery: { ...s.delivery, ...patch } }));
  const setFetuses = (v) => setD((s) => ({
    ...s,
    delivery: {
      ...s.delivery,
      fetuses: v,
      babies: syncBabiesToFetuses(s.delivery.babies, v, s.delivery.type || s.delivery.mode || ""),
    },
  }));
  const updBaby = (i, patch) => setD((s) => ({ ...s, delivery: { ...s.delivery, babies: s.delivery.babies.map((b, j) => (j === i ? { ...b, ...patch } : b)) } }));

  const doRegisterBaby = (i) => {
    const b = babies[i];
    if (b.registered) return toast.message("Baby already registered");
    if (/still birth|neonatal death/i.test(b.outcome || "")) return toast.error("Only live births can be registered as a patient");
    const name = babyName(p.name, i, babies.length);
    const rec = registerBaby(p.id, {
      name,
      sex: b.sex,
      dob: d.delivery.date || localISODate(),
      weight: b.weightKg ? Number(b.weightKg) : "",
      height: b.lengthCm ? Number(b.lengthCm) : "",
      deliveryDetails: { ...b, motherId: p.id, motherName: p.name, deliveryDate: d.delivery.date, mode: d.delivery.type, place: d.delivery.outcome },
    });
    updBaby(i, { registered: true, patientId: rec.id });
    toast.success(`${name} registered · ${rec.id}`);
  };

  const persist = (close) => {
    const episodeId =
      existing?.episodeId ||
      (() => {
        const openEp = patientEncs
          .filter((e) => e.disease === ANTENATAL_ID)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
        if (openEp && !isAncEpisodeClosed(openEp.outcome)) return openEp.episodeId;
        return newAncEpisodeId();
      })();
    const outcome = d.outcome?.status || "Active";
    saveEncounter({
      id: existing?.id,
      patientId: p.id,
      episodeId,
      disease: ANTENATAL_ID,
      facility,
      worker: user?.name,
      type: visitType,
      diagnosis: dating.finalGa ? `GA ${dating.finalGa.text} · ${trimesterLabel(dating.trimester)}` : "",
      treatment: (d.drugs || []).join(" + "),
      outcome,
      data: {
        ...d,
        history: { ...d.history, riskFactors: d.history.riskFactors || [], riskFactorsDismissed: d.history.riskFactorsDismissed || [] },
        caseDetails: { ...d.caseDetails, firstContact },
      },
    });
    setSavedAt(new Date().toLocaleTimeString());
    if (close) navigate(`/patients/${p.id}?tab=antenatal`);
    toast.success(online ? (close ? "ANC visit saved" : "Saved to device") : "Saved · queued until online");
  };

  const sections = [
    {
      n: 1, title: "Case details",
      done: !!d.caseDetails.lmp || !!dating.finalEdd || d.caseDetails.g != null,
      body: (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 font-head text-sm font-semibold text-primary">Obstetric</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="anc-gpla-fields">
                {[
                  { k: "g", long: "gravida", label: "Gravida (G)", testid: "anc-gravida" },
                  { k: "p", long: "para", label: "Para (P)", testid: "anc-para" },
                  { k: "l", long: "living", label: "Living (L)", testid: "anc-living" },
                  { k: "a", long: "abortions", label: "Abortions (A)", testid: "anc-abortions" },
                ].map((f) => (
                  <TextField
                    key={f.k}
                    label={f.label}
                    type="number"
                    min={0}
                    testid={f.testid}
                    value={d.caseDetails[f.k] ?? d.caseDetails[f.long] ?? ""}
                    onChange={(e) => {
                      const v = String(e.target.value || "").replace(/\D/g, "").slice(0, 2);
                      setCase({ [f.k]: v, [f.long]: v, gpla: "" });
                    }}
                    placeholder="0"
                  />
                ))}
              </div>
              <SelectField label="Neonatal death" options={COUNT_0_10} value={obstetricCountValue(d.caseDetails.neonatalDeath)} onChange={(v) => setCase({ neonatalDeath: v })} testid="anc-neonatal-death" />
              <SelectField label="Still birth" options={COUNT_0_10} value={obstetricCountValue(d.caseDetails.stillBirth)} onChange={(v) => setCase({ stillBirth: v })} testid="anc-still-birth" />
              <SelectField label="Term birth" options={COUNT_0_10} value={obstetricCountValue(d.caseDetails.termBirth)} onChange={(v) => setCase({ termBirth: v })} testid="anc-term-birth" />
              <TextField label="Living children" type="number" testid="anc-living-children" value={d.caseDetails.livingChildren || ""} onChange={(e) => setCase({ livingChildren: e.target.value })} />
              <TextField label="Age of last child" testid="anc-age-last-child" value={d.caseDetails.ageLastChild || ""} onChange={(e) => setCase({ ageLastChild: e.target.value })} placeholder="e.g. 2y" />
              <TextField
                label="Final EDD (clinician)"
                type="date"
                testid="anc-final-edd"
                value={d.caseDetails.finalEdd || ""}
                onChange={(e) => setCase({ finalEdd: e.target.value, finalSource: "Manual" })}
                hint={dating.finalGa ? `GA ${dating.finalGa.text} · ${trimesterLabel(dating.trimester)}` : "Clinician dating"}
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-head text-sm font-semibold text-primary">Menstrual</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <TextField label="Menstrual cycle length (days)" type="number" testid="anc-cycle-length" value={d.caseDetails.cycleLength || ""} onChange={(e) => setCase({ cycleLength: e.target.value })} />
              <TextField label="LMP" type="date" testid="anc-lmp" value={d.caseDetails.lmp || ""} onChange={(e) => setCase({ lmp: e.target.value })} />
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm font-semibold" data-testid="anc-lmp-confirmed">
                  <input type="checkbox" className="h-4 w-4" checked={!!d.caseDetails.lmpConfirmed} onChange={(e) => setCase({ lmpConfirmed: e.target.checked })} />
                  Is the LMP date confirmed?
                </label>
              </div>
            </div>
          </div>

          <ChoiceChips label="Was couple counselling done" options={YES_NO} value={d.caseDetails.coupleCounselling || ""} onChange={(v) => setCase({ coupleCounselling: v })} testid="anc-couple-counselling" />
        </div>
      ),
    },
    {
      n: 2, title: "History",
      done: (d.history.medical || []).length > 0 || Object.keys(d.history.menstrual || {}).length > 0,
      body: (
        <div className="space-y-3">
          <MultiChips label="Medical History" options={MEDICAL_HISTORY_OPTIONS} value={d.history.medical || []} onChange={(v) => setHist({ medical: v })} testid="anc-medical" />
          <div>
            <p className="mb-1.5 font-head text-sm font-semibold text-primary">Menstrual History</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextField label="LMP" type="date" testid="anc-hist-lmp" value={d.history.menstrual?.lmp || d.caseDetails.lmp || ""} onChange={(e) => setMenstrual({ lmp: e.target.value })} hint="Auto-filled from Case details" />
              <TextField label="Menarche (years)" type="number" testid="anc-menarche" value={d.history.menstrual?.menarche || ""} onChange={(e) => setMenstrual({ menarche: e.target.value })} />
              <ChoiceChips label="Amenorrhea" options={PRESENT_ABSENT} value={d.history.menstrual?.amenorrhea || ""} onChange={(v) => setMenstrual({ amenorrhea: v })} testid="anc-amenorrhea" />
              <ChoiceChips label="Intermenstrual Bleeding" options={PRESENT_ABSENT} value={d.history.menstrual?.imb || ""} onChange={(v) => setMenstrual({ imb: v })} testid="anc-imb" />
              <ChoiceChips label="Dysmenorrhea" options={DYSMENORRHEA} value={d.history.menstrual?.dysmenorrhea || ""} onChange={(v) => setMenstrual({ dysmenorrhea: v })} testid="anc-dysmenorrhea" />
              <ChoiceChips label="Menstrual Flow" options={MENSTRUAL_FLOW} value={d.history.menstrual?.flow || ""} onChange={(v) => setMenstrual({ flow: v })} testid="anc-flow" />
              <TextField label="Cycle Duration (Days)" type="number" testid="anc-cycle-duration" value={d.history.menstrual?.cycleDuration || ""} onChange={(e) => setMenstrual({ cycleDuration: e.target.value })} />
              <TextField label="Cycle Length (Days)" type="number" testid="anc-hist-cycle-length" value={d.history.menstrual?.cycleLength || d.caseDetails.cycleLength || ""} onChange={(e) => setMenstrual({ cycleLength: e.target.value })} />
              <ChoiceChips label="Menstrual cycles" options={CYCLE_REGULARITY} value={d.history.menstrual?.regularity || ""} onChange={(v) => setMenstrual({ regularity: v })} testid="anc-regularity" />
            </div>
          </div>
        </div>
      ),
    },
    {
      n: 3, title: "Risk factors",
      done: (d.history.riskFactors || []).length > 0,
      body: (
        <MultiChips
          label="Risk factors (auto from case/vitals + multi-select)"
          options={RISK_FACTOR_OPTIONS}
          value={d.history.riskFactors || []}
          onChange={setRiskFactors}
          autoOptions={autoSuggestedRisks}
          testid="anc-risk"
        />
      ),
    },
    {
      n: 4, title: "Mother vitals",
      done: Object.keys(d.vitals.mother).length > 0,
      body: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MOTHER_VITALS.map((f) => <SliderStat key={f.k} field={f} value={d.vitals.mother[f.k]} onChange={(v) => setMotherV(f.k, v)} testid={`anc-mv-${f.k}`} />)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {MOTHER_VITAL_CHOICES.map((c) => <ChoiceChips key={c.k} label={c.label} options={c.options} value={d.vitals.mother[c.k]} onChange={(v) => setMotherV(c.k, v)} testid={`anc-mv-${c.k}`} />)}
          </div>
        </div>
      ),
    },
    {
      n: 5, title: "Fetal vitals",
      done: Object.keys(d.vitals.fetal).length > 0,
      body: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FETAL_VITALS.map((f) => <SliderStat key={f.k} field={f} value={d.vitals.fetal[f.k]} onChange={(v) => setFetalV(f.k, v)} testid={`anc-fv-${f.k}`} />)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {FETAL_VITAL_CHOICES.map((c) => <ChoiceChips key={c.k} label={c.label} options={c.options} value={d.vitals.fetal[c.k]} onChange={(v) => setFetalV(c.k, v)} testid={`anc-fv-${c.k}`} />)}
          </div>
        </div>
      ),
    },
    {
      n: 6, title: "Laboratory",
      done: d.lab.some((x) => x.result || x.analyte || x.sentToLab),
      body: (
        <div className="space-y-4">
          <AlertPanel level="info" title="Bedside by default" testid="anc-lab-bedside-note">
            Orders are completed at the bedside by default.
            {facilityHasLab
              ? " This facility has a Lab — choose Lab location to send an order, then enter results when completed."
              : " This facility has no Lab location configured."}
          </AlertPanel>

          <div className="space-y-4" data-testid="anc-lab-list">
            {labGroups.map((testName) => {
              const def = ANC_LAB_TESTS.find((t) => t.name === testName);
              const entries = d.lab
                .map((row, i) => ({ row, i }))
                .filter(({ row }) => row.test === testName);
              const slug = testName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
              return (
                <div key={testName} className="rounded-md border border-border bg-white p-4" data-testid={`anc-lab-group-${slug}`}>
                  <p className="mb-3 font-semibold text-foreground">{testName}</p>
                  <div className="space-y-3">
                    {entries.map(({ row, i }, localIdx) => {
                      const isLabOrder = facilityHasLab && row.location === "Lab";
                      return (
                        <div key={i} className="rounded-md border border-border/70 bg-muted/10 p-3" data-testid={`anc-lab-row-${i}`}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-muted-foreground">Result {entries.length - localIdx}</p>
                            <ItemActions
                              onAdd={() => addLabForTest(testName, i)}
                              addTestid={`anc-lab-add-${slug}-${localIdx}`}
                              canRemove={entries.length > 1 || !labTestNames.includes(testName)}
                              onRemove={() => rmLab(i)}
                              removeTestid={`anc-lab-remove-${i}`}
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <SelectField
                              label="Result"
                              options={def?.results || ["Normal", "Abnormal", "Pending"]}
                              value={row.result}
                              onChange={(v) => updLab(i, { result: v, completed: !!v })}
                              testid={`anc-lab-result-${i}`}
                            />
                            <TextField
                              label="Analyte / value"
                              value={row.analyte || ""}
                              onChange={(e) => updLab(i, { analyte: e.target.value })}
                              testid={`anc-lab-analyte-${i}`}
                              placeholder="e.g. 11.2 g/dL"
                            />
                            <SelectField
                              label="Location"
                              options={facilityHasLab ? ["Bedside", "Lab"] : ["Bedside"]}
                              value={row.location || "Bedside"}
                              onChange={(v) => updLab(i, { location: v, sentToLab: v === "Lab" ? row.sentToLab : false })}
                              testid={`anc-lab-location-${i}`}
                            />
                            <TextField
                              label="Date"
                              type="date"
                              value={row.date}
                              onChange={(e) => updLab(i, { date: e.target.value })}
                              testid={`anc-lab-date-${i}`}
                            />
                          </div>
                          {isLabOrder && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                className="h-9"
                                data-testid={`anc-lab-send-${i}`}
                                onClick={() => { updLab(i, { sentToLab: true }); toast.success("Order sent to Lab"); }}
                                disabled={row.sentToLab}
                              >
                                {row.sentToLab ? "Order sent to Lab ✓" : "Send order to Lab"}
                              </Button>
                              {row.sentToLab && !row.result && (
                                <p className="text-xs text-muted-foreground">Add results when the test is completed.</p>
                              )}
                            </div>
                          )}
                          {localIdx === entries.length - 1 && (
                            <p className="mt-2 text-xs text-muted-foreground">Add another result to repeat this test</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-md border border-dashed border-border bg-white p-4" data-testid="anc-lab-other-wrap">
            <p className="mb-2 text-sm font-semibold">Other test</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1">
                <TextField
                  label="Search / type test name"
                  testid="anc-lab-other"
                  value={labOther}
                  onChange={(e) => setLabOther(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLabOther())}
                  placeholder="e.g. Blood group"
                />
              </div>
              <Button type="button" variant="outline" className="h-12" data-testid="anc-lab-other-add" onClick={addLabOther} disabled={!labOther.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </div>
      ),
    },
    {
      n: 7, title: "Radiology",
      done: d.radiology.length > 0,
      body: (
        <div className="space-y-3">
          <Button variant="outline" className="h-10" onClick={addRadiology} data-testid="anc-rad-add"><Plus className="mr-2 h-4 w-4" /> Add scan</Button>
          {d.radiology.map((row, i) => (
            <div key={i} className="rounded-md border border-border bg-white p-3" data-testid={`anc-rad-row-${i}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Scan {d.radiology.length - i}</p>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={() => rmRad(i)} data-testid={`anc-rad-remove-${i}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <SelectField label="Scan" options={RADIOLOGY_SCANS} value={row.scan} onChange={(v) => updRad(i, { scan: v })} testid={`anc-rad-scan-${i}`} />
                <TextField label="Scan Date" type="date" value={row.date} onChange={(e) => updRad(i, { date: e.target.value })} testid={`anc-rad-date-${i}`} />
                <TextField label="EDD" type="date" value={row.edd || ""} onChange={(e) => updRad(i, { edd: e.target.value })} testid={`anc-rad-edd-${i}`} hint="Feeds Case details scan dating" />
              </div>
              <AreaField label="Comments" rows={3} value={row.comments || row.findings || ""} onChange={(e) => updRad(i, { comments: e.target.value, findings: e.target.value })} testid={`anc-rad-comments-${i}`} />
            </div>
          ))}
        </div>
      ),
    },
    {
      n: 8, title: "Drugs",
      done: d.drugs.length > 0,
      body: (
        <AntenatalMedications
          drugs={d.drugs || []}
          posology={d.posology || {}}
          medCourses={d.medCourses || {}}
          catalogue={catalogueDrugs}
          onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
          banner={
            <AlertPanel level="info" title="Regimen by GA" testid="anc-drug-ga-note">
              GA-based regimen suggestions will be added later. Select standard drugs for now.
            </AlertPanel>
          }
        />
      ),
    },
    {
      n: 9, title: "Immunization",
      done: Object.values(d.immunization).some((x) => x?.given),
      body: (
        <div className="space-y-2" data-testid="anc-immunization">
          <ImmunizationEntryCards
            vaccines={ANC_IMMUNIZATION}
            records={d.immunization}
            getDue={(item) => immunizationDueDate(item, firstContact, d.caseDetails.lmp)}
            getOverdue={(item, rec) => isImmunizationOverdue(item, rec, firstContact, d.caseDetails.lmp)}
            onToggle={toggleVaccine}
            onSetDate={setVaccineDate}
            testidPrefix="anc-vac"
          />
          {vaccineDrugs.length > 0 && (
            <Field label="Add additional vaccine from drug list">
              <SelectField label="" options={vaccineDrugs.map((v) => v.name).filter((n) => !d.immunization[n])} value="" onChange={(n) => n && setVaccineDate(n, localISODate())} testid="anc-vac-add" placeholder="Choose a vaccine…" />
            </Field>
          )}
        </div>
      ),
    },
    {
      n: 10, title: "Visit notes",
      done: d.notes.some((n) => String(n).trim()),
      body: (
        <div className="space-y-3" data-testid="anc-notes">
          {d.notes.map((note, i) => (
            <div key={i} className="rounded-md border border-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Note {d.notes.length - i}</p>
                <ItemActions onAdd={addNote} addTestid={`anc-note-add-${i}`} canRemove={d.notes.length > 1} onRemove={() => rmNote(i)} removeTestid={`anc-note-remove-${i}`} />
              </div>
              <AreaField label="" rows={4} value={note} onChange={(e) => setNote(i, e.target.value)} testid={`anc-note-${i}`} />
            </div>
          ))}
        </div>
      ),
    },
    {
      n: 11, title: "Delivery details",
      done: !!d.delivery.date || !!d.delivery.type || !!d.delivery.outcome,
      body: (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Delivery date" type="date" value={d.delivery.date || ""} onChange={(e) => setDelivery({ date: e.target.value })} testid="anc-del-date" />
            <SelectField label="Delivery type" options={DELIVERY_TYPES} value={d.delivery.type || d.delivery.mode || ""} onChange={(v) => setDelivery({ type: v, mode: v })} testid="anc-del-type" />
          </div>
          <ChoiceChips label="Delivery complication(s)" options={DELIVERY_COMPLICATIONS} value={d.delivery.complication || ""} onChange={(v) => setDelivery({ complication: v })} testid="anc-del-complication" />
          <ChoiceChips label="No of Fetuses" options={FETUS_COUNTS} value={String(d.delivery.fetuses || "")} onChange={setFetuses} testid="anc-del-fetuses" />
          {fetusCount > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: fetusCount }, (_, i) => (
                <TextField key={i} label={`Total length of delivery — fetus ${i + 1}`} value={d.delivery.fetusLengths?.[i] || ""} onChange={(e) => setDelivery({ fetusLengths: { ...d.delivery.fetusLengths, [i]: e.target.value } })} testid={`anc-del-length-${i}`} placeholder="e.g. 8 hrs" />
              ))}
            </div>
          )}
          <ChoiceChips label="Family planning" options={FAMILY_PLANNING} value={d.delivery.familyPlanning || ""} onChange={(v) => setDelivery({ familyPlanning: v })} testid="anc-del-fp" />
          <MultiChips label="Postpartum complication(s)" options={POSTPARTUM_COMPLICATIONS} value={d.delivery.postpartum || []} onChange={(v) => setDelivery({ postpartum: v })} testid="anc-del-postpartum" />
          <ChoiceChips label="Delivery Outcome" options={DELIVERY_OUTCOMES} value={d.delivery.outcome || ""} onChange={(v) => setDelivery({ outcome: v })} testid="anc-del-outcome" />
        </div>
      ),
    },
    {
      n: 12, title: "New born details",
      done: babies.length > 0 && babies.some((b) => b.sex || b.weightKg || b.outcome || Object.values(b.physicalExam || {}).some(Boolean)),
      body: (
        <div className="space-y-4">
          <p className="font-head text-sm font-semibold text-primary">
            New born(s){babies.length > 0 ? ` · ${babies.length}` : ""}
          </p>
          {fetusCount === 0 && (
            <p className="text-sm text-muted-foreground">
              Set <span className="font-medium text-foreground">No of Fetuses</span> in Delivery details to show newborn forms.
            </p>
          )}
          {babies.map((b, i) => (
            <div key={i} className="rounded-md border border-border bg-white p-3 space-y-3" data-testid={`anc-baby-${i}`}>
              <p className="text-sm font-semibold">{babyName(p.name, i, babies.length)}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField label="Delivery type" options={DELIVERY_TYPES} value={b.deliveryType || d.delivery.type || ""} onChange={(v) => updBaby(i, { deliveryType: v })} testid={`anc-baby-deltype-${i}`} />
                <SelectField label="Sex" options={BABY_SEX} value={b.sex} onChange={(v) => updBaby(i, { sex: v })} testid={`anc-baby-sex-${i}`} />
                <TextField label="Birth Weight (kgs)" type="number" step="0.1" value={b.weightKg} onChange={(e) => updBaby(i, { weightKg: e.target.value })} testid={`anc-baby-weight-${i}`} />
                <TextField label="Birth Length (cms)" type="number" step="0.1" value={b.lengthCm} onChange={(e) => updBaby(i, { lengthCm: e.target.value })} testid={`anc-baby-length-${i}`} />
                <TextField label="Head Circumference (cms)" type="number" step="0.1" value={b.headCm || ""} onChange={(e) => updBaby(i, { headCm: e.target.value })} testid={`anc-baby-hc-${i}`} />
                <TextField label="APGAR 1 min" type="number" value={b.apgar1} onChange={(e) => updBaby(i, { apgar1: e.target.value })} testid={`anc-baby-apgar1-${i}`} />
                <TextField label="APGAR 5 min" type="number" value={b.apgar5} onChange={(e) => updBaby(i, { apgar5: e.target.value })} testid={`anc-baby-apgar5-${i}`} />
                <TextField label="APGAR 10 min" type="number" value={b.apgar10 || ""} onChange={(e) => updBaby(i, { apgar10: e.target.value })} testid={`anc-baby-apgar10-${i}`} />
              </div>
              <ChoiceChips label="Resuscitation" options={YES_NO} value={b.resuscitation || ""} onChange={(v) => updBaby(i, { resuscitation: v })} alertOptions={["Yes"]} testid={`anc-baby-resusc-${i}`} />
              <MultiChips label="Baby complications" options={BABY_COMPLICATIONS} value={b.complications || []} onChange={(v) => updBaby(i, { complications: v })} alertWhenSelected testid={`anc-baby-comp-${i}`} />
              <ChoiceChips label="Baby Outcome" options={BABY_OUTCOMES} value={b.outcome || ""} onChange={(v) => updBaby(i, { outcome: v })} alertOptions={BABY_OUTCOME_ALERTS} testid={`anc-baby-outcome-${i}`} />

              <div className="border-t border-border/60 pt-3" data-testid={`anc-baby-exam-${i}`}>
                <p className="mb-3 font-head text-sm font-semibold text-primary">Physical examination</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {PHYSICAL_EXAM_FIELDS.filter((f) => !f.sex || f.sex === b.sex).map((f) => (
                    <ChoiceChips
                      key={f.k}
                      label={f.label}
                      options={f.options}
                      value={(b.physicalExam || {})[f.k] || ""}
                      onChange={(v) => updBabyExam(i, f.k, v)}
                      alertOptions={f.alert || []}
                      testid={`anc-baby-${i}-pe-${f.k}`}
                    />
                  ))}
                  {!b.sex && (
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Select sex above to show male/female-specific exam fields.
                    </p>
                  )}
                </div>
                {PHYSICAL_EXAM_FIELDS.some((f) => (!f.sex || f.sex === b.sex) && (f.alert || []).includes((b.physicalExam || {})[f.k])) && (
                  <AlertPanel level="urgent" title="Concerning findings" testid={`anc-baby-exam-alert-${i}`}>
                    Negative / abnormal answers are highlighted in red. Review and manage as needed.
                  </AlertPanel>
                )}
              </div>

              <Button className="h-10" disabled={b.registered} onClick={() => doRegisterBaby(i)} data-testid={`anc-baby-register-${i}`}>
                {b.registered ? `Registered · ${b.patientId}` : "Register baby"}
              </Button>
            </div>
          ))}
        </div>
      ),
    },
    {
      n: 13, title: "Case outcome",
      done: !!d.outcome.status,
      body: (
        <div className="space-y-4">
          <ChoiceRow label="Case Outcome" options={ANC_OUTCOMES} value={d.outcome.status} onChange={(v) => setD((s) => ({ ...s, outcome: { ...s.outcome, status: v } }))} testid="anc-outcome" />
          {isAncEpisodeClosed(d.outcome.status) && <AlertPanel level="review" title="This closes the ANC episode" testid="anc-outcome-close">Saving with this outcome closes the episode.</AlertPanel>}
          {d.outcome.status === "Discharged" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField label="Province" options={Object.keys(GEO)} value={d.outcome.province || ""} onChange={(v) => setD((s) => ({ ...s, outcome: { ...s.outcome, province: v, district: "" } }))} testid="anc-outcome-province" />
              <SelectField label="District" options={Object.keys(GEO[d.outcome.province] || {})} value={d.outcome.district || ""} onChange={(v) => setD((s) => ({ ...s, outcome: { ...s.outcome, district: v } }))} testid="anc-outcome-district" />
              <TextField label="Facility" value={d.outcome.facility || ""} onChange={(e) => setD((s) => ({ ...s, outcome: { ...s.outcome, facility: e.target.value } }))} testid="anc-outcome-facility" />
            </div>
          )}
          <AreaField label="Outcome notes" rows={2} value={d.outcome.note || ""} onChange={(e) => setD((s) => ({ ...s, outcome: { ...s.outcome, note: e.target.value } }))} testid="anc-outcome-note" />
        </div>
      ),
    },
  ];

  const doneCount = sections.filter((s) => s.done).length;

  return (
    <AppShell>
      <div className="grid gap-6 pb-28 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <PatientSidebar patient={p} encounters={patientEncs} diseases={[{ id: ANTENATAL_ID, name: ANTENATAL_NAME }]} testid="anc-lhs-panel" />
        <div className="min-w-0 space-y-4">
          <div className="sticky top-[65px] z-30 -mx-1 flex flex-wrap items-center gap-3 bg-background px-1 py-3 lg:top-[69px]">
            <div className="min-w-0 flex-1">
              <p className="font-head text-xl font-bold tracking-tight sm:text-2xl">{ANTENATAL_NAME} visit</p>
              <p className="text-xs text-muted-foreground" data-testid="anc-context">{facility} · {visitType}{dating.finalGa ? ` · GA ${dating.finalGa.text}` : ""}</p>
            </div>
            <Button variant="outline" className="h-11 shrink-0" data-testid="anc-exit-btn" onClick={() => navigate(`/patients/${p.id}?tab=antenatal`)}><ArrowLeft className="mr-2 h-4 w-4" /> Exit to record</Button>
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Visit completeness</p>
              <span className="text-sm font-semibold" data-testid="anc-completeness">{doneCount} of {sections.length} sections captured</span>
            </div>
            <Progress value={(doneCount / sections.length) * 100} className="mt-3 h-2.5" />
          </div>

          {sections.map((s) => (
            <section key={s.n} className="rounded-lg border border-border bg-white" data-testid={`anc-section-${s.n}`}>
              <button type="button" data-testid={`anc-section-toggle-${s.n}`} onClick={() => setOpen((o) => ({ ...o, [s.n]: o[s.n] === false }))} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm font-bold ${s.done ? "bg-green-50 text-green-700" : "bg-secondary text-primary"}`}>{s.done ? <CircleCheck className="h-5 w-5" /> : s.n}</span>
                <span className="flex-1">
                  <span className="block font-head text-lg font-semibold tracking-tight">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{s.done ? "Captured" : "Not started"}</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open[s.n] !== false ? "rotate-180" : ""}`} />
              </button>
              {open[s.n] !== false && <div className="border-t border-border p-5">{s.body}</div>}
            </section>
          ))}
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-white lg:bottom-0">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <span className="hidden text-xs text-muted-foreground sm:block" data-testid="anc-saved-indicator">{savedAt ? `Last saved: ${savedAt}` : "Draft — not saved yet"}</span>
          <div className="ml-auto flex flex-1 gap-3 sm:flex-none">
            <Button variant="outline" className="h-12 flex-1 sm:flex-none sm:px-8" data-testid="anc-save-btn" onClick={() => persist(false)}><Save className="mr-2 h-4 w-4" /> Save</Button>
            <Button className="h-12 flex-1 text-base sm:flex-none sm:px-8" data-testid="anc-save-close-btn" onClick={() => persist(true)}><Check className="mr-2 h-4 w-4" /> Save &amp; close</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
