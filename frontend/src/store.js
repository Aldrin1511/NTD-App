import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SYMPTOMS, SUSPECTS, FACILITIES_LIST, DRUGS, VISIT_TYPES, DEFAULT_LTFU } from "@/mock/data";
import { SUSPECT_SYMPTOMS } from "@/mock/specs";
import { USERS, PATIENTS, ENCOUNTERS, HOUSEHOLDS } from "@/mock/data";
import { DEFAULT_IMMUNIZATION_SCHEDULES, DEFAULT_LAB_MASTER, DEFAULT_FEATURE_CONFIG } from "@/mock/masters";

const KEY = "trias.state.v3";
const Ctx = createContext(null);

const initial = () => ({
  users: USERS,
  patients: PATIENTS,
  encounters: ENCOUNTERS,
  households: HOUSEHOLDS,
  suspects: SUSPECTS,
  facilities: FACILITIES_LIST,
  settings: { symptoms: SUSPECT_SYMPTOMS, drugs: DRUGS, visitTypes: VISIT_TYPES, ltfuByDisease: DEFAULT_LTFU, lostToFollowUpDays: 30, immunizationSchedules: DEFAULT_IMMUNIZATION_SCHEDULES, labMaster: DEFAULT_LAB_MASTER, featureConfig: DEFAULT_FEATURE_CONFIG, regimens: [
    { id: "R-001", name: "Scabies — topical first line", disease: "scabies", diagnosis: "Confirmed Scabies", ageMin: 0, ageMax: 120, weightMin: 0, weightMax: 200, frequency: "Every night at bedtime", duration: 1, durationUnit: "Week(s)", drugs: ["Permethrin 5% Cream/Lotion"] },
    { id: "R-001b", name: "Scabies — topical first line", disease: "scabies", diagnosis: "Suspected Scabies", ageMin: 0, ageMax: 120, weightMin: 0, weightMax: 200, frequency: "Every night at bedtime", duration: 1, durationUnit: "Week(s)", drugs: ["Permethrin 5% Cream/Lotion"] },
    { id: "R-002", name: "Scabies — oral ivermectin", disease: "scabies", diagnosis: "Crusted Scabies", ageMin: 5, ageMax: 120, weightMin: 15, weightMax: 200, frequency: "Once", duration: 2, durationUnit: "Week(s)", drugs: ["Tab Ivermectin (0.2 mg/kg)"] },
    { id: "R-003", name: "Buruli — RC 8 weeks", disease: "buruli", diagnosis: "", ageMin: 0, ageMax: 120, weightMin: 0, weightMax: 200, duration: 8, durationUnit: "Week(s)", drugs: ["Tab Rifampicin 300mg (10mg per Kg)", "Tab Clarithromycin 500mg (7.5mg per kg)"] },
    { id: "R-004", name: "Leprosy MDT — blister pack", disease: "leprosy", diagnosis: "", ageMin: 0, ageMax: 120, weightMin: 0, weightMax: 200, drugs: ["Multi-Drug Therapy (MDT) Blister pack"] },
    { id: "R-005", name: "Yaws — azithromycin single dose", disease: "yaws", diagnosis: "", ageMin: 0, ageMax: 120, weightMin: 0, weightMax: 200, frequency: "STAT", durationUnit: "BOLUS", drugs: ["Tab Azithromycin 500mg (30mg per Kg)"] },
    { id: "R-006", name: "LF — IDA (Ivermectin + DEC + Albendazole)", disease: "lf", diagnosis: "", ageMin: 5, ageMax: 120, weightMin: 15, weightMax: 200, frequency: "STAT", duration: 1, durationUnit: "Day(s)", drugs: ["Tab Ivermectin (0.2 mg/kg)", "Tab DEC 100mg (6 mg/kg)", "Tab Albendazole 200mg"] },
  ] },
  schoolHealth: [],
  currentUserId: null,
  branding: {
    clientName: "PNG National NTD Programme",
    programme: "Skin NTD Control — Momase Region",
    logo: "",
    primary: "#0F52BA",
  },
  pendingSync: 3,
});

const load = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const merged = { ...initial(), ...saved };
      merged.settings = { ...initial().settings, ...(saved.settings || {}) };
      if (!Array.isArray(merged.schoolHealth)) merged.schoolHealth = [];
      const have = new Set((merged.encounters || []).map((e) => e.id));
      const extra = ENCOUNTERS.filter((e) => !have.has(e.id));
      if (extra.length) merged.encounters = [...(merged.encounters || []), ...extra];
      const seedRegimens = initial().settings.regimens || [];
      const savedRegimens = merged.settings?.regimens;
      if (Array.isArray(savedRegimens) && seedRegimens.length) {
        const byId = Object.fromEntries(seedRegimens.map((r) => [r.id, r]));
        merged.settings = {
          ...merged.settings,
          regimens: savedRegimens.map((r) => {
            const seed = byId[r.id];
            if (!seed) return r;
            return {
              ...r,
              frequency: r.frequency || seed.frequency || "",
              duration: r.duration || seed.duration || "",
              durationUnit: r.durationUnit || seed.durationUnit || "",
            };
          }),
        };
      }
      const seedDrugs = initial().settings.drugs || [];
      const savedDrugs = merged.settings?.drugs;
      if (Array.isArray(savedDrugs) && seedDrugs.length) {
        const byName = Object.fromEntries(seedDrugs.map((d) => [d.name, d]));
        merged.settings = {
          ...merged.settings,
          drugs: savedDrugs.map((d) => {
            const seed = byName[d.name];
            if (!seed) return d;
            return {
              ...d,
              dosage: d.dosage || seed.dosage || "",
              frequency: d.frequency || seed.frequency || "",
              duration: d.duration || seed.duration || "",
              durationUnit: d.durationUnit || seed.durationUnit || "",
            };
          }),
        };
      }
      return merged;
    }
  } catch (e) {}
  return initial();
};

const queuedCount = (s) => {
  const enc = (s.encounters || []).filter((e) => !e.synced).length;
  return Math.max(Number(s.pendingSync) || 0, enc);
};

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncPrompt, setSyncPrompt] = useState(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => {
      setOnline(false);
      setSyncPrompt(null);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const patch = (fn) => setState((s) => ({ ...s, ...fn(s) }));
  const offerSyncAfterSave = (_count) => {
    // Temporarily hide the "Sync pending items?" popup after Save / Save & close.
  };

  const api = useMemo(() => {
    const user = state.users.find((u) => u.id === state.currentUserId) || null;

    const visiblePatients = () => {
      if (!user) return [];
      if (user.scope === "all") return state.patients;
      if (user.scope === "province") return state.patients.filter((p) => p.province === user.province);
      return state.patients.filter((p) => p.createdBy === user.id);
    };

    return {
      ...state,
      online,
      pendingSync: queuedCount(state),
      syncPrompt,
      user,
      visiblePatients,
      login: (email, password) => {
        const u = state.users.find(
          (x) => x.email.toLowerCase() === String(email).toLowerCase() && x.password === password && x.active
        );
        if (!u) return null;
        patch(() => ({ currentUserId: u.id }));
        return u;
      },
      register: (data) => {
        const u = {
          id: `u${Date.now()}`,
          role: "Health Worker",
          scope: "own",
          canEdit: true,
          active: true,
          ...data,
        };
        patch((s) => ({ users: [...s.users, u], currentUserId: u.id }));
        return u;
      },
      resetPassword: (id, password) =>
        patch((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, password } : u)) })),
      updateSettings: (changes) => patch((s) => ({ settings: { ...s.settings, ...changes } })),
      // ---- Masters: immunization schedules ----
      addImmunizationSchedule: (sch) =>
        patch((s) => ({ settings: { ...s.settings, immunizationSchedules: [...(s.settings.immunizationSchedules || []), { id: `sch-${Date.now()}`, vaccines: [], ...sch }] } })),
      updateImmunizationSchedule: (id, changes) =>
        patch((s) => ({ settings: { ...s.settings, immunizationSchedules: (s.settings.immunizationSchedules || []).map((x) => (x.id === id ? { ...x, ...changes } : x)) } })),
      removeImmunizationSchedule: (id) =>
        patch((s) => ({ settings: { ...s.settings, immunizationSchedules: (s.settings.immunizationSchedules || []).filter((x) => x.id !== id) } })),
      // ---- Masters: lab tests ----
      addLabTest: (t) =>
        patch((s) => ({ settings: { ...s.settings, labMaster: [...(s.settings.labMaster || []), { id: `lab-${Date.now()}`, results: [], location: "Bedside", ...t }] } })),
      updateLabTest: (id, changes) =>
        patch((s) => ({ settings: { ...s.settings, labMaster: (s.settings.labMaster || []).map((x) => (x.id === id ? { ...x, ...changes } : x)) } })),
      removeLabTest: (id) =>
        patch((s) => ({ settings: { ...s.settings, labMaster: (s.settings.labMaster || []).filter((x) => x.id !== id) } })),
      // ---- Masters: per-condition feature config ----
      setFeatureConfig: (condition, features) =>
        patch((s) => ({ settings: { ...s.settings, featureConfig: { ...(s.settings.featureConfig || {}), [condition]: features } } })),
      // ---- School Health ----
      addSchoolVisit: (v) => {
        const rec = { id: `SCH-${String(Math.floor(Math.random() * 900000) + 100000)}`, createdBy: state.currentUserId, worker: state.users.find((u) => u.id === state.currentUserId)?.name, children: [], report: null, status: v.status || "Planned", ...v };
        const nextPending = queuedCount(state) + 1;
        patch((s) => ({ schoolHealth: [rec, ...s.schoolHealth], pendingSync: nextPending }));
        return rec;
      },
      updateSchoolVisit: (id, changes) =>
        patch((s) => ({ schoolHealth: s.schoolHealth.map((v) => (v.id === id ? { ...v, ...changes } : v)) })),
      removeSchoolVisit: (id) => patch((s) => ({ schoolHealth: s.schoolHealth.filter((v) => v.id !== id) })),
      saveSchoolChild: (visitId, child) =>
        patch((s) => ({
          schoolHealth: s.schoolHealth.map((v) => {
            if (v.id !== visitId) return v;
            const children = v.children || [];
            if (child.id) return { ...v, children: children.map((c) => (c.id === child.id ? { ...c, ...child } : c)) };
            return { ...v, children: [...children, { ...child, id: `CH-${Date.now()}` }] };
          }),
        })),
      removeSchoolChild: (visitId, childId) =>
        patch((s) => ({ schoolHealth: s.schoolHealth.map((v) => (v.id === visitId ? { ...v, children: (v.children || []).filter((c) => c.id !== childId) } : v)) })),
      saveSchoolReport: (visitId, report) =>
        patch((s) => ({ schoolHealth: s.schoolHealth.map((v) => (v.id === visitId ? { ...v, report } : v)) })),
      addSymptom: (text) =>
        patch((s) => ({
          settings: { ...s.settings, symptoms: s.settings.symptoms.includes(text) ? s.settings.symptoms : [...s.settings.symptoms, text] },
        })),
      removeSymptom: (text) =>
        patch((s) => ({ settings: { ...s.settings, symptoms: s.settings.symptoms.filter((x) => x !== text) } })),
      addFacility: (f) =>
        patch((s) => {
          const next = s.facilities.reduce((m, x) => Math.max(m, Number(String(x.id).replace(/\D/g, "")) || 0), 0) + 1;
          return { facilities: [...s.facilities, { id: `F-${String(next).padStart(3, "0")}`, ...f }] };
        }),
      removeFacility: (id) => patch((s) => ({ facilities: s.facilities.filter((f) => f.id !== id) })),
      addDrug: (drug) => patch((s) => ({ settings: { ...s.settings, drugs: [...s.settings.drugs, drug] } })),
      removeDrug: (name) =>
        patch((s) => ({ settings: { ...s.settings, drugs: s.settings.drugs.filter((d) => d.name !== name) } })),
      addVisitType: (v) =>
        patch((s) => ({
          settings: { ...s.settings, visitTypes: s.settings.visitTypes.includes(v) ? s.settings.visitTypes : [...s.settings.visitTypes, v] },
        })),
      removeVisitType: (v) =>
        patch((s) => ({ settings: { ...s.settings, visitTypes: s.settings.visitTypes.filter((x) => x !== v) } })),
      setLtfu: (diseaseId, days) =>
        patch((s) => ({ settings: { ...s.settings, ltfuByDisease: { ...s.settings.ltfuByDisease, [diseaseId]: Number(days) || 0 } } })),
      addRegimen: (r) =>
        patch((s) => ({ settings: { ...s.settings, regimens: [...(s.settings.regimens || []), { id: `R-${String((s.settings.regimens || []).length + 101)}`, ...r, status: r.status || "Active" }] } })),
      setRegimenStatus: (id, status) =>
        patch((s) => ({
          settings: {
            ...s.settings,
            regimens: (s.settings.regimens || []).map((x) => (x.id === id ? { ...x, status } : x)),
          },
        })),
      addSuspect: (rec) => {
        const out = {
          id: `SUS-${String(Math.floor(Math.random() * 900000) + 100000)}`,
          date: new Date().toISOString(),
          worker: state.users.find((u) => u.id === state.currentUserId)?.name,
          ...rec,
        };
        const nextPending = queuedCount(state) + 1;
        patch((s) => ({
          suspects: [...s.suspects, out],
          pendingSync: nextPending,
          patients: s.patients.map((p) => {
            if (p.id !== rec.patientId) return p;
            return { ...p, status: p.status || "Suspected" };
          }),
        }));
        offerSyncAfterSave(nextPending);
        return out;
      },
      logout: () => patch(() => ({ currentUserId: null })),
      addUser: (u) =>
        patch((s) => ({ users: [...s.users, { id: `u${Date.now()}`, active: true, ...u }] })),
      updateUser: (id, changes) =>
        patch((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...changes } : u)) })),
      setBranding: (b) => patch((s) => ({ branding: { ...s.branding, ...b } })),
      addPatient: (data) => {
        const nextNum =
          state.patients.reduce((max, p) => {
            const m = String(p.id).match(/^PNG(\d+)$/i);
            return m ? Math.max(max, Number(m[1])) : max;
          }, 0) + 1;
        const rec = {
          id: `PNG${String(nextNum).padStart(7, "0")}`,
          episodeId: `SCAB-2026-${String(1240 + nextNum).padStart(8, "0")}`,
          createdBy: state.currentUserId,
          createdAt: new Date().toISOString().slice(0, 10),
          status: "",
          diseases: [],
          ...data,
          sex: data.sex || data.gender || "",
          gender: data.gender || data.sex || "",
        };
        const nextPending = queuedCount(state) + 1;
        patch((s) => ({ patients: [rec, ...s.patients], pendingSync: nextPending }));
        offerSyncAfterSave(nextPending);
        return rec;
      },
      updatePatient: (id, data) => {
        const rec = state.patients.find((p) => p.id === id);
        if (!rec) return null;
        const next = {
          ...rec,
          ...data,
          id: rec.id,
          episodeId: rec.episodeId,
          createdBy: rec.createdBy,
          createdAt: rec.createdAt,
          diseases: rec.diseases,
          status: rec.status,
          outcome: rec.outcome,
          treatmentEnd: rec.treatmentEnd,
          sex: data.sex || data.gender || rec.sex,
          gender: data.gender || data.sex || rec.gender,
          editedAt: new Date().toISOString(),
        };
        const nextPending = queuedCount(state) + 1;
        patch((s) => ({
          patients: s.patients.map((p) => (p.id === id ? next : p)),
          pendingSync: nextPending,
        }));
        offerSyncAfterSave(nextPending);
        return next;
      },
      registerBaby: (motherId, baby) => {        const mother = state.patients.find((p) => p.id === motherId);
        if (!mother) return null;
        const nextNum =
          state.patients.reduce((max, p) => {
            const m = String(p.id).match(/^PNG(\d+)$/i);
            return m ? Math.max(max, Number(m[1])) : max;
          }, 0) + 1;
        const rec = {
          id: `PNG${String(nextNum).padStart(7, "0")}`,
          episodeId: `WB-${new Date().getFullYear()}-${String(1240 + nextNum).padStart(8, "0")}`,
          createdBy: state.currentUserId,
          createdAt: new Date().toISOString().slice(0, 10),
          status: "New born",
          diseases: [],
          province: mother.province,
          district: mother.district,
          village: mother.village,
          facility: mother.facility,
          household: mother.household,
          phone: mother.phone,
          age: 0,
          bornFrom: motherId,
          ...baby,
          sex: baby.sex || "",
          gender: baby.sex || "",
        };
        const nextPending = queuedCount(state) + 1;
        patch((s) => ({ patients: [rec, ...s.patients], pendingSync: nextPending }));
        return rec;
      },
      addDisease: (patientId, diseaseId) =>
        patch((s) => ({
          patients: s.patients.map((p) =>
            p.id === patientId && !(p.diseases || []).includes(diseaseId)
              ? { ...p, diseases: [...(p.diseases || []), diseaseId] }
              : p
          ),
        })),
      saveEncounter: (enc) => {
        let saved = null;
        let nextPending = 0;
        patch((s) => {
          const existing = enc.id && s.encounters.find((e) => e.id === enc.id);
          if (existing) {
            const merged = {
              ...existing,
              ...enc,
              id: existing.id,
              date: existing.date,
              synced: false,
              editedAt: new Date().toISOString(),
              editedSections: [...new Set([...(existing.editedSections || []), ...(enc.editedSections || [])])],
            };
            saved = merged;
            const nextEncounters = s.encounters.map((e) => (e.id === merged.id ? merged : e));
            nextPending = queuedCount({ ...s, encounters: nextEncounters, pendingSync: s.pendingSync + 1 });
            return { encounters: nextEncounters, pendingSync: nextPending };
          }
          const { id: _dropId, ...rest } = enc;
          const rec = {
            id: `ENC-${String(Math.floor(Math.random() * 900000) + 100000)}`,
            date: new Date().toISOString(),
            disease: "scabies",
            synced: false,
            complete: true,
            ...rest,
          };
          saved = rec;
          const nextEncounters = [...s.encounters, rec];
          nextPending = queuedCount({ ...s, encounters: nextEncounters, pendingSync: s.pendingSync + 1 });
          return { encounters: nextEncounters, pendingSync: nextPending };
        });
        offerSyncAfterSave(nextPending);
        return saved;
      },
      dismissSyncPrompt: () => setSyncPrompt(null),
      syncNow: () => {
        if (!online) return 0;
        const n = queuedCount(state);
        if (!n) {
          setSyncPrompt(null);
          return 0;
        }
        patch((s) => ({
          pendingSync: 0,
          encounters: s.encounters.map((e) => ({ ...e, synced: true })),
        }));
        setSyncPrompt(null);
        return n;
      },
      resetDemo: () => {
        localStorage.removeItem(KEY);
        setState(initial());
      },
    };
  }, [state, online, syncPrompt]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
