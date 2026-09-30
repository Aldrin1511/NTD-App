import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertPanel, SelectField, TextField, ChoiceRow } from "@/components/Fields";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DISEASE_SPECS, SPEC_LIST, assessmentSpecs, fmtDate, fmtDateTime, visitLabel, groupDiseaseEpisodes, isEpisodeClosed, leprosyScores, leprosyClass, localISODate } from "@/mock/specs";
import { markFindings, findingPatchCount } from "@/lib/markFindings";
import { GEO } from "@/mock/data";
import { compactValue, sectionFingerprint } from "@/sectionDiff";
import { scrollViewToTop } from "@/lib/scroll";
import { toast } from "sonner";
import { ArrowLeft, Plus, Phone, ChevronDown, ChevronLeft, ChevronRight, PanelLeft, Pencil, Printer } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import PatientSidebar from "@/components/PatientSidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SCABIES_DRUGS, ageInMonths } from "@/components/ScabiesMedications";
import { patientAgeLabel } from "@/components/Capture";
import { buildVisitSummaryPrintHtml, featureRowsFromVisits, printHtmlDocument } from "@/lib/visitSummaryPrint";
import { YAWS_DRUGS, azithromycinDose, benzathineDose } from "@/components/YawsMedications";
import { LF_DRUGS, ivermectinDose, albendazoleDose, decDose } from "@/components/LfMedications";
import { BURULI_DRUGS, rifampicinDose, clarithromycinDose } from "@/components/BuruliMedications";
import { LEPROSY_DRUGS, mdtBand, prednisoloneSchedule, mdtAdherenceConfig } from "@/components/LeprosyMedications";
import { formatDosePhysical, physicalUnits, hideVisitPosology } from "@/lib/medications";
import { AdherenceGrid, HouseholdCountTable, normalizeLepOccasion, LeprosyAdherenceDashboard } from "@/components/FormRenderer";
import LeprosyHouseholdMonitoring from "@/components/LeprosyHouseholdMonitoring";
import { REACTION_COLS, REACTION_GRID } from "@/components/LeprosyReaction";
import AntenatalDashboard from "@/components/AntenatalDashboard";
import WellBabyDashboard from "@/components/WellBabyDashboard";
import MalnutritionDashboard from "@/components/MalnutritionDashboard";
import { useAppointmentDateGate } from "@/components/AppointmentDatePrompt";
import { visitDay } from "@/lib/appointmentDate";
import { ANTENATAL_ID, ANTENATAL_NAME } from "@/mock/antenatal";
import { WELLBABY_ID, WELLBABY_NAME } from "@/mock/wellbaby";
import { MAL_ID, MAL_NAME } from "@/mock/malnutrition";

const EXTRA_CONDITIONS = [
  { id: ANTENATAL_ID, name: ANTENATAL_NAME, route: "antenatal" },
  { id: WELLBABY_ID, name: WELLBABY_NAME, route: "wellbaby" },
  { id: MAL_ID, name: MAL_NAME, route: "malnutrition" },
];
const EXTRA_IDS = EXTRA_CONDITIONS.map((c) => c.id);

const FEATURES = [
  ["caseDetails", "Case details"], ["history", "Clinical history"], ["marks", "Examination"],
  ["lab", "Laboratory"], ["diagnosis", "Diagnosis"], ["drugs", "Medications"],
  ["adherence", "Medication Adherence"],
  ["household", "Household Contact Tracing"], ["reactions", "Lepra reactions"], ["notes", "Visit notes"], ["outcome", "Final case outcome"],
];

const featureSectionNumber = (key, diseaseId) => {
  if (key === "reactions") return 8;
  if (key === "notes") return diseaseId === "leprosy" ? 9 : 8;
  if (key === "outcome") return diseaseId === "leprosy" ? 10 : 9;
  return { caseDetails: 1, history: 2, marks: 3, lab: 4, diagnosis: 5, drugs: 6, adherence: 6, household: 7 }[key] || 1;
};

const isEditedSection = (visit, featureKey) =>
  !!visit?.revised && (visit.editedSections || []).includes(featureKey);

const EditedBadge = () => (
  <Badge variant="outline" className="rounded border-amber-300 bg-amber-50 text-amber-800" data-testid="edited-badge">
    Edited
  </Badge>
);

const newestFirst = (items, getDate = (x) => (x && typeof x === "object" ? x.date : "")) => {
  const arr = Array.isArray(items) ? [...items] : [];
  if (arr.length < 2) return arr;
  if (arr.some((x) => getDate(x))) {
    return arr.sort((a, b) => String(getDate(b) || "0000").localeCompare(String(getDate(a) || "0000")));
  }
  return arr.reverse();
};

/** Keep a visit in a dashboard section only when that section’s data changed vs the previous visit. */
const rowsForChangedSection = (visits, key, spec, patient) => {
  const chronological = [...(visits || [])].sort((a, b) => {
    const byDate = String(a.date).localeCompare(String(b.date));
    return byDate || String(a.id).localeCompare(String(b.id));
  });
  const keep = new Set();
  const prevVisitById = {};
  let prevFp = "";
  chronological.forEach((e, i) => {
    const fp = sectionFingerprint(key, e);
    if (!fp || fp === prevFp) return;
    keep.add(e.id);
    prevVisitById[e.id] = chronological[i - 1] || null;
    prevFp = fp;
  });
  return (visits || [])
    .filter((e) => keep.has(e.id))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)))
    .map((e) => ({ e, s: summarise(key, e, spec, patient, prevVisitById[e.id]) }))
    .filter((r) => r.s);
};

const examChipFingerprint = (exam) => JSON.stringify(compactValue({
  encounterId: exam.encounterId,
  roundIndex: exam.roundIndex,
  occasion: exam.occasion,
  findings: exam.findings,
  secondaryInfection: exam.secondaryInfection,
  extras: exam.extras,
  leprosy: exam.leprosy,
  photoCount: Array.isArray(exam.photos) ? exam.photos.length : 0,
}));

const uniqueExamChips = (rows) => {
  const seen = new Set();
  const out = [];
  (rows || []).forEach((r) => {
    (r.s?.kind === "exam" ? r.s.exams : []).forEach((exam) => {
      const fp = examChipFingerprint(exam);
      if (!fp || seen.has(fp)) return;
      seen.add(fp);
      out.push(exam);
    });
  });
  return out;
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

const episodeStatusChipClass = (status) => {
  const s = String(status || "").toLowerCase().replace(/[\u2010-\u2015\u2212]/g, "-");
  if (s === "active") return "border-transparent bg-emerald-600 text-white";
  if (/cured|healed/.test(s)) return "border-transparent bg-primary text-white";
  if (/lost to follow/.test(s)) return "border-amber-300 bg-amber-50 text-amber-900";
  if (/^no\s+(scabies|yaws|leprosy|buruli|lymphatic)/.test(s)) return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-primary/20 bg-secondary text-secondary-foreground";
};

const episodeDateParts = (ep) => {
  const parts = [{ k: "start", label: "Start date", value: fmtDate(ep.start) }];
  if (isEpisodeClosed(ep.outcome)) {
    parts.push({ k: "end", label: "End date", value: fmtDate(ep.last) });
  }
  return parts;
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

const formatCaseDetailsValue = (field, value) => {
  if (value == null || value === "") return "";
  if (field?.type === "note" || field?.type === "section") return "";
  const raw = typeof value === "string" || typeof value === "number" ? String(value).trim() : formatHistoryValue(field, value);
  if (!raw) return "";
  if (field?.k === "height" && !/cm/i.test(raw)) return `${raw} cms`;
  if (field?.k === "weight" && !/kg/i.test(raw)) return `${raw} kgs`;
  return raw;
};

const summariseCaseDetails = (caseDetails, spec) => {
  if (!caseDetails || typeof caseDetails !== "object") return "";
  const fields = spec?.caseDetails || [];
  const items = [];
  for (const field of fields) {
    if (field.type === "note" || field.type === "section") continue;
    const value = formatCaseDetailsValue(field, caseDetails[field.k]);
    if (value) items.push({ label: field.label, value });
  }
  // Include any extra saved keys not in the current spec so nothing is dropped
  const known = new Set(fields.map((f) => f.k));
  Object.entries(caseDetails).forEach(([k, v]) => {
    if (known.has(k) || v == null || v === "") return;
    const value = typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
    if (value) items.push({ label: k, value });
  });
  if (!items.length) return "";
  return { kind: "history", sections: [{ label: "", items }] };
};

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

const bodyPartOf = (m) => {
  if (m.region) return m.region;
  if (m.code || (Array.isArray(m.findings) && m.findings.length)) return "";
  return m.label || "";
};

const isSecondaryPerLesion = (spec) =>
  /secondary/i.test(String(spec?.bodyChart?.perLesion?.k || spec?.bodyChart?.perLesion?.label || ""));

const lesionSecondaryInfection = (marks) => {
  const items = Object.values(marks || {})
    .map((m) => {
      const v = String(m.extra || "").trim();
      if (!v || /^none$/i.test(v)) return null;
      return { value: v, part: bodyPartOf(m) };
    })
    .filter(Boolean);
  if (!items.length) return "";
  const values = [...new Set(items.map((x) => x.value))];
  if (values.length === 1) return values[0];
  return items
    .map((x) => (x.part ? `${x.value} (${x.part})` : x.value))
    .filter((line, i, all) => all.indexOf(line) === i)
    .join(", ");
};

const groupExamFindings = (marks, spec) => {
  const order = (spec?.bodyChart?.codes || []).map((c) => c[1]);
  const groups = new Map();
  Object.values(marks || {}).forEach((m) => {
    const part = bodyPartOf(m);
    const extra = isSecondaryPerLesion(spec) ? "" : (m.extra && m.extra !== "None" ? m.extra : "");
    markFindings(m).forEach((f) => {
      const name = findingNameOf({ ...m, ...f }, spec);
      if (!name && !part) return;
      const key = name || "Finding";
      const loc = (() => {
        const n = findingPatchCount(f);
        const partLabel = part && n > 1 ? `${part} ×${n}` : part;
        return [partLabel, extra].filter(Boolean).join(" · ");
      })();
      if (!groups.has(key)) groups.set(key, []);
      if (!groups.get(key).includes(loc)) groups.get(key).push(loc);
    });
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
    return newestFirst(list)
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

const hasClock = (v) => /T\d{2}:\d{2}/.test(String(v || ""));

const entryDateTime = (primary, fallback) =>
  fmtDateTime(hasClock(primary) ? primary : (hasClock(fallback) ? fallback : primary || fallback));

const examChipLabel = (exam) =>
  `${entryDateTime(exam.date, exam.editedAt || exam.encounterDate)} · ${exam.type || "Examination"}`;

const summariseExam = (e, spec) => {
  const x = e.data || {};
  const photos = Array.isArray(x.photos) ? x.photos.filter(Boolean) : [];
  const raw = Array.isArray(x.examRounds) && x.examRounds.length
    ? x.examRounds
    : [{ marks: x.marks || {}, secondaryInfection: x.assessment?.secondaryInfection, assessment: x.assessment || {} }];
  const rounds = newestFirst(raw);

  let exams = rounds
    .map((round, i) => {
      const marks = round.marks || {};
      const assessment = { ...(x.assessment || {}), ...(round.assessment || {}) };
      const findings = groupExamFindings(marks, spec);
      const si = isSecondaryPerLesion(spec)
        ? lesionSecondaryInfection(marks)
        : (round.secondaryInfection || assessment.secondaryInfection || "");
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
        encounterDate: e.date,
        date: round.date || e.date,
        type: e.type,
        worker: e.worker,
        roundIndex: rounds.length - 1 - i,
        roundCount: rounds.length,
        occasion: normalizeLepOccasion(round.occasion) || (spec?.id === "leprosy" && i === rounds.length - 1 ? "Upon Diagnosis" : ""),
        findings,
        secondaryInfection: hasValue(si) ? si : "",
        extras,
        leprosy,
        photos: [],
      };
    })
    .filter(Boolean);

  // Visit-level assessment photographs — attach to newest exam entry (or a photo-only row)
  if (photos.length) {
    if (exams.length) {
      exams = exams.map((exam, idx) => (idx === 0 ? { ...exam, photos } : exam));
    } else {
      exams = [{
        id: `${e.id}-photos`,
        encounterId: e.id,
        editedAt: e.editedAt,
        encounterDate: e.date,
        date: e.date,
        type: e.type,
        worker: e.worker,
        roundIndex: 0,
        roundCount: 1,
        occasion: "",
        findings: [],
        secondaryInfection: "",
        extras: [],
        leprosy: null,
        photos,
      }];
    }
  }

  if (!exams.length) return "";
  return { kind: "exam", exams };
};

const PhotoThumbs = ({ photos = [], onOpen, testid = "dashboard-photos" }) => {
  const list = (Array.isArray(photos) ? photos : []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="mt-3" data-testid={testid}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Photographs · {list.length}
      </p>
      <div className="flex flex-wrap gap-2">
        {list.map((src, i) => (
          <button
            key={`${testid}-${i}`}
            type="button"
            data-testid={`${testid}-thumb-${i}`}
            onClick={() => onOpen?.(list, i)}
            className="h-20 w-20 overflow-hidden rounded-md border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <img src={src} alt={`Photograph ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
};

const ExamSummary = ({ exam, onOpenPhotos }) => {
  if (!exam) return null;
  const lep = exam.leprosy;
  const showAssessment = exam.roundCount > 1;
  return (
    <div className="mt-2 space-y-1" data-testid="exam-summary">
      {(showAssessment || exam.occasion) && (
        <div className="space-y-1" data-testid="exam-assessment-meta">
          {showAssessment && (
            <p className="text-sm text-primary">
              <span className="font-medium">Assessment</span>{" "}
              <span className="font-medium">{exam.roundIndex + 1}</span>{" - "}
              <span className="font-medium">{exam.occasion}</span>
            </p>
       
          )}
        </div>
      )}
      {exam.findings?.length > 0 && (
        <div className="space-y-1" data-testid="exam-findings">
          {exam.findings.map((finding, i) => (
            <p key={`${finding}-${i}`} className="text-sm font-medium">{finding}</p>
          ))}
        </div>
      )}
      {exam.secondaryInfection && (
        <p className="text-sm" data-testid="exam-secondary-infection">
          Secondary infection - {exam.secondaryInfection}
        </p>
      )}
      {(exam.extras || []).map((item) => (
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
              Eyes {lep.leftEye}(left), {lep.rightEye}(right) · Hands {lep.leftHand}(left), {lep.rightHand}(right) · Feet {lep.leftFoot}(left), {lep.rightFoot}(right)
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
      <PhotoThumbs
        photos={exam.photos}
        testid={`exam-photos-${exam.id}`}
        onOpen={(photos, index) => onOpenPhotos?.(photos, index)}
      />
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
    const entries = newestFirst(labEntries(lab?.[field.k]));
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
  const weight = Number(x.caseDetails?.weight || patient?.weight || 0);
  const months = ageInMonths(patient || {});
  const years = months != null ? months / 12 : Number(patient?.age);
  const disease = spec?.id || e.disease;
  const topical = x.topical || [];
  const oral = x.oral || [];
  const used = new Set();
  const rows = [];

  const add = (row, names = []) => {
    (names.length ? names : [row.name]).forEach((n) => used.add(n));
    const ov = hideVisitPosology(row.name) ? {} : ((x.posology || {})[row.name] || {});
    rows.push({
      name: row.name,
      dosage: ov.dosage || row.dosage || "—",
      frequency: ov.frequency || row.frequency || "—",
      duration: ov.duration || row.duration || "—",
      qualifier: ov.qualifier || row.qualifier || "—",
      advice: ov.advice || row.advice || "",
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
          }, [LEPROSY_DRUGS.mdt]);
        });
      } else {
        add({ name: LEPROSY_DRUGS.mdt, dosage: "Blister pack", frequency: "—", duration }, [LEPROSY_DRUGS.mdt]);
      }
    }
    if (oral.includes(LEPROSY_DRUGS.prednisolone)) {
      const sch = prednisoloneSchedule();
      const key = LEPROSY_DRUGS.prednisolone;
      used.add(key);
      const ov = hideVisitPosology(key) ? {} : ((x.posology || {})[key] || {});
      const qualifier = ov.qualifier || "—";
      sch.phases.forEach((p, i) => {
        rows.push({
          name: i === 0 ? LEPROSY_DRUGS.prednisolone : "",
          dosage: `${p.mgPerDose} mg`,
          frequency: p.dosesPerDay > 1 ? "Twice daily" : "Daily",
          duration: `${p.weeks} weeks`,
          qualifier: i === 0 ? qualifier : "",
          advice: "",
        });
      });
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

const drugNamesOf = (e) => {
  const x = e?.data || {};
  return new Set(
    [...(x.topical || []), ...(x.oral || []), ...(x.topicalAntibiotics || []), ...(x.oralAntibiotics || [])]
      .map((n) => String(n || "").trim())
      .filter(Boolean)
  );
};

/** True when this drug was newly selected on this visit (not carried from the previous visit). */
const isDrugAddedOnVisit = (name, e, prev) => {
  if (!name) return false;
  if (!prev) return true;
  return !drugNamesOf(prev).has(name);
};

const summariseMedications = (e, spec, patient, prevEncounter = null) => {
  const rows = medicationRows(e, spec, patient);
  if (!rows.length) return "";
  if (!prevEncounter) return { kind: "meds", rows };

  const filtered = [];
  let keepBlock = false;
  for (const row of rows) {
    if (row.name) keepBlock = isDrugAddedOnVisit(row.name, e, prevEncounter);
    if (keepBlock) filtered.push(row);
  }
  if (!filtered.length) return "";
  return { kind: "meds", rows: filtered };
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
    return { kind: "hh-leprosy", contacts: newestFirst(contacts, (c) => c.examDate || c.administrationDate) };
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
  const list = newestFirst(
    Array.isArray(e.data?.reactions) ? e.data.reactions : [],
    (r) => r.diagnosisDate || r.onsetDate,
  );
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
  const normalized =
    raw && typeof raw === "object" ? String(raw.status || raw.outcome || "").trim() : String(raw || "").trim();
  const outcome = isRecordedOutcome(normalized) ? normalized : "";
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

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Lightweight print for medications table only. */
const openHtmlPrintWindow = (title, bodyHtml) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #d4d4d4; padding: 8px; text-align: left; vertical-align: top; font-size: 12px; }
      th { color: #555; }
    </style></head><body><h1>${escapeHtml(title)}</h1>${bodyHtml}</body></html>`;
  return printHtmlDocument(html);
};

const MedsSummary = ({ rows }) => {
  const printMeds = () => {
    const node = document.querySelector("[data-testid='meds-print-area']");
    if (!node) return;
    openHtmlPrintWindow("Medications", node.innerHTML);
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
              <th className="py-2 pr-3 font-semibold">Frequency</th>
              <th className="py-2 pr-3 font-semibold">Duration</th>
              <th className="py-2 font-semibold">Qualifier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <Fragment key={`${row.name || row.dosage}-${i}`}>
                <tr className="border-b border-border/70 align-top">
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  <td className="py-2 pr-3">{row.dosage}</td>
                  <td className="py-2 pr-3">{row.frequency}</td>
                  <td className="py-2 pr-3">{row.duration}</td>
                  <td className="py-2">{row.qualifier || "—"}</td>
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

const summarise = (key, e, spec, patient, prevEncounter = null) => {
  const x = e.data || {};
  if (key === "caseDetails") return summariseCaseDetails(x.caseDetails || {}, spec || DISEASE_SPECS[e.disease]);
  if (key === "history") return summariseHistory(x.history || {}, spec || DISEASE_SPECS[e.disease]);
  if (key === "marks") return summariseExam(e, spec || DISEASE_SPECS[e.disease]);
  if (key === "lab") return summariseLab(x.lab || {}, spec || DISEASE_SPECS[e.disease], e.date);
  if (key === "diagnosis") {
    const dx = x.diagnosis || e.diagnosis;
    return hasValue(dx) ? dx : "";
  }
  if (key === "drugs") return summariseMedications(e, spec || DISEASE_SPECS[e.disease], patient, prevEncounter);
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
  const { id, diseaseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const backTo = location.state?.from || "/patients";
  const withFrom = (opts = {}) => (location.state?.from ? { ...opts, state: { from: location.state.from } } : opts);
  const { patients, encounters, user, suspects, facilities, settings, branding, startEpisode, addEncounter, saveEncounter, syncPatientEpisodes, syncPatientSuspects, syncPatientVisitPhi, loadLocations, loadVisitTypes, authSession, canAccessDisease, online } = useStore();
  const p = patients.find((x) => x.id === id);
  const [tab, setTab] = useState(() => diseaseId || searchParams.get("tab") || "");
  const [lhs, setLhs] = useState(true);
  const [featureOpen, setFeatureOpen] = useState(() => Object.fromEntries(FEATURES.map(([k]) => [k, true])));
  const [enc, setEnc] = useState({
    show: false,
    mode: "episode", // "episode" | "encounter"
    recordId: "",
    facility: "",
    locationId: "",
    date: localISODate(),
    visitType: "",
    referral: "No",
    disease: "",
    province: "",
    district: "",
    prevFacility: "",
    prevLocationId: "",
  });
  const [photoView, setPhotoView] = useState(null);
  const [episodeSel, setEpisodeSel] = useState({});
  const [starting, setStarting] = useState(false);
  const [printPreviewHtml, setPrintPreviewHtml] = useState("");
  const [printAfterHydrate, setPrintAfterHydrate] = useState(false);
  const { gate: gateAppointmentDate, dialog: appointmentDateDialog } = useAppointmentDateGate();
  const pendingOpenPrint = useRef(Boolean(location.state?.openPrint));
  const pendingSelectEpisodeId = useRef(String(location.state?.episodeId || ""));
  const pendingSelectVisitId = useRef(String(location.state?.visitId || ""));
  const canEdit = user?.canEdit;
  const patientSynced = Boolean(p && !p.localOnly && !String(p.id || "").startsWith("local-"));
  const canEditPatientDetails = Boolean(canEdit && online && patientSynced);
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
  // Skin NTDs only — ANC / malnutrition / well-baby are EXTRA_CONDITIONS (own dashboards).
  // Form-config ApplicationConfig also puts those ids on DISEASE_SPECS, which would otherwise
  // double them in tabs + clinical summary Conditions.
  const myDiseases = useMemo(
    () => assessmentSpecs(id, { encounters: encs }).filter((d) => !EXTRA_IDS.includes(d.id)),
    [id, encs],
  );
  const presentExtras = useMemo(() => EXTRA_CONDITIONS.filter((c) => encs.some((e) => e.disease === c.id)), [encs]);
  const isExtra = (t) => presentExtras.some((c) => c.id === t);
  const sidebarDiseases = useMemo(() => [...myDiseases, ...presentExtras.map((c) => ({ id: c.id, name: c.name }))], [myDiseases, presentExtras]);
  const hasSuspects = mySuspects.length > 0;
  const activeTab =
    tab === "suspect" && hasSuspects
      ? "suspect"
      : isExtra(tab)
        ? tab
        : myDiseases.some((d) => d.id === tab)
          ? tab
          : diseaseId && (myDiseases.some((d) => d.id === diseaseId) || isExtra(diseaseId))
            ? diseaseId
            : hasSuspects
              ? "suspect"
              : myDiseases[0]?.id || presentExtras[0]?.id || "";

  useEffect(() => {
    if (!diseaseId) return;
    if (diseaseId === "suspect" && hasSuspects) {
      setTab("suspect");
      return;
    }
    if (myDiseases.some((d) => d.id === diseaseId) || isExtra(diseaseId)) setTab(diseaseId);
  }, [diseaseId, hasSuspects, myDiseases, presentExtras]);

  // Load LocationsT + visit types (Apex OP master) + open HMIS episodes + suspect screenings + PHI for dashboard
  useEffect(() => {
    if (!p?.id) return;
    loadLocations?.({ force: true });
    loadVisitTypes?.();
    let cancelled = false;
    const wantPrint = pendingOpenPrint.current;
    if (authSession?.facilityId) {
      Promise.resolve(syncPatientEpisodes?.(p.id, { force: true }))
        .then((rows) => syncPatientVisitPhi?.(p.id, { visits: rows || [] }))
        .then(() => {
          if (cancelled || !wantPrint) return;
          pendingOpenPrint.current = false;
          navigate(`${location.pathname}${location.search}`, {
            replace: true,
            state: { from: location.state?.from || "/appointments" },
          });
          setPrintAfterHydrate(true);
        })
        .catch((err) => {
          console.warn("dashboard hydrate failed", err);
          if (!cancelled && wantPrint) {
            pendingOpenPrint.current = false;
            setPrintAfterHydrate(true);
          }
        });
      syncPatientSuspects?.(p.id);
    } else if (wantPrint) {
      pendingOpenPrint.current = false;
      setPrintAfterHydrate(true);
    }
    return () => {
      cancelled = true;
    };
  }, [p?.id, authSession?.facilityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also force-refresh suspects when opening the Suspect tab
  useEffect(() => {
    if (!p?.id || activeTab !== "suspect" || !authSession?.facilityId) return;
    syncPatientSuspects?.(p.id, { force: true });
  }, [activeTab, p?.id, authSession?.facilityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectTab = (k) => {
    setTab(k);
    if (!p?.id) return;
    if (k === "suspect") navigate(`/patients/${p.id}`, { replace: true, ...withFrom() });
    else navigate(`/patients/${p.id}/disease/${k}`, { replace: true, ...withFrom() });
  };

  const episodesByDisease = useMemo(() => {
    const map = {};
    for (const d of myDiseases) map[d.id] = groupDiseaseEpisodes(encs, d.id, p?.episodeId);
    return map;
  }, [encs, myDiseases, p?.episodeId]);

  // Prefer the episode/visit that opened this record (e.g. Appointments card)
  useEffect(() => {
    if (!activeTab) return;
    const eps = episodesByDisease[activeTab] || [];
    if (!eps.length) return;

    let targetId = pendingSelectEpisodeId.current;
    const visitId = pendingSelectVisitId.current;
    if (visitId) {
      const byVisit = eps.find((ep) =>
        (ep.visits || []).some((v) => String(v.id) === visitId || String(v.visitId) === visitId)
      );
      if (byVisit) targetId = byVisit.id;
    }
    if (!targetId) return;
    if (!eps.some((ep) => ep.id === targetId)) return;
    setEpisodeSel((prev) => (prev[activeTab] === targetId ? prev : { ...prev, [activeTab]: targetId }));
  }, [activeTab, episodesByDisease]);

  const selectedEpisode = (episodesByDisease[activeTab] || []).find((e) => e.id === episodeSel[activeTab]) || (episodesByDisease[activeTab] || [])[0];
  const selectedEpisodeId = selectedEpisode?.id || "";

  /** Diseases with at least one open episode — hide from Add Episode "Go to". */
  const activeDiseaseIds = useMemo(() => {
    const ids = new Set();
    for (const s of SPEC_LIST) {
      const eps = groupDiseaseEpisodes(encs, s.id, p?.episodeId);
      if (eps.some((ep) => ep.id !== "_none" && !isEpisodeClosed(ep.outcome))) ids.add(s.id);
    }
    for (const c of EXTRA_CONDITIONS) {
      const eps = groupDiseaseEpisodes(encs, c.id, null);
      if (eps.some((ep) => ep.id !== "_none" && !isEpisodeClosed(ep.outcome))) ids.add(c.id);
    }
    return ids;
  }, [encs, p?.episodeId]);

  const episodeGoToOptions = useMemo(() => {
    const opts = [];
    if (canAccessDisease("suspect")) opts.push("Suspect screening");
    opts.push(
      ...SPEC_LIST.filter((s) => canAccessDisease(s.id) && !activeDiseaseIds.has(s.id)).map((s) => s.name),
      ...EXTRA_CONDITIONS.filter((c) => canAccessDisease(c.id) && !activeDiseaseIds.has(c.id)).map((c) => c.name)
    );
    return opts;
  }, [activeDiseaseIds, canAccessDisease]);

  /** Map Go-to label → disease id (empty string = Suspect screening). */
  const goToLabelToDiseaseId = (label) => {
    if (!label || label === "Suspect screening") return "";
    return (
      EXTRA_CONDITIONS.find((c) => c.name === label)?.id ||
      SPEC_LIST.find((s) => s.name === label)?.id ||
      ""
    );
  };

  const defaultGoToDiseaseId = goToLabelToDiseaseId(episodeGoToOptions[0] || "");

  const pendingVisits = useMemo(
    () =>
      encs.filter(
        (e) =>
          e.disease === activeTab &&
          e.pendingStart &&
          (!selectedEpisodeId || e.episodeId === selectedEpisodeId || !e.episodeId)
      ),
    [encs, activeTab, selectedEpisodeId]
  );

  useLayoutEffect(() => {
    scrollViewToTop();
  }, [id, activeTab, selectedEpisodeId]);
  const featureRows = useMemo(() => {
    if (!myDiseases.some((x) => x.id === activeTab)) return [];
    const visits = selectedEpisode?.visits || [];
    const spec = DISEASE_SPECS[activeTab];
    return FEATURES.map(([k, label]) => ({
      k,
      label,
      rows: rowsForChangedSection(visits, k, spec, p),
    })).filter((f) => f.rows.length);
  }, [activeTab, selectedEpisode, myDiseases, p]);

  const referralDistricts = enc.province ? Object.keys(GEO[enc.province] || {}) : [];
  const locationFacilities = useMemo(
    () =>
      facilities.filter((f) => {
        if (enc.referral !== "Yes") return true;
        if (!enc.province) return false;
        if (f.province && f.province !== enc.province) return false;
        if (enc.district && f.district && f.district !== enc.district) return false;
        return true;
      }),
    [facilities, enc.referral, enc.province, enc.district]
  );
  const locationOptions = useMemo(
    () => [
      ...new Set([
        ...locationFacilities.map((f) => f.name),
        ...(enc.facility ? [enc.facility] : []),
      ]),
    ],
    [locationFacilities, enc.facility]
  );

  // Only one accessible location → pre-select it (Add Episode / referral filter).
  useEffect(() => {
    if (!enc.show || enc.mode === "encounter") return;
    if (locationFacilities.length !== 1) return;
    const only = locationFacilities[0];
    if (!only?.name) return;
    if (enc.facility === only.name && String(enc.locationId || "") === String(only.id || "")) return;
    setEnc((s) => ({
      ...s,
      facility: only.name,
      locationId: only.id || "",
      prevFacility: only.name,
      prevLocationId: only.id || "",
    }));
  }, [enc.show, enc.mode, enc.facility, enc.locationId, locationFacilities]);

  // Keep Go to on a valid option; default to the first available (Suspect screening when granted).
  useEffect(() => {
    if (!enc.show || enc.mode === "encounter") return;
    if (!episodeGoToOptions.length) return;
    const label = enc.disease
      ? EXTRA_CONDITIONS.find((c) => c.id === enc.disease)?.name ||
        DISEASE_SPECS[enc.disease]?.name ||
        ""
      : canAccessDisease("suspect")
        ? "Suspect screening"
        : "";
    if (label && episodeGoToOptions.includes(label)) return;
    const nextId = goToLabelToDiseaseId(episodeGoToOptions[0]);
    if (String(enc.disease || "") === String(nextId || "")) return;
    setEnc((s) => ({ ...s, disease: nextId }));
  }, [enc.show, enc.mode, enc.disease, episodeGoToOptions, canAccessDisease]);

  const printVisitSummaryRef = useRef(() => {});

  // Appointments → Print: open preview once episode/PHI are ready
  useEffect(() => {
    if (!printAfterHydrate) return;
    setPrintAfterHydrate(false);
    window.setTimeout(() => printVisitSummaryRef.current?.(), 50);
  }, [printAfterHydrate]);

  if (!p) return <AppShell title="Patient not found"><Button className="h-12" onClick={() => navigate(backTo)}>Back</Button></AppShell>;

  const runStart = async (visitDate) => {
    if (enc.mode !== "encounter" && enc.disease && activeDiseaseIds.has(enc.disease)) {
      return toast.error("This disease already has an active episode — close it first or choose another");
    }
    if (enc.referral === "Yes" && (!enc.province || !enc.district)) return toast.error("Choose province and district for the referral");
    if (!enc.facility || !enc.visitType) return toast.error("Choose location and visit type");
    if (!enc.disease) {
      if (!canAccessDisease("suspect")) {
        return toast.error("Choose where to go — Suspect screening is not available for your access");
      }
      // Suspect screening — navigate with visit context for HMIS save
      const locationId = enc.locationId || facilities.find((f) => f.name === enc.facility)?.id || "";
      const q = new URLSearchParams({
        fac: enc.facility || "",
        vt: enc.visitType || "",
        ref: enc.referral || "No",
        date: visitDate || localISODate(),
        loc: locationId,
        new: String(Date.now()),
      });
      setEnc({ ...enc, show: false, date: visitDate });
      navigate(`/patients/${p.id}/suspect?${q.toString()}`, withFrom());
      return;
    }
    if (EXTRA_IDS.includes(enc.disease)) {
      if (starting) return;
      setStarting(true);
      try {
        const locationId = enc.locationId || facilities.find((f) => f.name === enc.facility)?.id;
        const extra = EXTRA_CONDITIONS.find((c) => c.id === enc.disease);
        let result;
        if (enc.mode === "encounter" && enc.recordId) {
          result = await addEncounter({
            patientId: p.id,
            recordId: enc.recordId,
            disease: enc.disease,
            visitType: enc.visitType,
            locationId,
            locationName: enc.facility,
            visitDate,
            referral: enc.referral,
            clinicianName: user?.name,
          });
          toast.success("Encounter visit created");
        } else {
          result = await startEpisode({
            patientId: p.id,
            disease: enc.disease,
            visitType: enc.visitType,
            locationId,
            locationName: enc.facility,
            visitDate,
            referral: enc.referral,
            clinicianName: user?.name,
          });
          toast.success(`${extra?.name || "Episode"} started`);
        }
        const visitId = result.visitId || result.encounter?.id;
        setEnc({ ...enc, show: false, mode: "episode", recordId: "", date: visitDate });
        const q = new URLSearchParams({
          enc: String(visitId || ""),
          fac: enc.facility || "",
          vt: enc.visitType || "",
          ref: enc.referral || "No",
        });
        navigate(`/patients/${p.id}/${extra.route}?${q.toString()}`, withFrom());
      } catch (err) {
        toast.error(err?.message || (enc.mode === "encounter" ? "Failed to add encounter" : "Failed to start episode"));
      } finally {
        setStarting(false);
      }
      return;
    }
    if (starting) return;
    setStarting(true);
    try {
      const locationId = enc.locationId || facilities.find((f) => f.name === enc.facility)?.id;
      let result;
      if (enc.mode === "encounter" && enc.recordId) {
        result = await addEncounter({
          patientId: p.id,
          recordId: enc.recordId,
          disease: enc.disease,
          visitType: enc.visitType,
          locationId,
          locationName: enc.facility,
          visitDate,
          referral: enc.referral,
          clinicianName: user?.name,
        });
        toast.success("Encounter visit created");
      } else {
        result = await startEpisode({
          patientId: p.id,
          disease: enc.disease,
          visitType: enc.visitType,
          locationId,
          locationName: enc.facility,
          visitDate,
          referral: enc.referral,
          clinicianName: user?.name,
        });
        toast.success(`${DISEASE_SPECS[enc.disease]?.name || "Episode"} started`);
      }
      const visitId = result.visitId || result.encounter?.id;
      setEnc({ ...enc, show: false, mode: "episode", recordId: "", date: visitDate });
      navigate(
        `/patients/${p.id}/encounter/${enc.disease}?enc=${encodeURIComponent(visitId)}&fac=${encodeURIComponent(enc.facility)}&vt=${encodeURIComponent(enc.visitType)}&ref=${enc.referral}`,
        withFrom()
      );
    } catch (err) {
      toast.error(err?.message || (enc.mode === "encounter" ? "Failed to add encounter" : "Failed to start episode"));
    } finally {
      setStarting(false);
    }
  };

  const start = () => {
    if (enc.mode !== "encounter" && enc.disease && activeDiseaseIds.has(enc.disease)) {
      return toast.error("This disease already has an active episode — close it first or choose another");
    }
    if (enc.referral === "Yes" && (!enc.province || !enc.district)) return toast.error("Choose province and district for the referral");
    if (!enc.facility || !enc.visitType) return toast.error("Choose location and visit type");
    gateAppointmentDate(enc.date, (resolvedDate) => {
      void runStart(resolvedDate);
    });
  };

  const openPendingVisit = (v) => {
    const dest = EXTRA_IDS.includes(v.disease)
      ? (() => {
          const extra = EXTRA_CONDITIONS.find((c) => c.id === v.disease);
          const q = new URLSearchParams({
            enc: String(v.id || ""),
            fac: v.facility || "",
            vt: v.type || "",
            ref: v.referral || "No",
          });
          return `/patients/${p.id}/${extra?.route || "encounter"}?${q.toString()}`;
        })()
      : `/patients/${p.id}/encounter/${v.disease}?enc=${encodeURIComponent(v.id)}&fac=${encodeURIComponent(v.facility || "")}&vt=${encodeURIComponent(v.type || "")}&ref=${v.referral || "No"}`;
    gateAppointmentDate(v.date, async (resolvedDate) => {
      if (resolvedDate && visitDay(v.date) !== resolvedDate && typeof saveEncounter === "function") {
        try {
          await saveEncounter({ ...v, date: `${resolvedDate}T12:00:00` });
        } catch (err) {
          console.warn("Could not update visit date", err);
        }
      }
      navigate(dest, withFrom());
    });
  };

  const openAddEncounter = () => {
    if (!canEdit || !selectedEpisode) return;
    const seed = [...(selectedEpisode.visits || [])]
      .slice()
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))[0]
      || selectedEpisode.visits?.[0];
    const facility = seed?.facility || "";
    const locationId = seed?.locationId || facilities.find((f) => f.name === facility)?.id || "";
    setEnc({
      ...enc,
      show: true,
      mode: "encounter",
      recordId: selectedEpisode.id,
      disease: activeTab,
      facility,
      locationId,
      visitType: "",
      referral: seed?.referral || "No",
      date: localISODate(),
      province: "",
      district: "",
      prevFacility: facility,
      prevLocationId: locationId,
    });
  };

  /** ANC / Well Baby / Malnutrition — same Add Encounter dialog as skin NTDs, Go to locked. */
  const openProgramEncounter = (diseaseId, episode) => {
    if (!canEdit) return;
    const seed = episode
      ? [...(episode.visits || [])]
          .slice()
          .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))[0]
          || episode.visits?.[0]
      : null;
    const facility = seed?.facility || "";
    const locationId = seed?.locationId || facilities.find((f) => f.name === facility)?.id || "";
    setEnc({
      ...enc,
      show: true,
      mode: "encounter",
      recordId: episode?.id || "",
      disease: diseaseId,
      facility,
      locationId,
      visitType: "",
      referral: seed?.referral || "No",
      date: localISODate(),
      province: "",
      district: "",
      prevFacility: facility,
      prevLocationId: locationId,
    });
  };

  const diseaseLabel = (diseaseId) =>
    EXTRA_CONDITIONS.find((c) => c.id === diseaseId)?.name ||
    DISEASE_SPECS[diseaseId]?.name ||
    diseaseId ||
    "this disease";

  const openFeatureEncounter = (visit, featureKey) => {
    if (!canEdit) return;
    const target = visit || selectedEpisode?.visits?.[0];
    if (!target) {
      setEnc((s) => ({ ...s, show: true, disease: activeTab !== "suspect" && DISEASE_SPECS[activeTab] ? activeTab : s.disease }));
      return;
    }
    const disease = target.disease || activeTab;
    const section = featureSectionNumber(featureKey, disease);
    navigate(`/patients/${p.id}/encounter/${disease}?enc=${encodeURIComponent(target.id)}&section=${section}`, withFrom());
  };

  const tabs = [...(hasSuspects ? [["suspect", "Suspect"]] : []), ...myDiseases.map((d) => [d.id, d.name]), ...presentExtras.map((c) => [c.id, c.name])];
  const allExpanded = featureRows.length > 0 && featureRows.every((f) => featureOpen[f.k] !== false);

  const printVisitSummary = () => {
    if (!selectedEpisode && featureRows.length === 0) {
      toast.error("No visit summary to print yet");
      return;
    }
    const diseaseName = DISEASE_SPECS[activeTab]?.name || activeTab;
    const epNo = selectedEpisode
      ? episodeNumber(episodesByDisease[activeTab], selectedEpisode.id)
      : "";
    const episodeCaption = selectedEpisode
      ? `Episode ${epNo} · ${visitLabel(selectedEpisode.visitCount)}`
      : "";
    const episodeDates = selectedEpisode
      ? episodeDateParts(selectedEpisode)
          .map((d) => `${d.label}: ${d.value}`)
          .join(" · ")
      : "";
    const apptRaw = selectedEpisode?.last || selectedEpisode?.start || "";
    const apptDate = (() => {
      if (!apptRaw) return "";
      const d = new Date(/T/.test(apptRaw) ? apptRaw : `${apptRaw}T12:00:00`);
      if (Number.isNaN(d.getTime())) return fmtDate(apptRaw);
      const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
      return `${d.getDate()} ${m} ${d.getFullYear()}`;
    })();
    const clinicAddress = [
      branding?.address,
      [p?.village, p?.district, p?.province].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join(branding?.address ? " · " : "") || "";
    const html = buildVisitSummaryPrintHtml({
      patient: {
        ...p,
        ageLabel: patientAgeLabel(p),
      },
      clinic: {
        name: branding?.clientName || p?.facility || "Clinic",
        phone: branding?.phone || "",
        email: branding?.email || "",
        address: clinicAddress,
      },
      clinician: {
        name: user?.name || "",
        specialty: user?.role || user?.specialty || "",
        appointmentDate: apptDate,
      },
      diseaseName,
      episode: selectedEpisode
        ? {
            diagnosis: selectedEpisode.diagnosis,
            outcome: episodeStatus(selectedEpisode.outcome),
          }
        : null,
      episodeCaption,
      episodeDates,
      featureRows,
      worker: user?.name || "",
    });
    setPrintPreviewHtml(html);
  };
  printVisitSummaryRef.current = printVisitSummary;

  /** Visit summary for Ante Natal / Well Baby / Malnutrition dashboards. */
  const printProgramVisitSummary = ({ diseaseName, episode, visits, caption, dates }) => {
    const visitList = (visits || []).filter(Boolean);
    if (!visitList.length) return;
    const apptRaw = episode?.last || episode?.start || visitList[0]?.date || "";
    const apptDate = (() => {
      if (!apptRaw) return "";
      const d = new Date(/T/.test(apptRaw) ? apptRaw : `${apptRaw}T12:00:00`);
      if (Number.isNaN(d.getTime())) return fmtDate(apptRaw);
      const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
      return `${d.getDate()} ${m} ${d.getFullYear()}`;
    })();
    const clinicAddress = [
      branding?.address,
      [p?.village, p?.district, p?.province].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join(branding?.address ? " · " : "") || "";
    const html = buildVisitSummaryPrintHtml({
      patient: {
        ...p,
        ageLabel: patientAgeLabel(p),
      },
      clinic: {
        name: branding?.clientName || p?.facility || "Clinic",
        phone: branding?.phone || "",
        email: branding?.email || "",
        address: clinicAddress,
      },
      clinician: {
        name: user?.name || "",
        specialty: user?.role || user?.specialty || "",
        appointmentDate: apptDate,
      },
      diseaseName: diseaseName || "Program",
      episode: episode
        ? {
            diagnosis: episode.diagnosis,
            outcome: episodeStatus(episode.outcome),
          }
        : null,
      episodeCaption: caption || "",
      episodeDates: dates || "",
      featureRows: featureRowsFromVisits(visitList),
      worker: user?.name || "",
    });
    setPrintPreviewHtml(html);
  };

  const actions = (
    <div className="flex shrink-0 flex-wrap justify-end gap-2" data-testid="record-actions">
      {myDiseases.some((x) => x.id === activeTab) && selectedEpisode && (
        <Button
          type="button"
          variant="outline"
          className="h-11"
          data-testid="print-visit-summary-btn"
          onClick={printVisitSummary}
        >
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      )}
      <Button
        className="h-11"
        data-testid="add-encounter-btn"
        disabled={!canEdit}
        onClick={() =>
          setEnc({
            ...enc,
            show: true,
            mode: "episode",
            recordId: "",
            disease: defaultGoToDiseaseId,
          })
        }
      >
        <Plus className="h-4 w-4" /> Episode
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
      <Button variant="outline" className="h-11" data-testid="back-btn" onClick={() => navigate(backTo)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
    </div>
  );

  return (
    <AppShell>
      <div className={`grid gap-6 ${lhs ? "lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
        {lhs && (
          <PatientSidebar
            patient={p}
            encounters={encs}
            diseases={sidebarDiseases}
            onCollapse={() => setLhs(false)}
            onEdit={
              canEditPatientDetails
                ? () => navigate(`/patients/${p.id}/edit`)
                : canEdit
                  ? () =>
                      toast.error(
                        !online
                          ? "Go online to edit patient details"
                          : "Sync this patient first, then edit"
                      )
                  : undefined
            }
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
                  <p className="truncate text-xs text-muted-foreground">
                    {p.patientCode ? `PID ${p.patientCode}` : "PID —"}
                  </p>
                </div>
              </>
            )}
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto" data-testid="record-tabs">
              {tabs.map(([k, label]) => {
                if (k === "suspect" || EXTRA_IDS.includes(k)) {
                  return (
                    <button key={k} data-testid={`tab-${k}`} onClick={() => selectTab(k)}
                      className={`h-11 shrink-0 rounded-md border px-4 text-sm font-semibold ${activeTab === k ? "border-primary bg-primary text-white" : "border-border bg-white text-muted-foreground hover:bg-muted"}`}>{label}</button>
                  );
                }
                const episodes = episodesByDisease[k] || [];
                const current = episodes.find((e) => e.id === episodeSel[k]) || episodes[0];
                const visits = current ? visitLabel(current.visitCount) : "";
                const active = activeTab === k;
                const tabCls = `h-11 shrink-0 rounded-md border text-sm font-semibold ${active ? "border-primary bg-primary text-white" : "border-border bg-white text-muted-foreground hover:bg-muted"}`;
                if (episodes.length > 1) {
                  return (
                    <div key={k} className="flex shrink-0">
                      <button
                        type="button"
                        data-testid={`tab-${k}`}
                        onClick={() => selectTab(k)}
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
                            onClick={() => selectTab(k)}
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
                                selectTab(k);
                                setEpisodeSel((s) => ({ ...s, [k]: ep.id }));
                              }}
                            >
                              <span className="font-semibold">Episode {episodeNumber(episodes, ep.id)} · {visitLabel(ep.visitCount)}</span>
                              <span className="text-xs text-muted-foreground">
                                {episodeDateParts(ep).map((d) => `${d.label}: ${d.value}`).join(" · ")}
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
                  <button key={k} data-testid={`tab-${k}`} onClick={() => selectTab(k)}
                    className={`${tabCls} px-4`}>{label}{visits ? ` · ${visits}` : ""}</button>
                );
              })}
            </div>
            {actions}
          </div>

          {!canEdit && <div className="mb-4"><AlertPanel level="review" title="View-only access" testid="readonly-alert">Your access level allows viewing this record but not editing.</AlertPanel></div>}

          {!hasSuspects && myDiseases.length === 0 && presentExtras.length === 0 && (
            <AlertPanel level="info" title="No encounters yet" testid="no-encounters">
              Click Encounter to start suspect screening, then continue with the procedure.
            </AlertPanel>
          )}

          {activeTab === ANTENATAL_ID && isExtra(ANTENATAL_ID) && (
            <AntenatalDashboard
              patient={p}
              encounters={encs}
              canEdit={canEdit}
              onEdit={(v, section) => {
                const q = new URLSearchParams({ enc: v.id });
                if (section) q.set("section", String(section));
                navigate(`/patients/${p.id}/antenatal?${q.toString()}`);
              }}
              onAddVisit={(episode) => openProgramEncounter(ANTENATAL_ID, episode)}
              onPrint={printProgramVisitSummary}
            />
          )}
          {activeTab === WELLBABY_ID && isExtra(WELLBABY_ID) && (
            <WellBabyDashboard
              patient={p}
              encounters={encs}
              settings={settings}
              canEdit={canEdit}
              onEdit={(v, section) => {
                const q = new URLSearchParams({ enc: v.id });
                if (section) q.set("section", String(section));
                navigate(`/patients/${p.id}/wellbaby?${q.toString()}`);
              }}
              onAddVisit={(episode) => openProgramEncounter(WELLBABY_ID, episode)}
              onPrint={printProgramVisitSummary}
            />
          )}
          {activeTab === MAL_ID && isExtra(MAL_ID) && (
            <MalnutritionDashboard
              patient={p}
              encounters={encs}
              canEdit={canEdit}
              onEdit={(v) => navigate(`/patients/${p.id}/malnutrition?enc=${encodeURIComponent(v.id)}`)}
              onAddVisit={(episode) => openProgramEncounter(MAL_ID, episode)}
              onPrint={printProgramVisitSummary}
            />
          )}

          {activeTab === "suspect" && hasSuspects && (
            <div className="space-y-3" data-testid="suspect-tab">
              {mySuspects.map((s) => {
                const linkedDisease =
                  (s.disease && DISEASE_SPECS[s.disease] && s.disease) ||
                  (s.suspect !== "none" && DISEASE_SPECS[s.suspect] ? s.suspect : null);
                const linkedVisit =
                  (s.visitId &&
                    encs.find(
                      (e) =>
                        (e.id === s.visitId || e.visitId === s.visitId) &&
                        (!linkedDisease || e.disease === linkedDisease)
                    )) ||
                  (linkedDisease &&
                    s.recordId &&
                    encs.find(
                      (e) =>
                        e.disease === linkedDisease &&
                        (e.recordId === s.recordId || e.episodeId === s.recordId) &&
                        e.pendingStart
                    )) ||
                  (linkedDisease &&
                    encs.find((e) => e.disease === linkedDisease && e.pendingStart)) ||
                  null;
                const visitCompleted =
                  linkedVisit &&
                  linkedVisit.pendingStart !== true &&
                  (linkedVisit.complete === true || linkedVisit.status === "Complete");
                const canStartLinkedVisit =
                  !!linkedDisease &&
                  !!canEdit &&
                  !visitCompleted &&
                  !!(linkedVisit?.pendingStart || linkedVisit?.id || s.visitId);
                const startEncId = linkedVisit?.id || s.visitId || "";
                const startDisease = linkedVisit?.disease || linkedDisease;

                return (
                <div key={s.id} className="rounded-lg border border-border bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {fmtDate(s.date)} ·{" "}
                        {s.suspect === "none"
                          ? "Suspect Non-NTDs Skin Condition"
                          : `${DISEASE_SPECS[s.suspect]?.name || linkedDisease} suspected`}
                      </p>
                      {s.symptoms?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-muted-foreground">Presenting Complaints / Symptoms</p>
                          <p className="mt-1 text-sm font-medium">{s.symptoms.join(" · ")}</p>
                        </div>
                      )}
                      {s.notes ? (
                        <p className="mt-2 text-sm text-muted-foreground">{s.notes}</p>
                      ) : null}
                      {canStartLinkedVisit && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {DISEASE_SPECS[startDisease]?.name || startDisease} visit is ready — continue to complete the entry form.
                        </p>
                      )}
                    </div>
                    {canStartLinkedVisit && startEncId && (
                      <Button
                        className="h-11 shrink-0"
                        data-testid={`start-suspect-visit-${s.id}`}
                        onClick={() =>
                          navigate(
                            `/patients/${p.id}/encounter/${startDisease}?enc=${encodeURIComponent(startEncId)}&fac=${encodeURIComponent(linkedVisit?.facility || "")}&vt=${encodeURIComponent(linkedVisit?.type || "")}&ref=${linkedVisit?.referral || "No"}`,
                            withFrom()
                          )
                        }
                      >
                        Start visit
                      </Button>
                    )}
                    {canEdit &&
                      !canStartLinkedVisit &&
                      linkedDisease &&
                      !encs.some((e) => e.disease === linkedDisease) && (
                      <Button
                        variant="outline"
                        className="h-11 shrink-0"
                        data-testid={`start-flow-${s.id}`}
                        onClick={() => setEnc({ ...enc, show: true, disease: linkedDisease })}
                      >
                        Start {DISEASE_SPECS[linkedDisease].name} flow
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
                );
              })}
            </div>
          )}

          {myDiseases.some((x) => x.id === activeTab) && (
            <div className="space-y-4" data-testid={`condition-tab-${activeTab}`}>
              {selectedEpisode && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-secondary px-4 py-3" data-testid="episode-summary">
                  <div>
                    <p className="font-semibold">
                      Episode {episodeNumber(episodesByDisease[activeTab], selectedEpisode.id)}
                      {" · "}{visitLabel(selectedEpisode.visitCount)}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">
                      {episodeDateParts(selectedEpisode).map((d, i) => (
                        <Fragment key={d.k}>
                          {i > 0 && " · "}
                          <span data-testid={`episode-${d.k}-date`}>{d.label}: {d.value}</span>
                        </Fragment>
                      ))}
                      {selectedEpisode.diagnosis ? ` · ${selectedEpisode.diagnosis}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canEdit && !isEpisodeClosed(selectedEpisode.outcome) && (
                      <Button
                        variant="outline"
                        className="h-9 border-primary/30 bg-white/80 px-3 text-primary hover:bg-white"
                        data-testid="add-visit-to-episode-btn"
                        onClick={openAddEncounter}
                      >
                        <Plus className="mr-1 h-4 w-4" /> Encounter
                      </Button>
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
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-white/70 text-primary hover:bg-white"
                      >
                        {allExpanded ? <UnfoldLessIcon className="h-5 w-5" /> : <UnfoldMoreIcon className="h-5 w-5" />}
                      </button>
                    )}
                    <Badge
                      variant="outline"
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${episodeStatusChipClass(episodeStatus(selectedEpisode.outcome))}`}
                      data-testid="episode-status-chip"
                    >
                      {episodeStatus(selectedEpisode.outcome)}
                    </Badge>
                  </div>
                </div>
              )}

              {pendingVisits.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-white px-4 py-3"
                  data-testid={`pending-visit-${v.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">Visit ready to start</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {fmtDate(v.date)}
                      {v.type ? ` · ${v.type}` : ""}
                      {v.facility ? ` · ${v.facility}` : ""}
                      {" · "}A visit was created for this episode. Continue to complete the entry form.
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      className="h-11 shrink-0"
                      data-testid={`start-pending-visit-${v.id}`}
                      onClick={() => openPendingVisit(v)}
                    >
                      Start visit
                    </Button>
                  )}
                </div>
              ))}
              {featureRows.map(({ k, label, rows }) => {
                const isOpen = featureOpen[k] !== false;
                const exams = k === "marks" ? uniqueExamChips(rows) : [];
                const last = exams[0] || rows[0]?.e;
                const lastAt = last?.date ? fmtDateTime(last.date) : "";
                const entryCount = exams.length || rows.length;
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
                          exams.map((exam) => {
                            const examVisit = (selectedEpisode?.visits || []).find((v) => v.id === exam.encounterId)
                              || encounters.find((v) => v.id === exam.encounterId);
                            return (
                              <div key={exam.id} className="px-4 py-3" data-testid={`exam-entry-${exam.id}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
                                    <span>{examChipLabel(exam)} · {exam.worker}</span>
                                    {isEditedSection(examVisit, "marks") && <EditedBadge />}
                                  </p>
                                  {canEdit && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 text-primary"
                                      data-testid={`feature-edit-marks-${exam.id}`}
                                      aria-label="Edit examination"
                                      onClick={() => openFeatureEncounter(examVisit, "marks")}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                <ExamSummary
                                  exam={exam}
                                  onOpenPhotos={(photos, index) => setPhotoView({ photos, index })}
                                />
                              </div>
                            );
                          })
                        ) : k === "adherence" && activeTab === "leprosy" ? (
                          <div className="px-4 py-3" data-testid="feature-adherence-leprosy">
                            <div className="flex items-start justify-between gap-2">
                              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
                                <span>
                                  {rows[0]?.e
                                    ? `${entryDateTime(rows[0].e.date, rows[0].e.editedAt)} · ${rows[0].e.worker} · ${rows[0].e.type}`
                                    : "MDT adherence"}
                                </span>
                                {rows.some(({ e }) => isEditedSection(e, "adherence")) && <EditedBadge />}
                              </p>
                              {canEdit && rows[0]?.e && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-primary"
                                  data-testid="feature-edit-adherence"
                                  aria-label="Edit adherence"
                                  onClick={() => openFeatureEncounter(rows[0].e, "adherence")}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <LeprosyAdherenceDashboard
                              visits={rows.map(({ e }) => e)}
                              diagnosis={rows[0]?.s?.diagnosis || selectedEpisode?.diagnosis || ""}
                            />
                          </div>
                        ) : (
                          rows.map(({ e, s }) => (
                            <div key={e.id} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
                                  <span>{entryDateTime(isEditedSection(e, k) ? e.editedAt : e.date, e.date)} · {e.worker} · {e.type}</span>
                                  {isEditedSection(e, k) && <EditedBadge />}
                                </p>
                                {canEdit && (
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
              {!selectedEpisode && pendingVisits.length === 0 && (
                <AlertPanel level="info" title={`No ${DISEASE_SPECS[activeTab].name} data yet`} testid="empty-condition">Add an encounter to start this condition record.</AlertPanel>
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
              Photograph{photoCount > 1 ? ` · ${photoIndex + 1} of ${photoCount}` : ""}
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

      <Dialog open={enc.show} onOpenChange={(o) => setEnc({ ...enc, show: o, ...(o ? {} : { mode: "episode", recordId: "" }) })}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md" data-testid="add-encounter-dialog">
          <DialogHeader>
            <DialogTitle className="font-head text-xl">
              {enc.mode === "encounter" ? "Add Encounter" : "Add Episode"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <TextField label="Date" type="date" testid="encounter-date-input" value={enc.date} onChange={(e) => setEnc({ ...enc, date: e.target.value })} hint={fmtDate(enc.date)} />
            <TextField label="Clinician" testid="encounter-clinician" value={user?.name || ""} readOnly />
            <SelectField label="Visit type" options={settings.visitTypes} value={enc.visitType} onChange={(v) => setEnc({ ...enc, visitType: v })} testid="encounter-visit-type-select" />
            {enc.mode !== "encounter" && (
              <ChoiceRow
                label="Referral"
                options={["Yes", "No"]}
                value={enc.referral}
                onChange={(v) =>
                  setEnc((s) => {
                    const referral = v || "No";
                    if (referral === "Yes") {
                      return {
                        ...s,
                        referral,
                        province: "",
                        district: "",
                        facility: "",
                        locationId: "",
                        prevFacility: s.facility || s.prevFacility,
                        prevLocationId: s.locationId || s.prevLocationId,
                      };
                    }
                    return {
                      ...s,
                      referral,
                      province: "",
                      district: "",
                      facility: s.prevFacility || s.facility,
                      locationId: s.prevLocationId || s.locationId,
                      prevFacility: "",
                      prevLocationId: "",
                    };
                  })
                }
                testid="encounter-referral"
              />
            )}
            {enc.mode !== "encounter" && enc.referral === "Yes" && (
              <>
                <SelectField
                  label="Province"
                  options={Object.keys(GEO)}
                  value={enc.province}
                  onChange={(v) => setEnc({ ...enc, province: v, district: "", facility: "", locationId: "" })}
                  testid="encounter-referral-province"
                />
                <SelectField
                  label="District"
                  options={referralDistricts}
                  value={enc.district}
                  onChange={(v) => setEnc({ ...enc, district: v, facility: "", locationId: "" })}
                  testid="encounter-referral-district"
                />
              </>
            )}
            <SelectField
              label="Location / facility"
              options={locationOptions}
              value={enc.facility}
              onChange={(v) => {
                if (enc.mode === "encounter") return;
                const loc = locationFacilities.find((f) => f.name === v);
                setEnc({ ...enc, facility: v, locationId: loc?.id || "" });
              }}
              testid="encounter-facility-select"
              hint={
                enc.mode === "encounter"
                  ? "Using the location from this episode"
                  : enc.referral === "Yes" && !enc.district
                    ? "Select province and district to see referral locations"
                    : enc.referral === "Yes" && locationOptions.length === 0
                      ? "No facilities listed for this district"
                      : undefined
              }
            />
            <SelectField
              label="Go to"
              options={
                enc.mode === "encounter"
                  ? [diseaseLabel(enc.disease)].filter(Boolean)
                  : episodeGoToOptions
              }
              value={
                enc.mode === "encounter"
                  ? diseaseLabel(enc.disease)
                  : enc.disease && !activeDiseaseIds.has(enc.disease)
                    ? diseaseLabel(enc.disease) || episodeGoToOptions[0] || ""
                    : !enc.disease && canAccessDisease("suspect") && episodeGoToOptions[0] === "Suspect screening"
                      ? "Suspect screening"
                      : episodeGoToOptions[0] || ""
              }
              onChange={(v) => {
                if (enc.mode === "encounter") return;
                setEnc({
                  ...enc,
                  disease: goToLabelToDiseaseId(v),
                });
              }}
              testid="encounter-target-select"
              hint={
                enc.mode === "encounter"
                  ? `Locked to ${diseaseLabel(enc.disease)} episode`
                  : activeDiseaseIds.size
                    ? "Active diseases are hidden — close the episode to start a new one"
                    : undefined
              }
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12" data-testid="encounter-cancel" onClick={() => setEnc({ ...enc, show: false, mode: "episode", recordId: "" })}>Cancel</Button>
            <Button className="h-12" data-testid="encounter-start" disabled={starting} onClick={start}>
              {starting
                ? "Starting…"
                : enc.mode === "encounter"
                  ? "Start Encounter"
                  : "Start Episode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(printPreviewHtml)} onOpenChange={(o) => !o && setPrintPreviewHtml("")}>
        <DialogContent
          className="flex max-h-[92vh] w-[min(960px,calc(100vw-1rem))] max-w-[min(960px,calc(100vw-1rem))] flex-col gap-3 overflow-hidden p-3 sm:p-4"
          data-testid="visit-summary-preview-dialog"
        >
          <DialogHeader className="shrink-0 space-y-1 pr-8">
            <DialogTitle className="font-head text-lg sm:text-xl">Visit Summary</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-white">
            {printPreviewHtml ? (
              <iframe
                title="Visit summary preview"
                srcDoc={printPreviewHtml}
                className="h-[min(70vh,720px)] w-full border-0 bg-white"
                data-testid="visit-summary-preview-frame"
              />
            ) : null}
          </div>
          <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto"
              data-testid="visit-summary-preview-close"
              onClick={() => setPrintPreviewHtml("")}
            >
              Close
            </Button>
            <Button
              className="h-11 w-full sm:w-auto"
              data-testid="visit-summary-preview-print"
              onClick={() => {
                if (!printHtmlDocument(printPreviewHtml)) {
                  toast.error("Could not prepare print view");
                }
              }}
            >
              <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {appointmentDateDialog}
    </AppShell>
  );
}
