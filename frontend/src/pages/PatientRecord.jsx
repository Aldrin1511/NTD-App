import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertPanel, SelectField, TextField, ChoiceRow } from "@/components/Fields";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DISEASE_SPECS, assessmentSpecs, fmtDate, fmtDateTime, visitLabel, groupDiseaseEpisodes, leprosyScores, leprosyClass } from "@/mock/specs";
import { GEO } from "@/mock/data";
import { compactValue, sectionFingerprint } from "@/sectionDiff";
import { toast } from "sonner";
import { ArrowLeft, Plus, Phone, ChevronDown, ChevronLeft, ChevronRight, PanelLeft, Pencil, Printer } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import PatientSidebar from "@/components/PatientSidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SCABIES_DRUGS, ageInMonths } from "@/components/ScabiesMedications";
import { YAWS_DRUGS, azithromycinDose, benzathineDose } from "@/components/YawsMedications";
import { LF_DRUGS, ivermectinDose, albendazoleDose, decDose } from "@/components/LfMedications";
import { BURULI_DRUGS, rifampicinDose, clarithromycinDose } from "@/components/BuruliMedications";
import { LEPROSY_DRUGS, mdtBand, prednisoloneSchedule, mdtAdherenceConfig } from "@/components/LeprosyMedications";
import { formatDosePhysical, physicalUnits } from "@/lib/medications";
import { AdherenceGrid, HouseholdCountTable } from "@/components/FormRenderer";
import LeprosyHouseholdMonitoring from "@/components/LeprosyHouseholdMonitoring";
import { REACTION_COLS, REACTION_GRID } from "@/components/LeprosyReaction";

const FEATURES = [
  ["caseDetails", "Case details"], ["history", "Clinical history"], ["marks", "Examination"],
  ["lab", "Laboratory"], ["diagnosis", "Diagnosis"], ["drugs", "Medications"],
  ["adherence", "Medication Adherence"],
  ["household", "Household Contact Tracing"], ["reactions", "Lepra reactions"], ["notes", "Visit notes"], ["outcome", "Final case outcome"],
];

const EDITABLE_FEATURES = new Set(["marks", "lab", "drugs", "notes"]);

const featureSectionNumber = (key, diseaseId) => {
  if (key === "reactions") return 8;
  if (key === "notes") return diseaseId === "leprosy" ? 9 : 8;
  if (key === "outcome") return diseaseId === "leprosy" ? 10 : 9;
  return { caseDetails: 1, history: 2, marks: 3, lab: 4, diagnosis: 5, drugs: 6, adherence: 6, household: 7 }[key] || 1;
};

const isPastEditedSection = (visit, latestId, featureKey) =>
  !!(visit?.id && visit.id !== latestId && (visit.editedSections || []).includes(featureKey));

const EditedBadge = () => (
  <Badge variant="outline" className="rounded border-amber-300 bg-amber-50 text-amber-800" data-testid="edited-badge">
    Edited
  </Badge>
);

/** Keep a visit in a dashboard section only when that section’s data changed vs the previous visit. */
const rowsForChangedSection = (visits, key, spec, patient) => {
  const chronological = [...(visits || [])].sort((a, b) => {
    const byDate = String(a.date).localeCompare(String(b.date));
    return byDate || String(a.id).localeCompare(String(b.id));
  });
  const keep = new Set();
  let prev = "";
  chronological.forEach((e) => {
    const fp = sectionFingerprint(key, e);
    if (!fp || fp === prev) return;
    keep.add(e.id);
    prev = fp;
  });
  return (visits || [])
    .filter((e) => keep.has(e.id))
    .map((e) => ({ e, s: summarise(key, e, spec, patient) }))
    .filter((r) => r.s);
};

const examChipFingerprint = (exam) => JSON.stringify(compactValue({
  roundIndex: exam.roundIndex,
  findings: exam.findings,
  secondaryInfection: exam.secondaryInfection,
  extras: exam.extras,
  leprosy: exam.leprosy,
}));

const uniqueExamChips = (rows) => {
  const seen = new Set();
  const oldestFirst = [];
  [...rows].reverse().forEach((r) => {
    (r.s?.kind === "exam" ? r.s.exams : []).slice().reverse().forEach((exam) => {
      const fp = examChipFingerprint(exam);
      if (!fp || seen.has(fp)) return;
      seen.add(fp);
      oldestFirst.push(exam);
    });
  });
  return oldestFirst.reverse();
};

const hasValue = (v) => {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== "" && s !== "—" && s !== "Open";
};

/** Active/Open are episode defaults, not a recorded final case outcome. */
const isRecordedOutcome = (v) => {
  const s = String(v || "").trim();
  return s !== "" && s !== "—" && s !== "Open" && s !== "Active";
};

const episodeStatus = (outcome) => {
  const s = String(outcome || "").trim();
  if (!s || s === "Open") return "Active";
  return s;
};

const formatList = (v) => (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim()).filter(Boolean).join(", ");

const formatDuration = (v) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return "";
  const n = v.n == null || v.n === "" ? "" : String(v.n).trim();
  const unit = String(v.unit || "").trim();
  if (!n && !unit) return "";
  return [n, unit].filter(Boolean).join(" ");
};

const formatHistoryValue = (field, value) => {
  if (value == null || value === "") return "";
  if (field?.type === "note" || field?.type === "section") return "";
  if (field?.type === "duration") return formatDuration(value);
  if (field?.type === "lines" || field?.type === "checks") return formatList(value);
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return formatList(value);
  if (typeof value === "object" && ("n" in value || "unit" in value)) return formatDuration(value);
  return "";
};

const nestedHistoryItems = (fields, data) =>
  (fields || [])
    .map((field) => {
      const value = formatHistoryValue(field, data?.[field.k]);
      return value ? { label: field.label, value } : null;
    })
    .filter(Boolean);

const summariseHistory = (history, spec) => {
  if (!history || typeof history !== "object") return "";
  const fields = spec?.history || [];
  const sections = [];
  let current = { label: "", items: [] };

  const flush = () => {
    if (current.items.length) sections.push(current);
  };

  for (const field of fields) {
    if (field.type === "section") {
      flush();
      current = { label: field.label, items: [] };
      continue;
    }
    if (field.type === "note") continue;

    if (field.type === "perComplaint") {
      const map = history[field.k] || {};
      const selected = Object.keys(map).filter((c) => map[c] != null);
      if (!selected.length) continue;
      current.items.push({ label: field.label, value: selected.join(", ") });
      selected.forEach((complaint) => {
        const children = nestedHistoryItems(field.fields, map[complaint]);
        if (children.length) current.items.push({ label: complaint, children });
      });
      continue;
    }

    const value = formatHistoryValue(field, history[field.k]);
    if (value) current.items.push({ label: field.label, value });
  }
  flush();

  if (!sections.length) return "";
  return { kind: "history", sections };
};

const HistorySummary = ({ sections, testid = "history-summary" }) => (
  <div className="mt-2 space-y-3" data-testid={testid}>
    {sections.map((sec, si) => (
      <div key={`${sec.label || "history"}-${si}`} data-testid={`history-section-${si}`}>
        {sec.label && (
          <p className="text-sm font-semibold text-foreground">{sec.label}</p>
        )}
        <div className={`${sec.label ? "mt-1" : ""} space-y-1`}>
          {sec.items.map((item, i) => (
            <div key={`${item.label}-${i}`} className={item.children?.length ? "space-y-1 pt-1" : ""}>
              {item.value ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">{item.label}:</span>{" "}
                  <span className="font-medium">{item.value}</span>
                </p>
              ) : (
                <p className="text-sm font-semibold">{item.label}</p>
              )}
              {item.children?.length > 0 && (
                <div className="space-y-1 border-l border-border pl-3">
                  {item.children.map((child, j) => (
                    <p key={`${child.label}-${j}`} className="text-sm">
                      <span className="text-muted-foreground">{child.label}:</span>{" "}
                      <span className="font-medium">{child.value}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const SKIP_EXAM_EXTRA = new Set(["leprosyVmtChart", "leprosySensoryChart", "leprosyVisionChart", "patches", "nerves", "secondaryInfection"]);

const findingNameOf = (m, spec) => {
  const code = m.code;
  if (code && spec?.bodyChart?.codes) {
    const hit = spec.bodyChart.codes.find((c) => c[0] === code);
    if (hit?.[1]) return hit[1];
  }
  if (m.type) return m.type;
  if (m.code && m.label) return m.label;
  return "";
};

const bodyPartOf = (m) => m.region || (m.code ? "" : m.label) || "";

const groupExamFindings = (marks, spec) => {
  const order = (spec?.bodyChart?.codes || []).map((c) => c[1]);
  const groups = new Map();
  Object.values(marks || {}).forEach((m) => {
    const name = findingNameOf(m, spec);
    const part = bodyPartOf(m);
    if (!name && !part) return;
    const key = name || "Finding";
    const extra = m.extra && m.extra !== "None" ? m.extra : "";
    const loc = [part, extra].filter(Boolean).join(" · ");
    if (!groups.has(key)) groups.set(key, []);
    if (!groups.get(key).includes(loc)) groups.get(key).push(loc);
  });
  const names = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return names.map((name) => {
    const parts = groups.get(name).filter(Boolean);
    return parts.length ? `${name} (${parts.join(", ")})` : name;
  });
};

const formatExamExtraValue = (field, value) => {
  if (field.type === "repeatChoice") {
    const list = Array.isArray(value) ? value : value != null && value !== "" ? [value] : [];
    return list
      .map((item) => {
        if (item == null || item === "") return "";
        if (typeof item === "string") return item;
        const result = item.result || "";
        const date = item.date ? ` (${fmtDate(item.date)})` : "";
        return result ? `${result}${date}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }
  return formatHistoryValue(field, value);
};

const examExtras = (assessment, spec) =>
  (spec?.assessmentExtra || [])
    .filter((f) => !SKIP_EXAM_EXTRA.has(f.k) && !SKIP_EXAM_EXTRA.has(f.type))
    .map((f) => {
      const value = formatExamExtraValue(f, assessment?.[f.k]);
      return value ? { label: f.label, value } : null;
    })
    .filter(Boolean);

const examChipLabel = (exam) => {
  const base = `${fmtDate(exam.date)} · ${exam.type || "Examination"}`;
  return exam.roundCount > 1 ? `${base} · ${exam.roundIndex + 1}` : base;
};

const summariseExam = (e, spec) => {
  const x = e.data || {};
  const rounds = Array.isArray(x.examRounds) && x.examRounds.length
    ? x.examRounds
    : [{ marks: x.marks || {}, secondaryInfection: x.assessment?.secondaryInfection, assessment: x.assessment || {} }];

  const exams = rounds
    .map((round, i) => {
      const marks = round.marks || {};
      const assessment = { ...(x.assessment || {}), ...(round.assessment || {}) };
      const findings = groupExamFindings(marks, spec);
      const si = round.secondaryInfection || assessment.secondaryInfection || "";
      const extras = examExtras(assessment, spec);
      const hasLepCharts = spec?.id === "leprosy" && (assessment.vmtChart || assessment.sensoryChart || assessment.visionChart);
      if (!findings.length && !hasValue(si) && !extras.length && !Object.keys(marks).length && !hasLepCharts) return null;

      let leprosy = null;
      if (spec?.id === "leprosy") {
        const scores = leprosyScores({ ...assessment, marks });
        const cls = leprosyClass({ ...assessment, ...(x.lab || {}), marks });
        leprosy = {
          patches: cls.patches,
          nerves: cls.nerves,
          rightEye: scores.rightEye,
          leftEye: scores.leftEye,
          rightHand: scores.rightHand,
          leftHand: scores.leftHand,
          rightFoot: scores.rightFoot,
          leftFoot: scores.leftFoot,
          ehf: scores.ehf,
          g2d: scores.g2d,
        };
      }

      return {
        id: `${e.id}-${i}`,
        encounterId: e.id,
        editedAt: e.editedAt,
        date: e.date,
        type: e.type,
        worker: e.worker,
        roundIndex: i,
        roundCount: rounds.length,
        findings,
        secondaryInfection: hasValue(si) ? si : "",
        extras,
        leprosy,
      };
    })
    .filter(Boolean);

  if (!exams.length) return "";
  return { kind: "exam", exams: exams.slice().reverse() };
};

const ExamSummary = ({ exam }) => {
  if (!exam) return null;
  const lep = exam.leprosy;
  return (
    <div className="mt-2 space-y-1" data-testid="exam-summary">
      {exam.findings.length > 0 && (
        <p className="text-sm font-medium">{exam.findings.join(" · ")}</p>
      )}
      {exam.secondaryInfection && (
        <p className="text-sm">
          <span className="text-muted-foreground">Secondary infection:</span>{" "}
          <span className="font-medium">{exam.secondaryInfection}</span>
        </p>
      )}
      {exam.extras.map((item) => (
        <p key={item.label} className="text-sm">
          <span className="text-muted-foreground">{item.label}:</span>{" "}
          <span className="font-medium">{item.value}</span>
        </p>
      ))}
      {lep && (
        <div className="space-y-1 pt-1" data-testid="exam-leprosy-scores">
          <p className="text-sm">
            <span className="text-muted-foreground">Patches:</span>{" "}
            <span className="font-medium">{lep.patches}</span>
            {" · "}
            <span className="text-muted-foreground">Nerves affected:</span>{" "}
            <span className="font-medium">{lep.nerves}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">EHF score:</span>{" "}
            <span className="font-medium">
              Eyes {lep.rightEye}, {lep.leftEye} · Hands {lep.rightHand}, {lep.leftHand} · Feet {lep.rightFoot}, {lep.leftFoot}
            </span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Total EHF score:</span>{" "}
            <span className="font-medium">{lep.ehf} / 12</span>
            {" · "}
            <span className="text-muted-foreground">G2D:</span>{" "}
            <span className="font-medium">Grade {lep.g2d}</span>
          </p>
        </div>
      )}
    </div>
  );
};

const isNotDoneResult = (result) => {
  const r = String(result || "").trim();
  return !r || /^not done$/i.test(r);
};

const labEntries = (value) => {
  if (value == null || value === "") return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => {
    if (item == null || item === "") return { result: "", date: "" };
    if (typeof item === "string") return { result: item, date: "" };
    return { result: item.result || "", date: item.date || "" };
  });
};

const summariseLab = (lab, spec, encounterDate) => {
  const fields = spec?.lab || [];
  if (!fields.length) return "";
  const lines = [];
  let anyRecorded = false;

  for (const field of fields) {
    const entries = labEntries(lab?.[field.k]);
    const recorded = entries.filter((x) => String(x.result || "").trim());
    if (recorded.length) anyRecorded = true;
    const done = recorded.filter((x) => !isNotDoneResult(x.result));
    if (!done.length) {
      lines.push({ label: field.label, value: "Not done" });
      continue;
    }
    done.forEach((x) => {
      const date = x.date ? fmtDate(x.date) : encounterDate ? fmtDate(encounterDate) : "";
      lines.push({ label: field.label, value: date ? `${date} · ${x.result}` : x.result });
    });
  }

  if (!anyRecorded) return "";
  return { kind: "lab", lines };
};

const LabSummary = ({ lines }) => (
  <div className="mt-2 space-y-1" data-testid="lab-summary">
    {lines.map((item, i) => (
      <p key={`${item.label}-${i}`} className="text-sm">
        <span className="text-muted-foreground">{item.label}:</span>{" "}
        <span className="font-medium">{item.value}</span>
      </p>
    ))}
  </div>
);

const fmtMg = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return `${Number.isInteger(x) ? x : x.toFixed(1)} mg`;
};

const fmtTabs = (mg, tabs) => formatDosePhysical(mg, tabs);

const medicationRows = (e, spec, patient) => {
  const x = e.data || {};
  const date = fmtDate(x.treatmentDate || e.date);
  const weight = Number(x.caseDetails?.weight || patient?.weight || 0);
  const months = ageInMonths(patient || {});
  const years = months != null ? months / 12 : Number(patient?.age);
  const disease = spec?.id || e.disease;
  const topical = x.topical || [];
  const oral = x.oral || [];
  const used = new Set();
  const rows = [];

  const add = (row, names = [], courseKey) => {
    (names.length ? names : [row.name]).forEach((n) => used.add(n));
    const key = courseKey || row.name;
    const list = Array.isArray(x.medCourses?.[key]) ? x.medCourses[key] : [];
    const stamps = list.some((c) => c?.date)
      ? list.map((c) => (c?.date ? fmtDate(c.date) : date || "—"))
      : [row.date || date || "—"];
    stamps.forEach((stamp, i) => {
      rows.push({
        name: stamps.length > 1 ? `${row.name} (${i + 1})` : row.name,
        dosage: row.dosage || "—",
        date: stamp,
        frequency: row.frequency || "—",
        duration: row.duration || "—",
        advice: row.advice || "",
      });
    });
  };

  if (disease === "scabies") {
    const has = (name, pattern) => topical.includes(name) || oral.includes(name) || [...topical, ...oral].some((x) => pattern.test(String(x)));
    const consume = (name, pattern) => {
      used.add(name);
      [...topical, ...oral].forEach((x) => { if (x === name || pattern.test(String(x))) used.add(x); });
    };
    if (has(SCABIES_DRUGS.permethrin, /permethrin/i)) {
      add({
        name: SCABIES_DRUGS.permethrin,
        dosage: "Apply to body below the neck",
        frequency: "Once at night",
        duration: "Overnight; repeat in 7 days if needed",
        advice: "Apply at night all over the body below the neck and leave it on all night and wash off in the morning. Repeat application 7 days later if still has symptoms. Wash bedding and dry in the sunlight.",
      });
      consume(SCABIES_DRUGS.permethrin, /permethrin/i);
    }
    if (topical.includes(SCABIES_DRUGS.benzyl)) {
      let dosage = "Apply";
      let frequency = "Once";
      let duration = "12 hours contact";
      if (months != null) {
        if (months < 24) {
          dosage = "Dilute 1:3 (10 ml + 30 ml water)";
          duration = "12 hours contact";
        } else if (months < 144) {
          dosage = "Dilute 1:1 (25 ml + 25 ml water)";
          frequency = "Twice";
          duration = "24 hours apart";
        } else {
          dosage = "Undiluted";
          duration = "12 hours contact";
        }
      }
      add({
        name: SCABIES_DRUGS.benzyl,
        dosage,
        frequency,
        duration,
        advice: "Do not apply to broken skin, the face or mucous membranes. May cause: burning sensation; contact dermatitis with repeated application; seizures if marked transcutaneous absorption; rarely hypersensitivity reactions. Avoid contact with eyes. If accidental contact, flush immediately with plenty of water.",
      }, [SCABIES_DRUGS.benzyl]);
    }
    if (topical.includes(SCABIES_DRUGS.sulphur)) {
      add({
        name: SCABIES_DRUGS.sulphur,
        dosage: x.sulphurStrength || "5%",
        frequency: "Every night",
        duration: "3–5 consecutive nights",
        advice: "Apply to the child’s entire body every night for 3 to 5 consecutive nights. Leave on for 24 hours before a brief wash and reapplication, or wash off in the morning depending on the protocol prescribed.",
      }, [SCABIES_DRUGS.sulphur]);
    }
    if (oral.includes(SCABIES_DRUGS.ivermectin)) {
      const tabletMg = Number(x.ivermectinTabletMg) || 3;
      const dose = ivermectinDose(weight, tabletMg);
      add({
        name: SCABIES_DRUGS.ivermectin,
        dosage: dose ? fmtTabs(dose.mg, dose.tabs, dose.tabletMg) : "0.2 mg/kg",
        frequency: "Once",
        duration: "2 doses (today + after 2 weeks)",
        advice: "Oral ivermectin is indicated in topical failure, inability to comply with topical therapy, non-adherence, institutional outbreaks, mass treatment, and crusted scabies. Personal hygiene and washing linens. Itching can continue for 2 to 4 weeks after mites are dead (allergic reaction to mite remnants).",
      }, [SCABIES_DRUGS.ivermectin]);
    }
  }

  if (disease === "yaws") {
    if (oral.includes(YAWS_DRUGS.azithromycin)) {
      const dose = azithromycinDose({ weight, years });
      const tablet = Number(x.azithromycinTabletMg) || 500;
      add({
        name: YAWS_DRUGS.azithromycin,
        dosage: dose ? fmtTabs(dose.mg, physicalUnits(dose.mg, tablet)) : "30 mg/kg",
        frequency: "Once",
        duration: "Single dose",
      }, [YAWS_DRUGS.azithromycin]);
    }
    if (oral.includes(YAWS_DRUGS.benzathine)) {
      const dose = benzathineDose({ weight, years });
      add({
        name: YAWS_DRUGS.benzathine,
        dosage: dose?.mls != null ? `${dose.mls} ml IMI` : "IMI",
        frequency: "Once",
        duration: "Single dose",
        advice: "Intramuscular injection (IMI) after reconstitution as above.",
      }, [YAWS_DRUGS.benzathine]);
    }
  }

  if (disease === "lf") {
    if (oral.includes(LF_DRUGS.ivermectin)) {
      const tabletMg = Number(x.ivermectinTabletMg) || 3;
      const dose = ivermectinDose(weight, tabletMg);
      add({
        name: LF_DRUGS.ivermectin,
        dosage: dose ? fmtTabs(dose.mg, dose.tabs, dose.tabletMg) : "0.2 mg/kg",
        frequency: "Once",
        duration: "Single dose (IDA)",
      }, [LF_DRUGS.ivermectin]);
    }
    if (oral.includes(LF_DRUGS.albendazole)) {
      const dose = albendazoleDose(years);
      add({
        name: LF_DRUGS.albendazole,
        dosage: dose ? fmtTabs(dose.mg, dose.tabs, 200) : "200 mg (<10y) / 400 mg (10y+)",
        frequency: "Once",
        duration: "Single dose (IDA)",
      }, [LF_DRUGS.albendazole]);
    }
    if (oral.includes(LF_DRUGS.dec)) {
      const dose = decDose(weight, 100);
      add({
        name: LF_DRUGS.dec,
        dosage: dose ? fmtTabs(dose.mg, dose.tabs, dose.tabletMg) : "6 mg/kg",
        frequency: "Once",
        duration: "Single dose (IDA)",
      }, [LF_DRUGS.dec]);
    }
    if (oral.includes(LF_DRUGS.doxycycline)) {
      add({
        name: LF_DRUGS.doxycycline,
        dosage: "100 mg",
        frequency: "As prescribed",
        duration: "—",
      }, [LF_DRUGS.doxycycline]);
    }
    if (topical.includes(LF_DRUGS.dressing)) {
      add({ name: LF_DRUGS.dressing, dosage: "Apply", frequency: "As needed", duration: "—" }, [LF_DRUGS.dressing]);
    }
    if (topical.includes(LF_DRUGS.selfCare)) {
      add({ name: LF_DRUGS.selfCare, dosage: "—", frequency: "Daily self-care", duration: "—" }, [LF_DRUGS.selfCare]);
    }
  }

  if (disease === "buruli") {
    if (oral.includes(BURULI_DRUGS.rifampicin)) {
      const tabletMg = Number(x.rifampicinTabletMg) || 300;
      const dose = rifampicinDose(weight, tabletMg);
      add({
        name: BURULI_DRUGS.rifampicin,
        dosage: dose ? fmtTabs(dose.mg, dose.tabs, dose.tabletMg) : "10 mg/kg",
        frequency: "Once daily",
        duration: "8 weeks",
      }, [BURULI_DRUGS.rifampicin]);
    }
    if (oral.includes(BURULI_DRUGS.clarithromycin)) {
      const tabletMg = Number(x.clarithromycinTabletMg) || 500;
      const dose = clarithromycinDose(weight, tabletMg);
      add({
        name: BURULI_DRUGS.clarithromycin,
        dosage: dose ? `${fmtTabs(dose.mg, dose.tabs, dose.tabletMg)} per dose` : "7.5 mg/kg",
        frequency: "Twice daily",
        duration: "8 weeks",
      }, [BURULI_DRUGS.clarithromycin]);
    }
  }

  if (disease === "leprosy") {
    if (oral.includes(LEPROSY_DRUGS.mdt)) {
      const band = mdtBand({ years, weight });
      const cfg = mdtAdherenceConfig(x.diagnosis || e.diagnosis);
      const duration = cfg.regimen === "PB" ? "6 months" : cfg.regimen === "MB" ? "12 months" : "—";
      if (band?.items?.length) {
        band.items.forEach((item) => {
          let dosage = item.detail;
          if (item.tabs != null && item.tabletMg != null) dosage = fmtTabs(item.mg, item.tabs, item.tabletMg) || item.detail;
          else if (item.mgPerKg && weight) dosage = fmtMg(weight * item.mgPerKg) || item.detail;
          const frequency = item.frequency === "monthly" ? "Once a month" : item.frequency === "daily" ? "Daily" : item.detail;
          add({
            name: item.drug,
            dosage,
            frequency,
            duration,
          }, [LEPROSY_DRUGS.mdt], LEPROSY_DRUGS.mdt);
        });
      } else {
        add({ name: LEPROSY_DRUGS.mdt, dosage: "Blister pack", frequency: "—", duration }, [LEPROSY_DRUGS.mdt]);
      }
    }
    if (oral.includes(LEPROSY_DRUGS.prednisolone)) {
      const sch = prednisoloneSchedule();
      add({
        name: LEPROSY_DRUGS.prednisolone,
        dosage: `${sch.totalTabs} × 5 mg tablets (taper)`,
        frequency: "Taper",
        duration: "12 weeks",
      }, [LEPROSY_DRUGS.prednisolone]);
    }
  }

  (x.topicalAntibiotics || []).forEach((n) => add({ name: n, dosage: "Topical", frequency: "As prescribed", duration: "—" }));
  (x.oralAntibiotics || []).forEach((n) => add({ name: n, dosage: "Oral", frequency: "As prescribed", duration: "—" }));

  [...topical, ...oral].forEach((name) => {
    if (!name || used.has(name)) return;
    const def = (spec?.drugs?.oral || []).find((o) => o.name === name);
    let dosage = "—";
    let frequency = "—";
    let duration = def?.schedule || "—";
    if (def?.mgPerKg && weight) {
      const mg = weight * def.mgPerKg;
      dosage = def.tablet ? fmtTabs(mg, Math.round((mg / def.tablet) * 2) / 2, def.tablet) : fmtMg(mg);
    } else if (def?.fixed) dosage = def.fixed;
    if (/BID/i.test(String(def?.schedule))) frequency = "Twice daily";
    else if (/\bOD\b/i.test(String(def?.schedule))) frequency = "Once daily";
    add({ name, dosage, frequency, duration });
  });

  return rows;
};

const summariseMedications = (e, spec, patient) => {
  const rows = medicationRows(e, spec, patient);
  if (!rows.length) return "";
  return { kind: "meds", rows };
};

const summariseAdherence = (e, spec) => {
  if (!spec?.adherence) return "";
  const x = e.data || {};
  const value = x.adherence && typeof x.adherence === "object" && !Array.isArray(x.adherence) ? x.adherence : {};
  return {
    kind: "adherence",
    value,
    spec,
    diagnosis: x.diagnosis || e.diagnosis,
    startDate: x.caseDetails?.treatmentStart || value.lines?.[value.lines.length - 1]?.startDate || x.treatmentDate,
  };
};

const AdherenceSummary = ({ value, spec, diagnosis, startDate }) => (
  <div className="mt-2" data-testid="adherence-summary">
    <AdherenceGrid
      spec={spec}
      value={value}
      onChange={() => {}}
      startDate={startDate}
      diagnosis={diagnosis}
      readOnly
    />
  </div>
);

const householdHasCounts = (hh, questions) =>
  (questions || []).some((q) => {
    const v = hh?.[q.k];
    if (!v || typeof v !== "object") return false;
    return Object.values(v).some((n) => n !== "" && n != null);
  });

const summariseHousehold = (e, spec) => {
  const hh = e.data?.household || {};
  const fields = spec?.household || [];
  if (fields.some((f) => f.type === "leprosyHousehold")) {
    const contacts = Array.isArray(hh.contacts) ? hh.contacts : Array.isArray(hh) ? hh : [];
    if (!contacts.length) return "";
    return { kind: "hh-leprosy", contacts };
  }
  const questions = fields.filter((f) => f.type === "groupCount");
  if (!questions.length || !householdHasCounts(hh, questions)) return "";
  return { kind: "hh-counts", questions, data: hh };
};

const HouseholdSummary = ({ s }) => {
  if (s.kind === "hh-leprosy") {
    return (
      <div className="mt-2" data-testid="household-leprosy-summary">
        <LeprosyHouseholdMonitoring value={s.contacts} onChange={() => {}} viewOnly id="hh-dashboard" />
      </div>
    );
  }
  return (
    <div className="mt-2" data-testid="household-count-summary">
      <HouseholdCountTable questions={s.questions} data={s.data} readOnly prefix="hh-dashboard" />
    </div>
  );
};

const formatReactionOnset = (r) => {
  const date = r.onsetDate ? fmtDate(r.onsetDate) : "";
  const dur = [
    r.onsetDays !== "" && r.onsetDays != null ? `${r.onsetDays} day(s)` : "",
    r.onsetMonths !== "" && r.onsetMonths != null ? `${r.onsetMonths} month(s)` : "",
    r.onsetYears !== "" && r.onsetYears != null ? `${r.onsetYears} year(s)` : "",
  ].filter(Boolean).join(" ");
  return [date, dur].filter(Boolean).join(" · ");
};

const summariseReactions = (e) => {
  const list = Array.isArray(e.data?.reactions) ? e.data.reactions : [];
  if (!list.length) return "";
  const assessments = list.map((r) => {
    const details = [];
    if (hasValue(r.occurred)) details.push({ label: "Reaction occurred", value: r.occurred });
    if (r.diagnosisDate) details.push({ label: "Date of diagnosis", value: fmtDate(r.diagnosisDate) });
    const onset = formatReactionOnset(r);
    if (onset) details.push({ label: "Reaction onset", value: onset });

    const sections = [];
    if (details.length) sections.push({ label: "", items: details });

    REACTION_GRID.forEach((row) => {
      const items = [];
      REACTION_COLS.forEach(({ key, label }) => {
        const selected = (r.selections?.[row.category]?.[key] || []).map((x) => String(x || "").trim()).filter(Boolean);
        if (selected.length) items.push({ label, value: selected.join(", ") });
      });
      if (items.length) sections.push({ label: row.category, items });
    });

    const chartItems = [];
    const st = Object.keys(r.sensory?.points || {}).length;
    const vmt = Object.keys(r.vmt?.points || {}).length;
    const va = Object.keys(r.vision?.points || {}).length;
    if (st) chartItems.push({ label: "Sensory testing", value: `${st} mark(s)` });
    if (vmt) chartItems.push({ label: "Voluntary muscle test", value: `${vmt} mark(s)` });
    if (va) chartItems.push({ label: "Vision acuity", value: `${va} mark(s)` });
    if (chartItems.length) sections.push({ label: "Charts", items: chartItems });

    if (hasValue(r.notes)) sections.push({ label: "", items: [{ label: "Notes", value: String(r.notes).trim() }] });

    return {
      type: hasValue(r.reactionType) ? r.reactionType : "Reaction assessment",
      sections,
    };
  });
  return { kind: "reactions", assessments };
};

const ReactionSummary = ({ assessments }) => (
  <div className="mt-2 space-y-4" data-testid="reaction-summary">
    {assessments.map((a, i) => (
      <div key={`${a.type}-${i}`} data-testid={`reaction-assessment-${i}`}>
        <p className="text-sm font-semibold text-foreground">{a.type}</p>
        <HistorySummary sections={a.sections} testid={`reaction-sections-${i}`} />
      </div>
    ))}
  </div>
);

const summariseOutcome = (e) => {
  const x = e.data || {};
  const raw = x.outcome || e.outcome || "";
  const outcome = isRecordedOutcome(raw) ? raw : "";
  const recommendations = (x.recommendations || []).map((r) => String(r || "").trim()).filter(Boolean);
  if (!outcome && !recommendations.length) return "";
  return { kind: "outcome", outcome, recommendations };
};

const OutcomeSummary = ({ outcome, recommendations = [] }) => (
  <div className="mt-2 space-y-1" data-testid="outcome-summary">
    {outcome ? (
      <p className="text-sm">
        <span className="text-muted-foreground">Outcome:</span>{" "}
        <span className="font-medium">{outcome}</span>
      </p>
    ) : null}
    {recommendations.length > 0 && (
      <p className="text-sm">
        <span className="text-muted-foreground">Recommendation:</span>{" "}
        <span className="font-medium">{recommendations.join(" · ")}</span>
      </p>
    )}
  </div>
);

const MedsSummary = ({ rows }) => {
  const printMeds = () => {
    const node = document.querySelector("[data-testid='meds-print-area']");
    if (!node) return;
    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Medications</title>
      <style>
        body { font-family: sans-serif; padding: 24px; color: #111; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d4d4d4; padding: 8px; text-align: left; vertical-align: top; }
        th { font-size: 12px; color: #555; }
        .advice { font-size: 12px; color: #333; }
      </style></head><body>${node.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };
  return (
    <div className="mt-2" data-testid="meds-summary">
      {/* <div className="mb-2 flex justify-end">
        <Button type="button" variant="outline" className="h-9" data-testid="print-meds-btn" onClick={printMeds}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div> */}
      <div className="overflow-x-auto" data-testid="meds-print-area">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Name</th>
              <th className="py-2 pr-3 font-semibold">Dosage</th>
              <th className="py-2 pr-3 font-semibold">Date</th>
              <th className="py-2 pr-3 font-semibold">Frequency</th>
              <th className="py-2 font-semibold">Duration</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <Fragment key={`${row.name}-${i}`}>
                <tr className="border-b border-border/70 align-top">
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  <td className="py-2 pr-3">{row.dosage}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{row.date}</td>
                  <td className="py-2 pr-3">{row.frequency}</td>
                  <td className="py-2">{row.duration}</td>
                </tr>
                {row.advice ? (
                  <tr className="border-b border-border">
                    <td colSpan={5} className="advice pb-2 pt-0 text-xs text-muted-foreground">
                      <span className="font-semibold">Advice:</span> {row.advice}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const summarise = (key, e, spec, patient) => {
  const x = e.data || {};
  if (key === "caseDetails") return [x.caseDetails?.mode, x.caseDetails?.caseType, x.caseDetails?.weight && `${x.caseDetails.weight} kg`].filter(Boolean).join(" · ");
  if (key === "history") return summariseHistory(x.history || {}, spec || DISEASE_SPECS[e.disease]);
  if (key === "marks") return summariseExam(e, spec || DISEASE_SPECS[e.disease]);
  if (key === "lab") return summariseLab(x.lab || {}, spec || DISEASE_SPECS[e.disease], e.date);
  if (key === "diagnosis") {
    const dx = x.diagnosis || e.diagnosis;
    return hasValue(dx) ? dx : "";
  }
  if (key === "drugs") return summariseMedications(e, spec || DISEASE_SPECS[e.disease], patient);
  if (key === "adherence") return summariseAdherence(e, spec || DISEASE_SPECS[e.disease]);
  if (key === "household") return summariseHousehold(e, spec || DISEASE_SPECS[e.disease]);
  if (key === "reactions") return summariseReactions(e);
  if (key === "notes") {
    const lines = Array.isArray(x.notes)
      ? x.notes.map((n) => String(n || "").trim()).filter(Boolean)
      : String(x.notes || "").trim()
        ? [String(x.notes).trim()]
        : [];
    if (!lines.length) return "";
    return { kind: "notes", lines };
  }
  if (key === "outcome") return summariseOutcome(e);
  return "";
};

const NotesSummary = ({ lines }) => (
  <div className="mt-1 space-y-1" data-testid="notes-summary">
    {lines.map((line, i) => (
      <p key={i} className="whitespace-pre-line text-sm font-medium">{line}</p>
    ))}
  </div>
);

const episodeNumber = (episodes, epId) =>
  [...(episodes || [])].sort((a, b) => String(a.start).localeCompare(String(b.start))).findIndex((e) => e.id === epId) + 1;

const UnfoldMoreIcon = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z" />
  </svg>
);

const UnfoldLessIcon = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m7.41 18.59 1.42 1.41L12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zm9.18-13.18L15.17 4 12 7.17 8.83 4 7.41 5.41 12 10l4.59-4.59z" />
  </svg>
);

export default function PatientRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { patients, encounters, user, suspects, facilities, settings } = useStore();
  const p = patients.find((x) => x.id === id);
  const [tab, setTab] = useState("suspect");
  const [lhs, setLhs] = useState(true);
  const [featureOpen, setFeatureOpen] = useState(() => Object.fromEntries(FEATURES.map(([k]) => [k, true])));
  const [enc, setEnc] = useState({ show: false, facility: "", date: new Date().toISOString().slice(0, 10), visitType: "", referral: "No", disease: "", province: "", district: "" });
  const [photoView, setPhotoView] = useState(null);
  const [episodeSel, setEpisodeSel] = useState({});
  const [examSel, setExamSel] = useState({});
  const canEdit = user?.canEdit;
  const photoCount = photoView?.photos?.length || 0;
  const photoIndex = photoView?.index ?? 0;
  const photoSrc = photoCount ? photoView.photos[photoIndex] : null;
  const stepPhoto = (dir) =>
    setPhotoView((v) => {
      if (!v?.photos?.length) return v;
      const n = v.photos.length;
      return { ...v, index: (v.index + dir + n) % n };
    });

  const encs = useMemo(() => encounters.filter((e) => e.patientId === id).sort((a, b) => b.date.localeCompare(a.date)), [encounters, id]);
  const mySuspects = useMemo(() => suspects.filter((s) => s.patientId === id).sort((a, b) => b.date.localeCompare(a.date)), [suspects, id]);
  const myDiseases = useMemo(() => assessmentSpecs(id, { suspects: mySuspects, encounters: encs }), [id, mySuspects, encs]);
  const episodesByDisease = useMemo(() => {
    const map = {};
    for (const d of myDiseases) map[d.id] = groupDiseaseEpisodes(encs, d.id, p?.episodeId);
    return map;
  }, [encs, myDiseases, p?.episodeId]);
  useEffect(() => {
    if (tab !== "suspect" && !myDiseases.some((d) => d.id === tab)) setTab("suspect");
  }, [tab, myDiseases]);

  const selectedEpisode = (episodesByDisease[tab] || []).find((e) => e.id === episodeSel[tab]) || (episodesByDisease[tab] || [])[0];
  const featureRows = useMemo(() => {
    if (!myDiseases.some((x) => x.id === tab)) return [];
    const visits = selectedEpisode?.visits || [];
    const spec = DISEASE_SPECS[tab];
    return FEATURES.map(([k, label]) => ({
      k,
      label,
      rows: rowsForChangedSection(visits, k, spec, p),
    })).filter((f) => f.rows.length);
  }, [tab, selectedEpisode, myDiseases, p]);

  if (!p) return <AppShell title="Patient not found"><Button className="h-12" onClick={() => navigate("/patients")}>Back to patients</Button></AppShell>;

  const start = () => {
    if (enc.referral === "Yes" && (!enc.province || !enc.district)) return toast.error("Choose province and district for the referral");
    if (!enc.facility || !enc.visitType) return toast.error("Choose location and visit type");
    const q = `fac=${encodeURIComponent(enc.facility)}&vt=${encodeURIComponent(enc.visitType)}&ref=${enc.referral}`;
    setEnc({ ...enc, show: false });
    navigate(enc.disease ? `/patients/${p.id}/encounter/${enc.disease}?${q}` : `/patients/${p.id}/suspect?${q}`);
  };

  const latestVisitId = selectedEpisode?.visits?.[0]?.id;
  const openFeatureEncounter = (visit, featureKey) => {
    if (!canEdit) return;
    const target = visit || selectedEpisode?.visits?.[0];
    if (!target) {
      setEnc((s) => ({ ...s, show: true, disease: tab !== "suspect" && DISEASE_SPECS[tab] ? tab : s.disease }));
      return;
    }
    const disease = target.disease || tab;
    const section = featureSectionNumber(featureKey, disease);
    navigate(`/patients/${p.id}/encounter/${disease}?enc=${encodeURIComponent(target.id)}&section=${section}`);
  };

  const tabs = [["suspect", "Suspect"], ...myDiseases.map((d) => [d.id, d.name])];
  const allExpanded = featureRows.length > 0 && featureRows.every((f) => featureOpen[f.k] !== false);
  const referralDistricts = enc.province ? Object.keys(GEO[enc.province] || {}) : [];
  const locationOptions = facilities
    .filter((f) => {
      if (enc.referral !== "Yes") return true;
      if (!enc.province) return false;
      if (f.province !== enc.province) return false;
      if (enc.district && f.district !== enc.district) return false;
      return true;
    })
    .map((f) => f.name);

  const actions = (
    <div className="flex shrink-0 flex-wrap justify-end gap-2" data-testid="record-actions">
      <Button className="h-11" data-testid="add-encounter-btn" disabled={!canEdit} onClick={() => setEnc({ ...enc, show: true, disease: tab !== "suspect" && DISEASE_SPECS[tab] ? tab : "" })}>
        <Plus className="h-4 w-4" /> Encounter
      </Button>
      {p.phone && (
        <>
          <a
            href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noreferrer"
            data-testid="record-whatsapp-btn"
            aria-label="WhatsApp"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-green-700 hover:bg-green-50"
          >
            <WhatsAppIcon className="h-4 w-4" />
          </a>
          <a
            href={`tel:${p.phone.replace(/\s/g, "")}`}
            data-testid="record-call-btn"
            aria-label="Call"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-primary hover:bg-secondary"
          >
            <Phone className="h-4 w-4" />
          </a>
        </>
      )}
      {featureRows.length > 0 && (
        <button
          type="button"
          data-testid="toggle-all-features-btn"
          aria-label={allExpanded ? "Unfold less" : "Unfold more"}
          title={allExpanded ? "Collapse all" : "Expand all"}
          onClick={() =>
            setFeatureOpen((prev) => ({
              ...prev,
              ...Object.fromEntries(featureRows.map((f) => [f.k, !allExpanded])),
            }))
          }
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-primary hover:bg-secondary"
        >
          {allExpanded ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
        </button>
      )}
      <Button variant="outline" className="h-11" data-testid="back-btn" onClick={() => navigate("/patients")}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
    </div>
  );

  return (
    <AppShell>
      <div className={`grid gap-6 ${lhs ? "lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
        {lhs && (
          <PatientSidebar
            patient={p}
            encounters={encs}
            diseases={myDiseases}
            onCollapse={() => setLhs(false)}
            testid="lhs-panel"
          />
        )}

        <div className="min-w-0">
          <div className="sticky top-[65px] z-30 -mx-1 mb-4 flex flex-wrap items-center gap-3 bg-background px-1 py-3 lg:top-[69px]">
            {!lhs && (
              <>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" data-testid="lhs-expand-btn" onClick={() => setLhs(true)}>
                  <PanelLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 shrink-0 leading-tight" data-testid="collapsed-patient-id">
                  <p className="font-head truncate text-base font-bold">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.id}</p>
                </div>
              </>
            )}
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto" data-testid="record-tabs">
              {tabs.map(([k, label]) => {
                if (k === "suspect") {
                  return (
                    <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
                      className={`h-11 shrink-0 rounded-md border px-4 text-sm font-semibold ${tab === k ? "border-primary bg-primary text-white" : "border-border bg-white text-muted-foreground hover:bg-muted"}`}>{label}</button>
                  );
                }
                const episodes = episodesByDisease[k] || [];
                const current = episodes.find((e) => e.id === episodeSel[k]) || episodes[0];
                const visits = current ? visitLabel(current.visitCount) : "";
                const active = tab === k;
                const tabCls = `h-11 shrink-0 rounded-md border text-sm font-semibold ${active ? "border-primary bg-primary text-white" : "border-border bg-white text-muted-foreground hover:bg-muted"}`;
                if (episodes.length > 1) {
                  return (
                    <div key={k} className="flex shrink-0">
                      <button
                        type="button"
                        data-testid={`tab-${k}`}
                        onClick={() => setTab(k)}
                        className={`${tabCls} rounded-r-none border-r-0 px-4`}
                      >
                        {label}{visits ? ` · ${visits}` : ""}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            data-testid={`tab-${k}-episodes`}
                            aria-label={`${label} episodes`}
                            className={`${tabCls} rounded-l-none px-2`}
                            onClick={() => setTab(k)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-72">
                          {episodes.map((ep) => (
                            <DropdownMenuItem
                              key={ep.id}
                              data-testid={`tab-${k}-episode-${ep.id}`}
                              className={`flex flex-col items-start gap-0.5 py-2 ${current?.id === ep.id ? "bg-secondary" : ""}`}
                              onClick={() => {
                                setTab(k);
                                setEpisodeSel((s) => ({ ...s, [k]: ep.id }));
                              }}
                            >
                              <span className="font-semibold">Episode {episodeNumber(episodes, ep.id)} · {visitLabel(ep.visitCount)}</span>
                              <span className="text-xs text-muted-foreground">
                                {fmtDate(ep.start)}{ep.visitCount > 1 ? ` – ${fmtDate(ep.last)}` : ""}
                                {` · ${episodeStatus(ep.outcome)}`}
                                {ep.diagnosis ? ` · ${ep.diagnosis}` : ""}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                }
                return (
                  <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
                    className={`${tabCls} px-4`}>{label}{visits ? ` · ${visits}` : ""}</button>
                );
              })}
            </div>
            {actions}
          </div>

          {!canEdit && <div className="mb-4"><AlertPanel level="review" title="View-only access" testid="readonly-alert">Your access level allows viewing this record but not editing.</AlertPanel></div>}

          {tab === "suspect" && (
            <div className="space-y-3" data-testid="suspect-tab">
              {/* <Button className="h-11" data-testid="new-suspect-btn" disabled={!canEdit} onClick={() => navigate(`/patients/${p.id}/suspect`)}>
                <Stethoscope className="mr-2 h-4 w-4" /> New suspect screening
              </Button> */}
              {mySuspects.length === 0 && <AlertPanel level="info" title="No suspect screening yet" testid="no-suspect">Record complaints, photos and the suspected NTD here first.</AlertPanel>}
              {mySuspects.map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{fmtDate(s.date)} · {s.suspect === "none" ? "Suspect Non-NTDs Skin Condition" : `${DISEASE_SPECS[s.suspect]?.name} suspected`}</p>
                      {s.symptoms?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-muted-foreground">Presenting Complaints / Symptoms</p>
                          <p className="mt-1 text-sm font-medium">{s.symptoms.join(" · ")}</p>
                        </div>
                      )}
                    </div>
                    {s.suspect !== "none" && DISEASE_SPECS[s.suspect] && !encs.some((e) => e.disease === s.suspect) && (
                      <Button variant="outline" className="h-11 shrink-0" data-testid={`start-flow-${s.id}`} disabled={!canEdit} onClick={() => setEnc({ ...enc, show: true, disease: s.suspect })}>
                        Start {DISEASE_SPECS[s.suspect].name} flow
                      </Button>
                    )}
                  </div>
                  {s.photos?.length > 0 && (
                    <div className="mt-3" data-testid={`suspect-photos-${s.id}`}>
                      <p className="text-xs font-semibold text-muted-foreground">Skin Photographs</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {s.photos.map((src, i) => (
                          <button
                            key={i}
                            type="button"
                            data-testid={`suspect-photo-${s.id}-${i}`}
                            onClick={() => setPhotoView({ photos: s.photos, index: i })}
                            className="h-24 w-24 overflow-hidden rounded-md border border-border bg-muted"
                          >
                            <img src={src} alt={`Skin photograph ${i + 1}`} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {myDiseases.some((x) => x.id === tab) && (
            <div className="space-y-4" data-testid={`condition-tab-${tab}`}>
              {selectedEpisode && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white px-4 py-3" data-testid="episode-summary">
                  <div>
                    <p className="font-semibold">
                      Episode {episodeNumber(episodesByDisease[tab], selectedEpisode.id)}
                      {" · "}{visitLabel(selectedEpisode.visitCount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(selectedEpisode.start)}{selectedEpisode.visitCount > 1 ? ` – ${fmtDate(selectedEpisode.last)}` : ""}
                      {selectedEpisode.diagnosis ? ` · ${selectedEpisode.diagnosis}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded">{episodeStatus(selectedEpisode.outcome)}</Badge>
                </div>
              )}
              {featureRows.map(({ k, label, rows }) => {
                const isOpen = featureOpen[k] !== false;
                const exams = k === "marks" ? uniqueExamChips(rows) : [];
                const examKey = `${tab}:${selectedEpisode?.id || ""}`;
                const selectedExam = exams.find((x) => x.id === examSel[examKey]) || exams[0];
                const last = exams[0] || rows[0]?.e;
                const lastAt = last?.date ? fmtDateTime(last.date) : "";
                const entryCount = exams.length || rows.length;
                const examVisit = selectedExam
                  ? (selectedEpisode?.visits || []).find((v) => v.id === selectedExam.encounterId)
                    || encounters.find((v) => v.id === selectedExam.encounterId)
                  : null;
                return (
                  <section key={k} className="rounded-lg border border-border bg-white" data-testid={`feature-${k}`}>
                    <div className="flex w-full items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        data-testid={`feature-toggle-${k}`}
                        onClick={() => setFeatureOpen((o) => ({ ...o, [k]: !isOpen }))}
                        className="flex min-w-0 flex-1 items-center text-left"
                      >
                        <h2 className="font-head text-lg font-semibold">{label}</h2>
                      </button>
                      <span className="flex shrink-0 items-center gap-2">
                        {lastAt && (
                          <span className="truncate text-xs font-medium text-muted-foreground" data-testid={`feature-last-${k}`}>
                            {lastAt}
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-primary"
                          data-testid={`feature-add-${k}`}
                          disabled={!canEdit}
                          aria-label={`Add ${label}`}
                          onClick={() => openFeatureEncounter(selectedEpisode?.visits?.[0], k)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Badge variant="outline" className="rounded">{entryCount} entr{entryCount === 1 ? "y" : "ies"}</Badge>
                        <button
                          type="button"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                          onClick={() => setFeatureOpen((o) => ({ ...o, [k]: !isOpen }))}
                          className="grid h-8 w-8 place-items-center"
                        >
                          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      </span>
                    </div>
                    {isOpen && (
                      <div className="divide-y divide-border border-t border-border">
                        {k === "marks" && exams.length > 0 ? (
                          <div className="px-4 py-3">
                            {exams.length > 1 && (
                              <div className="mb-3 flex gap-2 overflow-x-auto pb-1" data-testid="exam-chips">
                                {exams.map((exam) => {
                                  const selected = selectedExam?.id === exam.id;
                                  return (
                                    <button
                                      key={exam.id}
                                      type="button"
                                      data-testid={`exam-chip-${exam.id}`}
                                      onClick={() => setExamSel((s) => ({ ...s, [examKey]: exam.id }))}
                                      className={`h-8 shrink-0 rounded-full border px-3 text-xs font-semibold ${
                                        selected
                                          ? "border-primary bg-primary text-white"
                                          : "border-border bg-white text-foreground hover:bg-muted"
                                      }`}
                                    >
                                      {examChipLabel(exam)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex items-start justify-between gap-2">
                              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
                                <span>{fmtDate(selectedExam.date)} · {selectedExam.worker} · {selectedExam.type}</span>
                                {isPastEditedSection(examVisit || selectedExam, latestVisitId, "marks") && <EditedBadge />}
                              </p>
                              {canEdit && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-primary"
                                  data-testid="feature-edit-marks"
                                  aria-label="Edit examination"
                                  onClick={() => openFeatureEncounter(examVisit, "marks")}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <ExamSummary exam={selectedExam} />
                          </div>
                        ) : (
                          rows.map(({ e, s }) => (
                            <div key={e.id} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
                                  <span>{fmtDate(e.date)} · {e.worker} · {e.type}</span>
                                  {isPastEditedSection(e, latestVisitId, k) && <EditedBadge />}
                                </p>
                                {canEdit && EDITABLE_FEATURES.has(k) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-primary"
                                    data-testid={`feature-edit-${k}-${e.id}`}
                                    aria-label={`Edit ${label}`}
                                    onClick={() => openFeatureEncounter(e, k)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              {s?.kind === "history" ? (
                                <HistorySummary sections={s.sections} />
                              ) : s?.kind === "lab" ? (
                                <LabSummary lines={s.lines} />
                              ) : s?.kind === "meds" ? (
                                <MedsSummary rows={s.rows} />
                              ) : s?.kind === "adherence" ? (
                                <AdherenceSummary value={s.value} spec={s.spec} diagnosis={s.diagnosis} startDate={s.startDate} />
                              ) : s?.kind === "hh-counts" || s?.kind === "hh-leprosy" ? (
                                <HouseholdSummary s={s} />
                              ) : s?.kind === "reactions" ? (
                                <ReactionSummary assessments={s.assessments} />
                              ) : s?.kind === "outcome" ? (
                                <OutcomeSummary outcome={s.outcome} recommendations={s.recommendations} />
                              ) : s?.kind === "notes" ? (
                                <NotesSummary lines={s.lines} />
                              ) : (
                                <p className="mt-1 whitespace-pre-line text-sm font-medium">{s}</p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
              {!selectedEpisode && (
                <AlertPanel level="info" title={`No ${DISEASE_SPECS[tab].name} data yet`} testid="empty-condition">Add an encounter to start this condition record.</AlertPanel>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!photoView} onOpenChange={(o) => !o && setPhotoView(null)}>
        <DialogContent
          className="max-w-2xl"
          data-testid="suspect-photo-dialog"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") stepPhoto(-1);
            if (e.key === "ArrowRight") stepPhoto(1);
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-head text-xl">
              Skin Photograph{photoCount > 1 ? ` · ${photoIndex + 1} of ${photoCount}` : ""}
            </DialogTitle>
          </DialogHeader>
          {photoSrc && (
            <div className="relative">
              <img src={photoSrc} alt={`Skin photograph ${photoIndex + 1}`} className="max-h-[70vh] w-full rounded-md object-contain" />
              {photoCount > 1 && (
                <>
                  <button
                    type="button"
                    data-testid="suspect-photo-prev"
                    aria-label="Previous photograph"
                    onClick={() => stepPhoto(-1)}
                    className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-white/95 text-primary shadow-sm hover:bg-white"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    data-testid="suspect-photo-next"
                    aria-label="Next photograph"
                    onClick={() => stepPhoto(1)}
                    className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-white/95 text-primary shadow-sm hover:bg-white"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          )}
          {photoCount > 1 && (
            <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
              <Button type="button" variant="outline" className="h-11" data-testid="suspect-photo-prev-btn" onClick={() => stepPhoto(-1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <Button type="button" className="h-11" data-testid="suspect-photo-next-btn" onClick={() => stepPhoto(1)}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={enc.show} onOpenChange={(o) => setEnc({ ...enc, show: o })}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md" data-testid="add-encounter-dialog">
          <DialogHeader><DialogTitle className="font-head text-xl">Add encounter</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <TextField label="Date" type="date" testid="encounter-date-input" value={enc.date} onChange={(e) => setEnc({ ...enc, date: e.target.value })} hint={fmtDate(enc.date)} />
            <TextField label="Clinician" testid="encounter-clinician" value={user?.name || ""} readOnly />
            <SelectField label="Visit type" options={settings.visitTypes} value={enc.visitType} onChange={(v) => setEnc({ ...enc, visitType: v })} testid="encounter-visit-type-select" />
            <ChoiceRow
              label="Referral"
              options={["Yes", "No"]}
              value={enc.referral}
              onChange={(v) => setEnc({ ...enc, referral: v, province: "", district: "", facility: v === "Yes" ? "" : enc.facility })}
              testid="encounter-referral"
            />
            {enc.referral === "Yes" && (
              <>
                <SelectField
                  label="Province"
                  options={Object.keys(GEO)}
                  value={enc.province}
                  onChange={(v) => setEnc({ ...enc, province: v, district: "", facility: "" })}
                  testid="encounter-referral-province"
                />
                <SelectField
                  label="District"
                  options={referralDistricts}
                  value={enc.district}
                  onChange={(v) => setEnc({ ...enc, district: v, facility: "" })}
                  testid="encounter-referral-district"
                />
              </>
            )}
            <SelectField
              label="Location / facility"
              options={locationOptions}
              value={enc.facility}
              onChange={(v) => setEnc({ ...enc, facility: v })}
              testid="encounter-facility-select"
              hint={enc.referral === "Yes" && !enc.district ? "Select province and district to see referral locations" : enc.referral === "Yes" && locationOptions.length === 0 ? "No facilities listed for this district" : undefined}
            />
            <SelectField label="Go to" options={["Suspect screening", ...myDiseases.map((s) => s.name)]}
              value={enc.disease && myDiseases.some((d) => d.id === enc.disease) ? DISEASE_SPECS[enc.disease].name : "Suspect screening"}
              onChange={(v) => setEnc({ ...enc, disease: myDiseases.find((s) => s.name === v)?.id || "" })} testid="encounter-target-select" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12" data-testid="encounter-cancel" onClick={() => setEnc({ ...enc, show: false })}>Cancel</Button>
            <Button className="h-12" data-testid="encounter-start" onClick={start}>Start encounter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
