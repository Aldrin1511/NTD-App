import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SYMPTOMS, SUSPECTS, FACILITIES_LIST, DRUGS, VISIT_TYPES, DEFAULT_LTFU } from "@/mock/data";
import { SUSPECT_SYMPTOMS } from "@/mock/specs";
import { USERS, PATIENTS, ENCOUNTERS, HOUSEHOLDS } from "@/mock/data";

const KEY = "trias.state.v2";
const Ctx = createContext(null);

const initial = () => ({
  users: USERS,
  patients: PATIENTS,
  encounters: ENCOUNTERS,
  households: HOUSEHOLDS,
  suspects: SUSPECTS,
  facilities: FACILITIES_LIST,
  settings: { symptoms: SUSPECT_SYMPTOMS, drugs: DRUGS, visitTypes: VISIT_TYPES, ltfuByDisease: DEFAULT_LTFU, lostToFollowUpDays: 30, regimens: [
    { id: "R-001", name: "Scabies — topical first line", disease: "scabies", diagnosis: "Confirmed Scabies", ageMin: 0, ageMax: 120, weightMin: 0, weightMax: 200, drugs: "Permethrin cream 5% (2 applications, 7 days apart)" },
    { id: "R-002", name: "Scabies — oral ivermectin", disease: "scabies", diagnosis: "Crusted Scabies", ageMin: 5, ageMax: 120, weightMin: 15, weightMax: 200, drugs: "Tab Ivermectin 0.2 mg/kg on day 1 and day 8" },
    { id: "R-003", name: "Buruli — RC 8 weeks", disease: "buruli", diagnosis: "Confirmed Buruli Ulcer", ageMin: 0, ageMax: 120, weightMin: 0, weightMax: 200, drugs: "Rifampicin 10 mg/kg + Clarithromycin 7.5 mg/kg daily × 8 weeks" },
    { id: "R-004", name: "Leprosy MDT — MB adult", disease: "leprosy", diagnosis: "Multibacillary (MB)", ageMin: 15, ageMax: 120, weightMin: 35, weightMax: 200, drugs: "Rifampicin 600mg monthly + Clofazimine + Dapsone × 12 months" },
    { id: "R-005", name: "Yaws — azithromycin single dose", disease: "yaws", diagnosis: "Primary Yaws", ageMin: 0, ageMax: 120, weightMin: 0, weightMax: 200, drugs: "Tab Azithromycin 30 mg/kg single dose" },
    { id: "R-006", name: "LF — IDA / DA", disease: "lf", diagnosis: "Confirmed Lymphatic Filariasis", ageMin: 5, ageMax: 120, weightMin: 15, weightMax: 200, drugs: "Ivermectin + DEC + Albendazole annually" },
  ] },
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
    if (raw) return { ...initial(), ...JSON.parse(raw) };
  } catch (e) {}
  return initial();
};

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const patch = (fn) => setState((s) => ({ ...s, ...fn(s) }));

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
        patch((s) => ({ settings: { ...s.settings, regimens: [...(s.settings.regimens || []), { id: `R-${String((s.settings.regimens || []).length + 101)}`, ...r }] } })),
      removeRegimen: (id) =>
        patch((s) => ({ settings: { ...s.settings, regimens: (s.settings.regimens || []).filter((r) => r.id !== id) } })),
      addSuspect: (rec) => {
        const out = {
          id: `SUS-${String(Math.floor(Math.random() * 900000) + 100000)}`,
          date: new Date().toISOString().slice(0, 16),
          worker: state.users.find((u) => u.id === state.currentUserId)?.name,
          ...rec,
        };
        patch((s) => ({ suspects: [...s.suspects, out], pendingSync: s.pendingSync + 1 }));
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
          status: "Suspected",
          diseases: ["scabies"],
          ...data,
        };
        patch((s) => ({ patients: [rec, ...s.patients], pendingSync: s.pendingSync + 1 }));
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
        const existing = enc.id && state.encounters.find((e) => e.id === enc.id);
        if (existing) {
          const merged = { ...existing, ...enc, synced: false };
          patch((s) => ({
            encounters: s.encounters.map((e) => (e.id === merged.id ? merged : e)),
            pendingSync: s.pendingSync + 1,
          }));
          return merged;
        }
        const { id: _dropId, ...rest } = enc;
        const rec = {
          id: `ENC-${String(Math.floor(Math.random() * 900000) + 100000)}`,
          date: new Date().toISOString().slice(0, 16),
          disease: "scabies",
          synced: false,
          complete: true,
          ...rest,
        };
        patch((s) => ({ encounters: [...s.encounters, rec], pendingSync: s.pendingSync + 1 }));
        return rec;
      },
      syncNow: () =>
        patch((s) => ({
          pendingSync: 0,
          encounters: s.encounters.map((e) => ({ ...e, synced: true })),
        })),
      resetDemo: () => {
        localStorage.removeItem(KEY);
        setState(initial());
      },
    };
  }, [state, online]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
