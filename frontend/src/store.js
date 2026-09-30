import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { FACILITIES_LIST, DRUGS, VISIT_TYPES, DEFAULT_LTFU } from "@/mock/data";
import { DEFAULT_IMMUNIZATION_SCHEDULES, DEFAULT_LAB_MASTER, DEFAULT_FEATURE_CONFIG } from "@/mock/masters";
import { createHmisPatient, updateHmisPatient, fetchPatients, loginWithTriAuth, logoutTriAuth, fetchAuthSession, startEpisode, addEpisodeVisit, fetchPatientEpisodes, fetchLocations, fetchAppointments, startSuspectEpisode, fetchPatientSuspects, fetchEncounterPhi, upsertEncounterPhiItem, finalizeEncounterPhi, upsertPatientDiseaseStatus, discardEncounterPhi as discardEncounterPhiApi, fetchPhiByVisit, fetchNtdFormConfigs, fetchSchoolHealthSchools, createSchoolHealthSchool, deleteSchoolHealthSchool, fetchSchoolHealthDonors, createSchoolHealthDonor, deleteSchoolHealthDonor, fetchSchoolHealthVisits, createSchoolHealthVisit, updateSchoolHealthVisit, deleteSchoolHealthVisit, saveSchoolHealthChild, deleteSchoolHealthChild, saveSchoolHealthReport, fetchSchoolHealthVisit } from "@/lib/hmisApi";
import { applyNtdFormConfigs } from "@/lib/ntdFormConfig";
import {
  SUSPECT_SYMPTOMS,
  SUSPECT_OPTIONS,
  MODE_OF_DETECTION,
  REFERRED_BY,
  CASE_TYPES,
  CONSENT,
  AGE_SEX_GROUPS,
  CONTACT_STATUS,
  RELATIONSHIPS,
  TEST_RESULT,
  DETECT_RESULT,
  VISIT_TYPES_DEFAULT,
  DISEASE_SPECS,
} from "@/mock/specs";
import { featureCodeForDisease, rehydrateFormFromPhi } from "@/lib/phiMap";
import { resolveDob } from "@/lib/hmisPatient";
import { formatInternational } from "@/lib/phone";
import { dobFromAgeYmd } from "@/components/Capture";

/** ANC/Mal store outcome as `{ status, ... }`; chips/API need a string. */
function outcomeToStatus(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    const nested = value.status ?? value.outcome ?? "";
    return nested == null ? "" : String(nested);
  }
  return String(value);
}
import {
  OP,
  newLocalId,
  isLocalId,
  enqueueOp,
  countPendingOps,
  listPendingOps,
  putLocalPatient,
  putLocalEncounter,
  putLocalSuspect,
  getLocalPatients,
  getLocalEncounters,
  getLocalSuspects,
  findRegisterOpForPatient,
  findOpForLocalVisit,
  cloneFormDataForSync,
  updateOp,
  deleteOps,
} from "@/lib/offlineOutbox";
import { syncOutbox } from "@/lib/offlineSync";

const Ctx = createContext(null);

const ALLOWED_DISEASES_KEY = "ntd.allowedDiseases";
const LEGACY_AUTH_PERSIST_KEY = "ntd.authPersist";

function readCachedAllowedDiseases(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${ALLOWED_DISEASES_KEY}.${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

function writeCachedAllowedDiseases(userId, diseaseIds) {
  if (!userId) return;
  try {
    localStorage.setItem(
      `${ALLOWED_DISEASES_KEY}.${userId}`,
      JSON.stringify(Array.isArray(diseaseIds) ? diseaseIds.map(String) : [])
    );
  } catch {
    /* ignore quota */
  }
}

/** Drop old localStorage session blob (replaced by cookie + /auth/session). */
function clearLegacyAuthPersist() {
  try {
    localStorage.removeItem(LEGACY_AUTH_PERSIST_KEY);
  } catch {
    /* ignore */
  }
}

function applySessionUser(session, emailHint) {
  const email = String(session.email || emailHint || "").trim();
  const allowedDiseases = Array.isArray(session.allowedDiseases)
    ? session.allowedDiseases.map(String)
    : [];
  writeCachedAllowedDiseases(session.userId, allowedDiseases);
  const displayName = String(session.displayName || "").trim();
  return {
    id: session.userId || `u-${Date.now()}`,
    name: displayName || (email.split("@")[0] || "user").trim() || "user",
    displayName: displayName || undefined,
    email: email || session.userId,
    role: "Health Worker",
    scope: "all",
    canEdit: true,
    active: true,
    facilityId: session.facilityId,
    allowedDiseases,
  };
}

/** Normalize portal-be / TriasNtd patient docs for NTD UI. */
function normalizeApiPatient(row) {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id || row.patientId || "");
  if (!id) return null;
  let firstName = String(row.firstName || "").trim();
  const middleName = String(row.middleName || "").trim();
  const lastName = String(row.lastName || "").trim();
  // Repair corrupted firstName that already embeds middle+last
  if (firstName && (middleName || lastName) && /\s/.test(firstName)) {
    const suffix = [middleName, lastName].filter(Boolean).join(" ");
    if (suffix && firstName.endsWith(` ${suffix}`)) {
      firstName = firstName.slice(0, -(suffix.length + 1)).trim();
    } else {
      firstName = firstName.split(/\s+/)[0];
    }
  }
  const name =
    [firstName || row.firstName, middleName || row.middleName, lastName || row.lastName]
      .filter(Boolean)
      .join(" ") ||
    String(row.name || "").trim() ||
    "";
  return {
    ...row,
    id,
    patientId: row.patientId || id,
    patientCode: row.patientCode || "",
    firstName: firstName || (name ? name.split(/\s+/)[0] : ""),
    middleName,
    lastName,
    name,
    episodeId: row.episodeId || "",
    sex: row.sex || row.gender || "",
    gender: row.gender || row.sex || "",
    diseases: Array.isArray(row.diseases) ? row.diseases : [],
    diseaseStatuses: Array.isArray(row.diseaseStatuses)
      ? row.diseaseStatuses
          .map((s) => ({
            diseaseId: String(s?.diseaseId || s?.disease || "").toLowerCase(),
            diagnosis: s?.diagnosis || "",
            outcome: outcomeToStatus(s?.outcome),
            lastEncounter: s?.lastEncounter || s?.date || "",
          }))
          .filter((s) => s.diseaseId)
      : [],
    lastEncounter: row.lastEncounter || "",
    status: row.status || "",
    phone: row.phone || "",
    photo: typeof row.photo === "string" ? row.photo : "",
    village: row.village || "",
    district: row.district || "",
    province: row.province || "",
    createdAt: row.createdAt || "",
    createdBy: row.createdBy || "",
  };
}

const initial = () => ({
  users: [],
  patients: [],
  encounters: [],
  households: [],
  suspects: [],
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
  schools: [],
  donors: [],
  schoolHealth: [],
  currentUserId: null,
  branding: {
    clientName: "PNG National NTD Programme",
    programme: "Skin NTD Control — Momase Region",
    logo: "",
    primary: "#0F52BA",
    phone: "",
    email: "",
    address: "",
  },
  pendingSync: 0,
  outboxOps: [],
  /** In-memory create draft — updated on leave, not every keystroke */
  patientRegisterDraft: null,
});

const queuedCount = (s) => Math.max(0, Number(s.pendingSync) || 0);

/** Deduplicate concurrent / StrictMode-double patient list fetches. */
let patientsInflight = null;
let patientsLoadedKey = null;

function patientsCacheKey(facilityId, q) {
  return `${facilityId || ""}::${q || ""}`;
}

function clearPatientsLoadCache() {
  patientsInflight = null;
  patientsLoadedKey = null;
}

/** Deduplicate locations + episode sync (StrictMode / remount). */
let locationsInflight = null;
let locationsLoadedKey = null;
let episodesInflight = null;
let episodesLoadedKey = null;
let appointmentsInflight = null;
let appointmentsLoadedKey = null;
let suspectsInflight = null;
let suspectsLoadedKey = null;
let phiInflight = null;

function clearRecordLoadCaches() {
  locationsInflight = null;
  locationsLoadedKey = null;
  episodesInflight = null;
  episodesLoadedKey = null;
  appointmentsInflight = null;
  appointmentsLoadedKey = null;
  suspectsInflight = null;
  suspectsLoadedKey = null;
  phiInflight = null;
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(initial);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncPrompt, setSyncPrompt] = useState(null);
  const [authSession, setAuthSession] = useState(null);
  /** false until cookie session bootstrap finishes (Angular APP_INITIALIZER equivalent). */
  const [authReady, setAuthReady] = useState(false);

  const patch = (fn) => setState((s) => ({ ...s, ...fn(s) }));

  const refreshOutboxState = useCallback(async () => {
    try {
      const [pending, ops] = await Promise.all([countPendingOps(), listPendingOps()]);
      patch(() => ({ pendingSync: pending, outboxOps: ops }));
      return pending;
    } catch (err) {
      console.warn("refreshOutboxState failed", err);
      return 0;
    }
  }, []);

  const offerSyncAfterSave = useCallback(async () => {
    if (!navigator.onLine) return 0;
    const n = await refreshOutboxState();
    if (n > 0) {
      setSyncPrompt({ count: n, at: Date.now() });
    }
    return n;
  }, [refreshOutboxState]);

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

  /** Cookie session bootstrap — same idea as Angular APP_INITIALIZER + CanActivate. */
  useEffect(() => {
    let cancelled = false;
    clearLegacyAuthPersist();
    (async () => {
      try {
        const session = await fetchAuthSession();
        if (cancelled) return;
        if (session?.userId) {
          setAuthSession(session);
          const localUser = applySessionUser(session);
          try {
            const formConfigs = await fetchNtdFormConfigs();
            applyNtdFormConfigs(formConfigs, {
              DISEASE_SPECS,
              SUSPECT_SYMPTOMS,
              SUSPECT_OPTIONS,
              sharedTargets: {
                MODE_OF_DETECTION,
                REFERRED_BY,
                CASE_TYPES,
                CONSENT,
                AGE_SEX_GROUPS,
                CONTACT_STATUS,
                RELATIONSHIPS,
                TEST_RESULT,
                DETECT_RESULT,
                VISIT_TYPES_DEFAULT,
              },
            });
          } catch (err) {
            console.warn("session bootstrap form configs failed", err);
          }
          let patients = [];
          try {
            const rows = await fetchPatients({ facilityId: session.facilityId, limit: 200 });
            patients = rows.map(normalizeApiPatient).filter(Boolean);
            patientsLoadedKey = patientsCacheKey(session.facilityId, "");
          } catch (err) {
            console.warn("session bootstrap patients failed", err);
          }
          patch((s) => {
            const exists = s.users.some((u) => u.id === localUser.id);
            return {
              users: exists
                ? s.users.map((u) => (u.id === localUser.id ? { ...u, ...localUser } : u))
                : [...s.users, localUser],
              currentUserId: localUser.id,
              patients: patients.length ? patients : s.patients,
            };
          });
          try {
            const [schools, donors, visits] = await Promise.all([
              fetchSchoolHealthSchools(),
              fetchSchoolHealthDonors(),
              fetchSchoolHealthVisits(),
            ]);
            if (!cancelled) {
              patch(() => ({
                schools: Array.isArray(schools) ? schools : [],
                donors: Array.isArray(donors) ? donors : [],
                schoolHealth: Array.isArray(visits) ? visits : [],
              }));
            }
          } catch (err) {
            console.warn("session bootstrap school health failed", err);
          }
        }
      } catch (err) {
        console.warn("session bootstrap failed", err);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Hydrate IndexedDB local entities + outbox count into React state. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [localPatients, localEncounters, localSuspects, pending, ops] = await Promise.all([
          getLocalPatients(),
          getLocalEncounters(),
          getLocalSuspects(),
          countPendingOps(),
          listPendingOps(),
        ]);
        if (cancelled) return;
        patch((s) => {
          const pById = new Map(s.patients.map((p) => [p.id, p]));
          localPatients.forEach((p) => pById.set(p.id, p));
          const eById = new Map(s.encounters.map((e) => [e.id, e]));
          localEncounters.forEach((e) => eById.set(e.id, e));
          const susById = new Map(s.suspects.map((x) => [x.id, x]));
          localSuspects.forEach((x) => susById.set(x.id, x));
          return {
            patients: [...pById.values()],
            encounters: [...eById.values()],
            suspects: [...susById.values()],
            pendingSync: pending,
            outboxOps: ops,
          };
        });
      } catch (err) {
        console.warn("offline hydrate failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const api = useMemo(() => {
    const user = state.users.find((u) => u.id === state.currentUserId) || null;

    /** Disease ids the logged-in user may start/suspect. null = unrestricted (demo / mock login). */
    const resolvedAllowedDiseases = (() => {
      if (!authSession) return null; // demo accounts see all diseases
      if (Array.isArray(user?.allowedDiseases)) return user.allowedDiseases.map(String);
      if (Array.isArray(authSession.allowedDiseases)) return authSession.allowedDiseases.map(String);
      const cached = readCachedAllowedDiseases(authSession.userId || user?.id);
      return cached || [];
    })();

    const canAccessDisease = (diseaseId) => {
      if (!diseaseId) return true;
      if (resolvedAllowedDiseases == null) return true;
      return resolvedAllowedDiseases.includes(String(diseaseId));
    };

    const visiblePatients = () => {
      if (!user) return [];
      // Facility list from portal-be is already scoped by facilityId
      if (authSession) return state.patients;
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
      authSession,
      authReady,
      allowedDiseases: resolvedAllowedDiseases,
      canAccessDisease,
      visiblePatients,
      loadPatients: async (opts = {}) => {
        const session = opts.session || authSession;
        if (!session?.facilityId) return state.patients;
        const key = patientsCacheKey(session.facilityId, opts.q);
        if (!opts.force && patientsLoadedKey === key && !patientsInflight) {
          return state.patients;
        }
        if (!opts.force && patientsInflight?.key === key) {
          return patientsInflight.promise;
        }
        const promise = fetchPatients({
          facilityId: session.facilityId,
          q: opts.q,
          limit: opts.limit || 200,
        })
          .then((rows) => {
            const patients = rows.map(normalizeApiPatient).filter(Boolean);
            patch(() => ({ patients }));
            patientsLoadedKey = key;
            return patients;
          })
          .catch((err) => {
            console.warn("loadPatients failed", err);
            return state.patients;
          })
          .finally(() => {
            if (patientsInflight?.promise === promise) patientsInflight = null;
          });
        patientsInflight = { key, promise };
        return promise;
      },
      login: async (email, password) => {
        try {
          const session = await loginWithTriAuth(email, password);
          setAuthSession(session);
          clearPatientsLoadCache();
          clearRecordLoadCaches();

          // Replace bundled disease/suspect form defs with ApplicationConfig (NTD_*).
          try {
            const formConfigs = await fetchNtdFormConfigs();
            applyNtdFormConfigs(formConfigs, {
              DISEASE_SPECS,
              SUSPECT_SYMPTOMS,
              SUSPECT_OPTIONS,
              sharedTargets: {
                MODE_OF_DETECTION,
                REFERRED_BY,
                CASE_TYPES,
                CONSENT,
                AGE_SEX_GROUPS,
                CONTACT_STATUS,
                RELATIONSHIPS,
                TEST_RESULT,
                DETECT_RESULT,
                VISIT_TYPES_DEFAULT,
              },
            });
          } catch (err) {
            console.warn("load NTD form configs failed — using bundled specs", err);
          }

          let localUser = state.users.find(
            (x) => x.email.toLowerCase() === String(email).toLowerCase() && x.active
          );
          const allowedDiseases = Array.isArray(session.allowedDiseases)
            ? session.allowedDiseases.map(String)
            : [];
          writeCachedAllowedDiseases(session.userId, allowedDiseases);

          if (!localUser) {
            const displayName = String(session.displayName || "").trim();
            localUser = {
              id: session.userId || `u-${Date.now()}`,
              name: displayName || email.split("@")[0],
              displayName: displayName || undefined,
              email,
              role: "Health Worker",
              scope: "all",
              canEdit: true,
              active: true,
              facilityId: session.facilityId,
              allowedDiseases,
            };
          } else {
            const displayName = String(session.displayName || localUser.displayName || "").trim();
            localUser = {
              ...localUser,
              allowedDiseases,
              facilityId: session.facilityId || localUser.facilityId,
              ...(displayName ? { name: displayName, displayName } : {}),
            };
          }

          // Fetch registered NTD patients for this facility (portal-be Mongo mirror).
          let patients = [];
          try {
            const rows = await fetchPatients({
              facilityId: session.facilityId,
              limit: 200,
            });
            patients = rows.map(normalizeApiPatient).filter(Boolean);
            patientsLoadedKey = patientsCacheKey(session.facilityId, "");
          } catch (err) {
            console.warn("loadPatients after login failed", err);
          }

          if (!state.users.find((x) => x.id === localUser.id)) {
            patch((s) => ({
              users: [...s.users, localUser],
              currentUserId: localUser.id,
              patients,
            }));
          } else {
            patch((s) => ({
              users: s.users.map((u) => (u.id === localUser.id ? { ...u, ...localUser } : u)),
              currentUserId: localUser.id,
              patients,
            }));
          }
          try {
            const [schools, donors, visits] = await Promise.all([
              fetchSchoolHealthSchools(),
              fetchSchoolHealthDonors(),
              fetchSchoolHealthVisits(),
            ]);
            patch(() => ({
              schools: Array.isArray(schools) ? schools : [],
              donors: Array.isArray(donors) ? donors : [],
              schoolHealth: Array.isArray(visits) ? visits : [],
            }));
          } catch (err) {
            console.warn("load school health after login failed", err);
          }
          return { ...localUser, authSession: session };
        } catch (err) {
          // No local demo accounts — programme credentials required
          throw err;
        }
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
      // ---- School Health (portal-be → HMIS) ----
      loadSchoolHealth: async () => {
        if (!authSession?.facilityId) return;
        try {
          const [schools, donors, visits] = await Promise.all([
            fetchSchoolHealthSchools(),
            fetchSchoolHealthDonors(),
            fetchSchoolHealthVisits(),
          ]);
          patch(() => ({
            schools: Array.isArray(schools) ? schools : [],
            donors: Array.isArray(donors) ? donors : [],
            schoolHealth: Array.isArray(visits) ? visits : [],
          }));
        } catch (err) {
          console.warn("loadSchoolHealth failed", err);
        }
      },
      addSchool: async (school) => {
        if (!authSession?.facilityId) throw new Error("Not authenticated");
        const created = await createSchoolHealthSchool(school);
        patch((s) => ({ schools: [...(s.schools || []), created] }));
        return created;
      },
      removeSchool: async (id) => {
        if (!authSession?.facilityId) throw new Error("Not authenticated");
        await deleteSchoolHealthSchool(id);
        patch((s) => ({ schools: (s.schools || []).filter((x) => x.id !== id) }));
      },
      addDonor: async (donor) => {
        if (!authSession?.facilityId) throw new Error("Not authenticated");
        const created = await createSchoolHealthDonor(donor);
        patch((s) => ({ donors: [...(s.donors || []), created] }));
        return created;
      },
      removeDonor: async (id) => {
        if (!authSession?.facilityId) throw new Error("Not authenticated");
        await deleteSchoolHealthDonor(id);
        patch((s) => ({ donors: (s.donors || []).filter((x) => x.id !== id) }));
      },
      addSchoolVisit: async (v) => {
        if (!authSession?.facilityId) throw new Error("Not authenticated");
        const worker =
          v.worker ||
          state.users.find((u) => u.id === state.currentUserId)?.name ||
          "";
        const schoolMaster = (state.schools || []).find(
          (s) => s.name === v.school || s.id === v.schoolId
        );
        const donorMaster = (state.donors || []).find(
          (d) => d.name === v.donor || d.id === v.donorId
        );
        const created = await createSchoolHealthVisit({
          date: v.date,
          formType: v.formType,
          province: v.province,
          district: v.district,
          village: v.village,
          schoolId: v.schoolId || schoolMaster?.id,
          school: v.school || schoolMaster?.name,
          donorId: v.donorId || donorMaster?.id,
          donor: v.donor || donorMaster?.name,
          workerDisplayName: worker,
          status: v.status || "New",
        });
        patch((s) => ({ schoolHealth: [created, ...(s.schoolHealth || [])] }));
        return created;
      },
      updateSchoolVisit: async (id, changes) => {
        if (!authSession?.facilityId) {
          patch((s) => ({
            schoolHealth: s.schoolHealth.map((v) => (v.id === id ? { ...v, ...changes } : v)),
          }));
          return;
        }
        const updated = await updateSchoolHealthVisit(id, changes);
        patch((s) => ({
          schoolHealth: s.schoolHealth.map((v) => (v.id === id ? { ...v, ...updated } : v)),
        }));
        return updated;
      },
      removeSchoolVisit: async (id) => {
        if (!authSession?.facilityId) throw new Error("Not authenticated");
        await deleteSchoolHealthVisit(id);
        patch((s) => ({ schoolHealth: s.schoolHealth.filter((v) => v.id !== id) }));
      },
      refreshSchoolVisit: async (visitId) => {
        if (!authSession?.facilityId || !visitId) return null;
        const visit = await fetchSchoolHealthVisit(visitId);
        patch((s) => ({
          schoolHealth: s.schoolHealth.some((v) => v.id === visitId)
            ? s.schoolHealth.map((v) => (v.id === visitId ? visit : v))
            : [visit, ...s.schoolHealth],
        }));
        return visit;
      },
      saveSchoolChild: async (visitId, child) => {
        if (!authSession?.facilityId) throw new Error("Not authenticated");
        const saved = await saveSchoolHealthChild(visitId, child);
        patch((s) => ({
          schoolHealth: s.schoolHealth.map((v) => {
            if (v.id !== visitId) return v;
            const children = v.children || [];
            if (child.id) {
              return {
                ...v,
                children: children.map((c) => (c.id === child.id ? { ...c, ...saved } : c)),
                status: "In Progress",
              };
            }
            return { ...v, children: [...children, saved], status: "In Progress" };
          }),
        }));
        try {
          const fresh = await fetchSchoolHealthVisit(visitId);
          patch((s) => ({
            schoolHealth: s.schoolHealth.map((v) => (v.id === visitId ? fresh : v)),
          }));
        } catch (_) {
          /* keep optimistic */
        }
        return saved;
      },
      removeSchoolChild: async (visitId, childId) => {
        if (!authSession?.facilityId) throw new Error("Not authenticated");
        await deleteSchoolHealthChild(visitId, childId);
        patch((s) => ({
          schoolHealth: s.schoolHealth.map((v) =>
            v.id === visitId
              ? { ...v, children: (v.children || []).filter((c) => c.id !== childId) }
              : v
          ),
        }));
        try {
          const fresh = await fetchSchoolHealthVisit(visitId);
          patch((s) => ({
            schoolHealth: s.schoolHealth.map((v) => (v.id === visitId ? fresh : v)),
          }));
        } catch (_) {
          /* keep optimistic */
        }
      },
      saveSchoolReport: async (visitId, report) => {
        if (!authSession?.facilityId) throw new Error("Not authenticated");
        const updated = await saveSchoolHealthReport(visitId, report);
        patch((s) => ({
          schoolHealth: s.schoolHealth.map((v) => (v.id === visitId ? { ...v, ...updated } : v)),
        }));
        return updated;
      },
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
      logout: async () => {
        await logoutTriAuth();
        setAuthSession(null);
        clearLegacyAuthPersist();
        clearPatientsLoadCache();
        clearRecordLoadCaches();
        patch(() => ({
          currentUserId: null,
          users: [],
          patients: [],
          encounters: [],
          households: [],
          suspects: [],
          patientRegisterDraft: null,
        }));
      },
      addUser: (u) =>
        patch((s) => ({ users: [...s.users, { id: `u${Date.now()}`, active: true, ...u }] })),
      updateUser: (id, changes) =>
        patch((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...changes } : u)) })),
      setBranding: (b) => patch((s) => ({ branding: { ...s.branding, ...b } })),
      setPatientRegisterDraft: (draft) =>
        patch(() => ({ patientRegisterDraft: draft ? { ...draft } : null })),
      clearPatientRegisterDraft: () => patch(() => ({ patientRegisterDraft: null })),
      addPatient: async (formState) => {
        const buildRec = (patientId, patientCode, { localOnly = false } = {}) => {
          const primary = (formState.addresses && formState.addresses[0]) || {};
          const ageY = formState.ageY !== "" && formState.ageY != null ? formState.ageY : formState.age;
          const dob =
            formState.dob ||
            resolveDob(formState) ||
            dobFromAgeYmd({ y: ageY, m: formState.ageM, d: formState.ageD });
          return {
            ...formState,
            firstName: formState.name,
            name: [formState.name, formState.middleName, formState.lastName].filter(Boolean).join(" "),
            dob,
            age: Number(ageY) || 0,
            phone: formatInternational(formState.phoneCountry, formState.phone),
            countryCode: formState.phoneCountry,
            country: primary.country,
            province: primary.province,
            district: primary.district,
            village: primary.village,
            addressType: primary.type,
            id: patientId,
            patientId,
            patientCode: patientCode || "",
            episodeId: "",
            createdBy: state.currentUserId,
            createdAt: new Date().toISOString().slice(0, 10),
            status: formState.status || "",
            diseases: formState.diseases || [],
            sex: formState.sex || formState.gender || "",
            gender: formState.gender || formState.sex || "",
            facilityId: authSession?.facilityId,
            localOnly: Boolean(localOnly),
            synced: !localOnly,
          };
        };

        // Offline (or no session): queue register for Sync
        if (!online || !authSession?.facilityId) {
          if (!authSession?.facilityId) {
            throw new Error("Sign in with programme credentials before registering a patient");
          }
          const localPatientId = newLocalId("local-patient");
          const rec = buildRec(localPatientId, "", { localOnly: true });
          const op = await enqueueOp({
            type: OP.REGISTER_PATIENT,
            localEntityId: localPatientId,
            label: `Register ${rec.name || "patient"}`,
            payload: { localPatientId, formState: { ...formState } },
          });
          await putLocalPatient(rec);
          patch((s) => ({
            patients: [rec, ...s.patients],
            patientRegisterDraft: null,
          }));
          await offerSyncAfterSave();
          return { ...rec, outboxOpId: op.id };
        }

        const { patientId, patientCode } = await createHmisPatient(formState);
        const rec = buildRec(patientId, patientCode, { localOnly: false });
        patch((s) => ({ patients: [rec, ...s.patients], patientRegisterDraft: null }));
        return rec;
      },
      updatePatient: async (id, data) => {
        const rec = state.patients.find((p) => p.id === id);
        if (!rec) return null;

        // Edit patient is online-only and always writes to HMIS (real DB).
        if (!online) {
          throw new Error("Go online to edit patient details — offline edits are not allowed");
        }
        if (!authSession?.facilityId) {
          throw new Error("Sign in with programme credentials before editing a patient");
        }
        if (rec.localOnly || isLocalId(rec.id)) {
          throw new Error(
            "This patient is still queued offline. Tap Sync first, then edit — changes save to HMIS"
          );
        }

        const primary = (data.addresses && data.addresses[0]) || {};
        const ageY = data.ageY !== "" && data.ageY != null ? data.ageY : data.age;
        const dob =
          data.dob ||
          resolveDob(data) ||
          dobFromAgeYmd({ y: ageY, m: data.ageM, d: data.ageD }) ||
          rec.dob;

        await updateHmisPatient(rec.id, data);

        const firstName = String(data.firstName || data.name || "").trim();
        const middleName = String(data.middleName || "").trim();
        const lastName = String(data.lastName || "").trim();
        const displayName =
          String(data.displayName || "").trim() ||
          [firstName, middleName, lastName].filter(Boolean).join(" ");

        const next = {
          ...rec,
          ...data,
          id: rec.id,
          patientId: rec.patientId || rec.id,
          patientCode: rec.patientCode || "",
          episodeId: rec.episodeId,
          createdBy: rec.createdBy,
          createdAt: rec.createdAt,
          diseases: rec.diseases,
          status: rec.status,
          outcome: rec.outcome,
          treatmentEnd: rec.treatmentEnd,
          firstName,
          middleName,
          lastName,
          name: displayName,
          dob,
          age: Number(ageY) || rec.age || 0,
          phone: data.phoneCountry
            ? formatInternational(data.phoneCountry, data.phone)
            : data.phone || rec.phone,
          countryCode: data.phoneCountry || rec.countryCode,
          country: primary.country || data.country || rec.country,
          province: primary.province || data.province || rec.province,
          district: primary.district || data.district || rec.district,
          village: primary.village || data.village || rec.village,
          addressType: primary.type || data.addressType || rec.addressType,
          sex: data.sex || data.gender || rec.sex,
          gender: data.gender || data.sex || rec.gender,
          facilityId: rec.facilityId || authSession?.facilityId,
          localOnly: false,
          synced: true,
          editedAt: new Date().toISOString(),
        };
        patch((s) => ({
          patients: s.patients.map((p) => (p.id === id ? next : p)),
        }));
        return next;
      },
      registerBaby: (motherId, baby) => {
        const mother = state.patients.find((p) => p.id === motherId);
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
        offerSyncAfterSave(nextPending);
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
      /**
       * Start episode for Scabies/Yaws/LF/Buruli/Leprosy/AnteNatal/Malnutrition/WellBaby:
       * portal-be creates RecordsT + VisitsT + VisitMetaT, then we keep a local pending visit.
       */
      startEpisode: async ({
        patientId,
        disease,
        visitType,
        locationId,
        locationName,
        visitDate,
        referral,
        clinicianName,
      }) => {
        const makeDraft = (ids, { synced }) => ({
          id: ids.visitId,
          visitId: ids.visitId,
          recordId: ids.recordId,
          encounterId: ids.encounterId || "",
          featureCode: ids.featureCode || featureCodeForDisease(disease),
          patientId,
          episodeId: ids.recordId,
          disease,
          facility: locationName || "",
          locationId: locationId || "",
          worker: clinicianName || "",
          type: visitType,
          referral: referral || "No",
          date: visitDate ? `${String(visitDate).slice(0, 10)}T12:00:00` : new Date().toISOString(),
          status: "Pending",
          diagnosis: "",
          outcome: "Open",
          treatment: "",
          pendingStart: true,
          complete: false,
          synced,
          localOnly: !synced,
          data: {},
        });

        if (!online) {
          const localVisitId = newLocalId("local-visit");
          const localRecordId = newLocalId("local-record");
          const localEncounterId = newLocalId("local-encounter");
          const deps = [];
          const regOp = await findRegisterOpForPatient(patientId);
          if (regOp) deps.push(regOp.id);
          const op = await enqueueOp({
            type: OP.START_EPISODE,
            localEntityId: localVisitId,
            dependsOn: deps,
            label: `Start ${disease} episode`,
            payload: {
              patientId,
              localVisitId,
              localRecordId,
              disease,
              visitType,
              locationId,
              locationName,
              visitDate,
              referral: referral || "No",
              clinicianName,
              facilityId: authSession?.facilityId,
              clinicianId: authSession?.userId,
            },
          });
          const draft = makeDraft(
            {
              visitId: localVisitId,
              recordId: localRecordId,
              encounterId: localEncounterId,
              featureCode: featureCodeForDisease(disease),
            },
            { synced: false }
          );
          draft.outboxOpId = op.id;
          await putLocalEncounter(draft);
          patch((s) => {
            const withoutDup = s.encounters.filter((e) => e.id !== localVisitId && e.visitId !== localVisitId);
            const patients = s.patients.map((p) =>
              p.id === patientId && !(p.diseases || []).includes(disease)
                ? { ...p, diseases: [...(p.diseases || []), disease] }
                : p
            );
            return { encounters: [draft, ...withoutDup], patients };
          });
          await offerSyncAfterSave();
          return {
            visitId: localVisitId,
            recordId: localRecordId,
            encounterId: localEncounterId,
            featureCode: draft.featureCode,
            encounter: draft,
            localOnly: true,
          };
        }

        const data = await startEpisode(patientId, {
          disease,
          visitType,
          locationId,
          locationName,
          visitDate,
          referral: referral || "No",
          clinicianName,
          facilityId: authSession?.facilityId,
          clinicianId: authSession?.userId,
        });
        const visitId = data.visitId;
        const recordId = data.recordId;
        if (!visitId || !recordId) {
          throw new Error("Episode create did not return visitId/recordId");
        }
        const encounterId = data.encounterId || "";
        const featureCode = data.featureCode || featureCodeForDisease(disease);
        const draft = makeDraft({ visitId, recordId, encounterId, featureCode }, { synced: true });
        patch((s) => {
          const withoutDup = s.encounters.filter((e) => e.id !== visitId && e.visitId !== visitId);
          const patients = s.patients.map((p) =>
            p.id === patientId && !(p.diseases || []).includes(disease)
              ? { ...p, diseases: [...(p.diseases || []), disease] }
              : p
          );
          return { encounters: [draft, ...withoutDup], patients };
        });
        appointmentsLoadedKey = null;
        return { ...data, encounter: draft };
      },
      /** Add a visit to an existing episode (recordId). */
      addEncounter: async ({
        patientId,
        recordId,
        disease,
        visitType,
        locationId,
        locationName,
        visitDate,
        referral,
        clinicianName,
      }) => {
        if (!online) {
          const localVisitId = newLocalId("local-visit");
          const localEncounterId = newLocalId("local-encounter");
          const deps = [];
          const regOp = await findRegisterOpForPatient(patientId);
          if (regOp) deps.push(regOp.id);
          // If recordId is local, depend on the episode op that created it
          if (isLocalId(recordId)) {
            const ops = await listPendingOps();
            const epOp = ops.find(
              (o) =>
                (o.type === OP.START_EPISODE || o.type === OP.START_SUSPECT) &&
                o.payload?.localRecordId === recordId
            );
            if (epOp) deps.push(epOp.id);
          }
          const op = await enqueueOp({
            type: OP.ADD_VISIT,
            localEntityId: localVisitId,
            dependsOn: deps,
            label: `Add ${disease} visit`,
            payload: {
              patientId,
              recordId,
              localVisitId,
              disease,
              visitType,
              locationId,
              locationName,
              visitDate,
              referral: referral || "No",
              clinicianName,
              facilityId: authSession?.facilityId,
              clinicianId: authSession?.userId,
            },
          });
          const draft = {
            id: localVisitId,
            visitId: localVisitId,
            recordId,
            encounterId: localEncounterId,
            featureCode: featureCodeForDisease(disease),
            patientId,
            episodeId: recordId,
            disease,
            facility: locationName || "",
            locationId: locationId || "",
            worker: clinicianName || "",
            type: visitType,
            referral: referral || "No",
            date: visitDate ? `${String(visitDate).slice(0, 10)}T12:00:00` : new Date().toISOString(),
            status: "Pending",
            diagnosis: "",
            outcome: "Open",
            treatment: "",
            pendingStart: true,
            complete: false,
            synced: false,
            localOnly: true,
            outboxOpId: op.id,
            data: {},
          };
          await putLocalEncounter(draft);
          patch((s) => {
            const withoutDup = s.encounters.filter((e) => e.id !== localVisitId && e.visitId !== localVisitId);
            return { encounters: [draft, ...withoutDup] };
          });
          await offerSyncAfterSave();
          return {
            visitId: localVisitId,
            recordId,
            encounterId: localEncounterId,
            featureCode: draft.featureCode,
            encounter: draft,
            localOnly: true,
          };
        }

        const data = await addEpisodeVisit(patientId, recordId, {
          disease,
          visitType,
          locationId,
          locationName,
          visitDate,
          referral: referral || "No",
          clinicianName,
          facilityId: authSession?.facilityId,
          clinicianId: authSession?.userId,
        });
        const visitId = data.visitId;
        if (!visitId) throw new Error("Encounter create did not return visitId");
        const encounterId = data.encounterId || "";
        const featureCode = data.featureCode || featureCodeForDisease(disease);
        const draft = {
          id: visitId,
          visitId,
          recordId: recordId || data.recordId,
          encounterId,
          featureCode,
          patientId,
          episodeId: recordId || data.recordId,
          disease,
          facility: locationName || "",
          locationId: locationId || "",
          worker: clinicianName || "",
          type: visitType,
          referral: referral || "No",
          date: visitDate ? `${String(visitDate).slice(0, 10)}T12:00:00` : new Date().toISOString(),
          status: "Pending",
          diagnosis: "",
          outcome: "Open",
          treatment: "",
          pendingStart: true,
          complete: false,
          synced: true,
          data: {},
        };
        patch((s) => {
          const withoutDup = s.encounters.filter((e) => e.id !== visitId && e.visitId !== visitId);
          return { encounters: [draft, ...withoutDup] };
        });
        appointmentsLoadedKey = null;
        return { ...data, encounter: draft };
      },
      /**
       * Suspect screening → VisitMetaT (symptoms) + optional disease episode.
       * Used when Add Episode Go to = Suspect screening.
       */
      startSuspectEpisode: async ({
        patientId,
        disease,
        suspect,
        symptoms,
        notes,
        photos,
        visitType,
        locationId,
        locationName,
        visitDate,
        referral,
        clinicianName,
      }) => {
        if (!online) {
          const localSuspectId = newLocalId("local-suspect");
          const localVisitId = disease ? newLocalId("local-visit") : "";
          const localRecordId = disease ? newLocalId("local-record") : "";
          const localEncounterId = disease ? newLocalId("local-encounter") : "";
          const deps = [];
          const regOp = await findRegisterOpForPatient(patientId);
          if (regOp) deps.push(regOp.id);
          const op = await enqueueOp({
            type: OP.START_SUSPECT,
            localEntityId: localVisitId || localSuspectId,
            dependsOn: deps,
            label: disease ? `Suspect → ${disease}` : "Suspect screening",
            payload: {
              patientId,
              localSuspectId,
              localVisitId: localVisitId || undefined,
              localRecordId: localRecordId || undefined,
              disease: disease || undefined,
              suspect,
              symptoms: symptoms || [],
              notes: notes || "",
              photos: Array.isArray(photos) ? photos : [],
              visitType,
              locationId,
              locationName,
              visitDate,
              referral: referral || "No",
              clinicianName,
              facilityId: authSession?.facilityId,
              clinicianId: authSession?.userId,
            },
          });
          const suspectRec = {
            id: localSuspectId,
            visitId: localVisitId || "",
            patientId,
            date: new Date().toISOString(),
            worker: clinicianName || "",
            symptoms: symptoms || [],
            photos: photos || [],
            suspect,
            notes: notes || "",
            recordId: localRecordId || "",
            disease: disease || null,
            synced: false,
            localOnly: true,
            outboxOpId: op.id,
          };
          await putLocalSuspect(suspectRec);
          let encounterDraft = null;
          if (disease && localVisitId) {
            encounterDraft = {
              id: localVisitId,
              visitId: localVisitId,
              recordId: localRecordId,
              encounterId: localEncounterId,
              featureCode: featureCodeForDisease(disease),
              patientId,
              episodeId: localRecordId,
              disease,
              facility: locationName || "",
              locationId: locationId || "",
              worker: clinicianName || "",
              type: visitType,
              referral: referral || "No",
              date: visitDate ? `${String(visitDate).slice(0, 10)}T12:00:00` : new Date().toISOString(),
              status: "Pending",
              diagnosis: "",
              outcome: "Open",
              treatment: "",
              pendingStart: true,
              complete: false,
              synced: false,
              localOnly: true,
              fromSuspect: true,
              outboxOpId: op.id,
              data: {},
            };
            await putLocalEncounter(encounterDraft);
          }
          patch((s) => {
            let encounters = s.encounters;
            let patients = s.patients.map((p) =>
              p.id === patientId ? { ...p, status: p.status || "Suspected" } : p
            );
            if (encounterDraft) {
              encounters = [
                encounterDraft,
                ...s.encounters.filter((e) => e.id !== localVisitId && e.visitId !== localVisitId),
              ];
              patients = patients.map((p) =>
                p.id === patientId && !(p.diseases || []).includes(disease)
                  ? { ...p, diseases: [...(p.diseases || []), disease] }
                  : p
              );
            }
            return {
              suspects: [...s.suspects.filter((x) => x.id !== localSuspectId), suspectRec],
              encounters,
              patients,
            };
          });
          await offerSyncAfterSave();
          return {
            suspect: suspectRec,
            visitId: localVisitId || null,
            recordId: localRecordId || null,
            encounterId: localEncounterId || null,
            encounter: encounterDraft,
            localOnly: true,
          };
        }

        const data = await startSuspectEpisode(patientId, {
          disease,
          suspect,
          symptoms,
          notes,
          photos,
          visitType,
          locationId,
          locationName,
          visitDate,
          referral: referral || "No",
          clinicianName,
          facilityId: authSession?.facilityId,
          clinicianId: authSession?.userId,
        });
        const visitId = data.visitId;
        const recordId = data.recordId || "";
        const suspectId = data.visitMetaId || visitId;
        const suspectRec = {
          id: String(suspectId),
          visitId,
          visitMetaId: data.visitMetaId || "",
          patientId,
          date: data.visitDate
            ? `${String(data.visitDate).slice(0, 10)}T12:00:00`
            : new Date().toISOString(),
          worker: clinicianName || "",
          symptoms: data.symptoms || symptoms || [],
          photos: data.photos || photos || [],
          suspect: data.suspect || suspect,
          notes: data.notes || notes || "",
          recordId,
          disease: data.disease || disease || null,
          synced: true,
        };
        const diseaseId = data.disease || disease || "";
        let encounterDraft = null;
        if (visitId && diseaseId) {
          encounterDraft = {
            id: visitId,
            visitId,
            recordId,
            encounterId: data.encounterId || "",
            featureCode: data.featureCode || featureCodeForDisease(diseaseId),
            patientId,
            episodeId: recordId || visitId,
            disease: diseaseId,
            facility: locationName || "",
            locationId: locationId || "",
            worker: clinicianName || "",
            type: visitType,
            referral: referral || "No",
            date: visitDate ? `${String(visitDate).slice(0, 10)}T12:00:00` : new Date().toISOString(),
            status: "Pending",
            diagnosis: "",
            outcome: "Open",
            treatment: "",
            pendingStart: true,
            complete: false,
            synced: true,
            data: {},
            fromSuspect: true,
          };
        }
        patch((s) => {
          const withoutSuspectDup = s.suspects.filter(
            (x) => x.id !== suspectRec.id && x.visitId !== visitId
          );
          let encounters = s.encounters;
          let patients = s.patients;
          if (encounterDraft) {
            encounters = [
              encounterDraft,
              ...s.encounters.filter((e) => e.id !== visitId && e.visitId !== visitId),
            ];
            patients = s.patients.map((p) =>
              p.id === patientId && !(p.diseases || []).includes(diseaseId)
                ? { ...p, diseases: [...(p.diseases || []), diseaseId], status: p.status || "Suspected" }
                : p.id === patientId
                  ? { ...p, status: p.status || "Suspected" }
                  : p
            );
          } else {
            patients = s.patients.map((p) =>
              p.id === patientId ? { ...p, status: p.status || "Suspected" } : p
            );
          }
          return {
            suspects: [suspectRec, ...withoutSuspectDup],
            encounters,
            patients,
          };
        });
        appointmentsLoadedKey = null;
        suspectsLoadedKey = null;
        episodesLoadedKey = null;
        return { ...data, suspect: suspectRec, encounter: encounterDraft };
      },
      /** Merge open HMIS episodes into local encounters (pendingStart cards). */
      syncPatientEpisodes: async (patientId, opts = {}) => {
        if (!patientId || !authSession?.facilityId) return [];
        const key = `${authSession.facilityId}::${patientId}`;
        if (!opts.force && episodesLoadedKey === key && !episodesInflight) {
          return [];
        }
        if (!opts.force && episodesInflight?.key === key) {
          return episodesInflight.promise;
        }
        const promise = fetchPatientEpisodes(patientId)
          .then((rows) => {
            if (!rows.length) {
              episodesLoadedKey = key;
              return [];
            }
            patch((s) => {
              const byId = new Map(s.encounters.map((e) => [e.id, e]));
              let patients = s.patients;
              for (const row of rows) {
                const visitId = row.visitId;
                if (!visitId) continue;
                const existing = byId.get(visitId);
                if (existing && !existing.pendingStart) continue;
                const disease = row.disease;
                const draft = {
                  id: visitId,
                  visitId,
                  recordId: row.recordId || "",
                  encounterId: row.encounterId || existing?.encounterId || "",
                  featureCode: row.featureCode || existing?.featureCode || featureCodeForDisease(disease),
                  patientId,
                  episodeId: row.recordId || visitId,
                  disease,
                  facility: row.locationName || existing?.facility || "",
                  locationId: row.locationId || "",
                  worker: existing?.worker || "",
                  type: row.visitType || existing?.type || "",
                  referral: row.referral || "No",
                  date: row.createdOn
                    ? new Date(row.createdOn).toISOString()
                    : existing?.date || new Date().toISOString(),
                  status: existing?.pendingStart === false ? existing.status : "Pending",
                  diagnosis: existing?.diagnosis || "",
                  outcome: existing?.outcome || "Open",
                  treatment: existing?.treatment || "",
                  pendingStart: existing?.pendingStart === false ? false : Boolean(row.pendingStart),
                  complete: existing?.complete === true,
                  synced: true,
                  data: existing?.data || {},
                };
                byId.set(visitId, draft);
                if (disease) {
                  patients = patients.map((p) =>
                    p.id === patientId && !(p.diseases || []).includes(disease)
                      ? { ...p, diseases: [...(p.diseases || []), disease] }
                      : p
                  );
                }
              }
              return { encounters: [...byId.values()], patients };
            });
            episodesLoadedKey = key;
            return rows;
          })
          .catch((err) => {
            console.warn("syncPatientEpisodes failed", err);
            return [];
          })
          .finally(() => {
            if (episodesInflight?.promise === promise) episodesInflight = null;
          });
        episodesInflight = { key, promise };
        return promise;
      },
      /** Merge VisitMetaT ntd-suspect rows into local suspects list. */
      syncPatientSuspects: async (patientId, opts = {}) => {
        if (!patientId || !authSession?.facilityId) return [];
        const key = `${authSession.facilityId}::${patientId}`;
        if (!opts.force && suspectsLoadedKey === key && !suspectsInflight) {
          return state.suspects.filter((s) => s.patientId === patientId);
        }
        if (!opts.force && suspectsInflight?.key === key) {
          return suspectsInflight.promise;
        }
        const promise = fetchPatientSuspects(patientId)
          .then((rows) => {
            const mapped = (rows || []).map((row) => ({
              id: String(row.id || row.visitMetaId || row.visitId),
              visitId: row.visitId || "",
              visitMetaId: row.visitMetaId || "",
              patientId,
              date: row.date
                ? new Date(row.date).toISOString()
                : new Date().toISOString(),
              worker: row.worker || "",
              symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
              photos: Array.isArray(row.photos) ? row.photos : [],
              suspect: String(row.suspect || "").toLowerCase(),
              notes: row.notes || "",
              recordId: row.recordId || "",
              disease: row.disease || null,
              synced: true,
            }));
            patch((s) => {
              const others = s.suspects.filter((x) => x.patientId !== patientId);
              const byId = new Map(others.map((x) => [x.id, x]));
              for (const row of mapped) {
                const existing = byId.get(row.id) || s.suspects.find((x) => x.visitId && x.visitId === row.visitId);
                byId.set(row.id, existing ? { ...existing, ...row, photos: row.photos?.length ? row.photos : existing.photos || [] } : row);
              }
              // Keep local-only suspects for this patient that aren't in HMIS yet
              for (const local of s.suspects.filter((x) => x.patientId === patientId && !x.synced)) {
                if (![...byId.values()].some((x) => x.id === local.id || (local.visitId && x.visitId === local.visitId))) {
                  byId.set(local.id, local);
                }
              }
              return { suspects: [...byId.values()] };
            });
            suspectsLoadedKey = key;
            return mapped;
          })
          .catch((err) => {
            console.warn("syncPatientSuspects failed", err);
            return [];
          })
          .finally(() => {
            if (suspectsInflight?.promise === promise) suspectsInflight = null;
          });
        suspectsInflight = { key, promise };
        return promise;
      },
      loadLocations: async (opts = {}) => {
        const facilityId = authSession?.facilityId || "";
        const key = facilityId || "all";
        if (!opts.force && locationsLoadedKey === key && !locationsInflight) {
          return state.facilities;
        }
        if (!opts.force && locationsInflight?.key === key) {
          return locationsInflight.promise;
        }
        const promise = fetchLocations({ facilityId: authSession?.facilityId })
          .then((rows) => {
            if (rows?.length) {
              patch(() => ({
                facilities: rows.map((r) => ({
                  id: r.id,
                  name: r.name,
                  facilityId: r.facilityId || authSession?.facilityId,
                })),
              }));
            }
            locationsLoadedKey = key;
            return rows || [];
          })
          .catch((err) => {
            console.warn("loadLocations failed", err);
            return [];
          })
          .finally(() => {
            if (locationsInflight?.promise === promise) locationsInflight = null;
          });
        locationsInflight = { key, promise };
        return promise;
      },
      /**
       * Register an inventory-picked drug into the local catalogue (form / posology helpers).
       */
      ensureCatalogueDrug: (drug) => {
        if (!drug?.name) return;
        patch((s) => {
          const exists = (s.settings.drugs || []).some(
            (d) => String(d.name).toLowerCase() === String(drug.name).toLowerCase()
          );
          if (exists) return {};
          return {
            settings: {
              ...s.settings,
              drugs: [
                ...s.settings.drugs,
                {
                  name: drug.name,
                  form: drug.form || "Oral",
                  strength: drug.strength || "—",
                  type: drug.type || "Drug",
                  diseases: [],
                  tradeId: drug.tradeId || drug.id,
                  itemCode: drug.itemCode || "",
                  source: drug.source || "inventory",
                },
              ],
            },
          };
        });
      },
      /** Load facility NTD visits into local encounters for Appointments. */
      loadAppointments: async ({ from, to, force } = {}) => {
        if (!authSession?.facilityId) return [];
        const key = `${authSession.facilityId}::${from || ""}::${to || ""}`;
        if (!force && appointmentsLoadedKey === key && !appointmentsInflight) {
          return state.encounters;
        }
        if (!force && appointmentsInflight?.key === key) {
          return appointmentsInflight.promise;
        }
        const promise = fetchAppointments({
          facilityId: authSession.facilityId,
          from,
          to,
          limit: 200,
        })
          .then((rows) => {
            const mapped = (rows || [])
              .map((row) => {
                const visitId = String(row.visitId || "");
                if (!visitId || !row.patientId) return null;
                const visitDate = String(row.visitDate || "").slice(0, 10);
                const visitTime = String(row.visitTime || "12:00:00").slice(0, 8);
                const date = visitDate
                  ? `${visitDate}T${visitTime}`
                  : row.createdOn
                    ? new Date(row.createdOn).toISOString()
                    : new Date().toISOString();
                return {
                  id: visitId,
                  visitId,
                  recordId: row.recordId || "",
                  patientId: String(row.patientId),
                  episodeId: row.recordId || visitId,
                  disease: String(row.disease || "").toLowerCase(),
                  facility: row.locationName || "",
                  locationId: row.locationId || "",
                  worker: row.clinicianName || "",
                  type: row.visitType || "",
                  referral: row.referral || "No",
                  date,
                  status: row.pendingStart ? "Pending" : "Complete",
                  diagnosis: "",
                  outcome: "Open",
                  treatment: "",
                  pendingStart: row.pendingStart !== false,
                  complete: row.pendingStart === false,
                  synced: true,
                  data: {},
                };
              })
              .filter(Boolean);

            patch((s) => {
              const byId = new Map(s.encounters.map((e) => [e.id, e]));
              for (const row of mapped) {
                const existing = byId.get(row.id);
                if (existing && !existing.pendingStart && existing.complete) {
                  // Keep locally completed clinical data; refresh schedule fields only.
                  byId.set(row.id, {
                    ...existing,
                    facility: row.facility || existing.facility,
                    locationId: row.locationId || existing.locationId,
                    type: row.type || existing.type,
                    worker: row.worker || existing.worker,
                    date: existing.date || row.date,
                    synced: true,
                  });
                } else if (existing) {
                  byId.set(row.id, {
                    ...existing,
                    ...row,
                    data: existing.data || {},
                    diagnosis: existing.diagnosis || "",
                    outcome: existing.outcome || row.outcome,
                    treatment: existing.treatment || "",
                    editedSections: existing.editedSections || [],
                    revised: existing.revised === true,
                  });
                } else {
                  byId.set(row.id, row);
                }
              }
              return { encounters: [...byId.values()] };
            });
            appointmentsLoadedKey = key;
            return mapped;
          })
          .catch((err) => {
            console.warn("loadAppointments failed", err);
            return [];
          })
          .finally(() => {
            if (appointmentsInflight?.promise === promise) appointmentsInflight = null;
          });
        appointmentsInflight = { key, promise };
        return promise;
      },
      saveEncounter: async (enc) => {
        const existing = enc.id ? state.encounters.find((e) => e.id === enc.id) : null;
        const needsQueue = Boolean(
          !online ||
            existing?.localOnly ||
            enc.localOnly ||
            isLocalId(existing?.visitId || existing?.id || "") ||
            isLocalId(enc.visitId || enc.id || "")
        );

        let saved;
        if (existing) {
          const editedSections = Array.isArray(enc.editedSections) ? enc.editedSections : [];
          const revised = enc.revised === true && editedSections.length > 0;
          const priorSections = existing.editedSections || [];
          const sectionsGrew = editedSections.some((k) => !priorSections.includes(k));
          const bumpEditedAt = revised && (!existing.revised || sectionsGrew);
          saved = {
            ...existing,
            ...enc,
            id: existing.id,
            visitId: existing.visitId || enc.visitId,
            recordId: existing.recordId || enc.recordId,
            encounterId: existing.encounterId || enc.encounterId || "",
            featureCode:
              existing.featureCode ||
              enc.featureCode ||
              featureCodeForDisease(enc.disease || existing.disease),
            disease: enc.disease || existing.disease,
            outcome: outcomeToStatus(enc.outcome) || outcomeToStatus(enc.data?.outcome) || outcomeToStatus(existing.outcome) || "",
            pendingStart: false,
            complete: true,
            revised,
            editedAt: bumpEditedAt
              ? new Date().toISOString()
              : revised
                ? existing.editedAt
                : undefined,
            editedSections: revised ? editedSections : [],
            synced: needsQueue ? false : true,
            localOnly: needsQueue ? true : existing.localOnly,
          };
        } else {
          const { id: providedId, ...rest } = enc;
          saved = {
            date: new Date().toISOString(),
            disease: enc.disease || "scabies",
            synced: !needsQueue,
            complete: true,
            pendingStart: false,
            revised: false,
            editedSections: [],
            localOnly: needsQueue,
            featureCode: featureCodeForDisease(enc.disease || "scabies"),
            ...rest,
            outcome: outcomeToStatus(enc.outcome) || outcomeToStatus(enc.data?.outcome) || "",
            id: providedId || `ENC-${String(Math.floor(Math.random() * 900000) + 100000)}`,
          };
        }

        patch((s) => {
          const idx = s.encounters.findIndex((e) => e.id === saved.id);
          if (idx >= 0) {
            const next = s.encounters.slice();
            next[idx] = saved;
            return { encounters: next };
          }
          return { encounters: [...s.encounters, saved] };
        });

        const persistListStatus = async () => {
          if (!online || !saved.patientId || !saved.disease) return;
          try {
            const updated = await upsertPatientDiseaseStatus(saved.patientId, {
              diseaseId: saved.disease,
              disease: saved.disease,
              diagnosis: saved.diagnosis || saved.data?.diagnosis || "",
              outcome: outcomeToStatus(saved.outcome) || outcomeToStatus(saved.data?.outcome) || "",
              lastEncounter: saved.date || new Date().toISOString(),
            });
            if (updated) {
              const normalized = normalizeApiPatient(updated);
              if (normalized) {
                patch((s) => ({
                  patients: s.patients.map((p) =>
                    p.id === normalized.id
                      ? {
                          ...p,
                          diseases: normalized.diseases?.length ? normalized.diseases : p.diseases,
                          diseaseStatuses: normalized.diseaseStatuses,
                          lastEncounter: normalized.lastEncounter || p.lastEncounter,
                        }
                      : p
                  ),
                }));
              }
            }
          } catch (err) {
            console.warn("persist patient diseaseStatuses failed", err);
          }
        };

        if (needsQueue) {
          await putLocalEncounter(saved);
          const deps = [];
          const visitKey = saved.visitId || saved.id;
          const visitOp = await findOpForLocalVisit(visitKey);
          if (visitOp) deps.push(visitOp.id);
          const regOp = await findRegisterOpForPatient(saved.patientId);
          if (regOp) deps.push(regOp.id);
          const pending = await listPendingOps();
          const prior = pending.filter(
            (o) =>
              o.type === OP.SAVE_ENCOUNTER_FORM &&
              (o.payload?.localVisitId === visitKey || o.localEntityId === visitKey)
          );
          if (prior.length) {
            await deleteOps(prior.map((o) => o.id));
          }
          await enqueueOp({
            type: OP.SAVE_ENCOUNTER_FORM,
            localEntityId: visitKey,
            dependsOn: deps,
            label: `Form ${saved.disease || "visit"}`,
            payload: {
              patientId: saved.patientId,
              localVisitId: isLocalId(visitKey) ? visitKey : undefined,
              visitId: saved.visitId,
              encounterId: saved.encounterId,
              recordId: saved.recordId,
              featureCode: saved.featureCode || featureCodeForDisease(saved.disease),
              disease: saved.disease,
              data: cloneFormDataForSync(saved.data || {}),
              diagnosis: saved.diagnosis || saved.data?.diagnosis || "",
              outcome: outcomeToStatus(saved.outcome) || outcomeToStatus(saved.data?.outcome) || "",
            },
          });
        } else {
          await persistListStatus();
        }

        // Online + forgotten offline queue → prompt to sync before continuing elsewhere.
        if (online) {
          await offerSyncAfterSave();
        }
        return saved;
      },
      /**
       * Load form answers from HMIS PHI via portal-be and merge into local encounter.data.
       * Returns rehydrated form object (or null if nothing to load).
       * Dedupes concurrent / StrictMode double mounts so the network call runs once.
       */
      loadEncounterPhi: async (encounter) => {
        if (!encounter?.patientId || !encounter?.encounterId) return null;
        if (!online) return null;
        const featureCode = encounter.featureCode || featureCodeForDisease(encounter.disease);
        if (!featureCode) return null;
        const key = `${encounter.patientId}::${encounter.encounterId}::${featureCode}`;
        if (phiInflight?.key === key) return phiInflight.promise;

        const promise = fetchEncounterPhi(encounter.patientId, {
          featureCode,
          encounterId: encounter.encounterId,
        })
          .then((rows) => {
            if (!rows.length) return null;
            const form = rehydrateFormFromPhi(rows);
            patch((s) => {
              const next = s.encounters.map((e) => {
                if (e.id !== encounter.id && e.visitId !== encounter.visitId) return e;
                return {
                  ...e,
                  encounterId: encounter.encounterId,
                  featureCode,
                  data: { ...(e.data || {}), ...form },
                  diagnosis: form.diagnosis || e.diagnosis || "",
                  outcome: form.outcome || e.outcome || "",
                };
              });
              return { encounters: next };
            });
            return form;
          })
          .finally(() => {
            if (phiInflight?.promise === promise) phiInflight = null;
          });

        phiInflight = { key, promise };
        return promise;
      },
      /**
       * Autosave one question immediately via HMIS (ProgressEdited create / update).
       */
      upsertEncounterPhiField: async (encounter, itemPayload) => {
        if (!encounter?.patientId || !encounter?.encounterId || !encounter?.visitId) return null;
        if (!online) return null;
        const featureCode = encounter.featureCode || featureCodeForDisease(encounter.disease);
        if (!featureCode || !itemPayload?.item || !itemPayload?.subFeatureCode) return null;
        return upsertEncounterPhiItem(encounter.patientId, {
          featureCode,
          encounterId: encounter.encounterId,
          visitId: encounter.visitId,
          disease: encounter.disease,
          recordId: encounter.recordId || undefined,
          item: itemPayload.item,
          subFeatureCode: itemPayload.subFeatureCode,
          value: itemPayload.value,
          fieldKey: itemPayload.fieldKey,
        });
      },
      /**
       * Save / Save & close — flip ProgressEdited → action null for this visit.
       */
      finalizeEncounterPhi: async (encounter) => {
        if (!encounter?.patientId || !encounter?.encounterId || !encounter?.visitId) return null;
        if (!online) return null;
        const result = await finalizeEncounterPhi(encounter.patientId, {
          encounterId: encounter.encounterId,
          visitId: encounter.visitId,
          disease: encounter.disease,
          diagnosis: encounter.diagnosis || encounter.data?.diagnosis || "",
          outcome: outcomeToStatus(encounter.outcome) || outcomeToStatus(encounter.data?.outcome) || "",
          date: encounter.date || new Date().toISOString(),
          lastEncounter: encounter.date || new Date().toISOString(),
        });
        // Keep in-memory patient chips in sync without waiting for next list fetch.
        if (encounter.disease) {
          const diseaseId = String(encounter.disease).toLowerCase();
          const diagnosis = encounter.diagnosis || encounter.data?.diagnosis || "";
          const outcome = outcomeToStatus(encounter.outcome) || outcomeToStatus(encounter.data?.outcome) || "";
          const lastEncounter = encounter.date || new Date().toISOString();
          patch((s) => ({
            patients: s.patients.map((p) => {
              if (p.id !== encounter.patientId) return p;
              const prev = Array.isArray(p.diseaseStatuses) ? [...p.diseaseStatuses] : [];
              const idx = prev.findIndex((x) => String(x.diseaseId).toLowerCase() === diseaseId);
              const next = { diseaseId, diagnosis, outcome, lastEncounter };
              if (idx >= 0) prev[idx] = { ...prev[idx], ...next };
              else prev.push(next);
              const diseases = [...new Set([...(p.diseases || []), diseaseId])];
              const overall = [...prev]
                .map((x) => x.lastEncounter)
                .filter(Boolean)
                .sort((a, b) => String(b).localeCompare(String(a)))[0];
              return {
                ...p,
                diseases,
                diseaseStatuses: prev,
                lastEncounter: overall || p.lastEncounter || lastEncounter,
              };
            }),
          }));
        }
        return result;
      },
      /**
       * Cancel → Discard and leave — delete ProgressEdited drafts and restore prior committed PHI.
       * Also resets local encounter outcome/data to the provided baseline so the dashboard
       * does not keep an autosaved outcome (e.g. Cured) after discard.
       */
      discardEncounterPhi: async (encounter, baseline = null) => {
        if (!encounter?.patientId || !encounter?.encounterId) return null;
        let result = null;
        if (online && !String(encounter.encounterId).startsWith("local-")) {
          try {
            result = await discardEncounterPhiApi(encounter.patientId, {
              encounterId: encounter.encounterId,
            });
          } catch (err) {
            console.warn("discardEncounterPhi failed", err);
          }
        }
        if (baseline && (encounter.id || encounter.visitId)) {
          const visitKey = encounter.id || encounter.visitId;
          patch((s) => ({
            encounters: s.encounters.map((e) => {
              if (e.id !== visitKey && e.visitId !== visitKey && e.encounterId !== encounter.encounterId) {
                return e;
              }
              const data = baseline.data != null ? { ...(e.data || {}), ...baseline.data } : e.data;
              return {
                ...e,
                data,
                outcome: baseline.outcome != null ? baseline.outcome : e.outcome,
                diagnosis: baseline.diagnosis != null ? baseline.diagnosis : e.diagnosis,
              };
            }),
          }));
        }
        return result;
      },
      /**
       * Dashboard: load PHI for visits and merge into local encounter.data.
       * Uses episode API rows (not stale React state) so it always runs after reload.
       * When committed PHI exists, clears pendingStart so the dashboard shows the form summary.
       * Also awaits PUT disease-status so Patients list chips survive the next refresh
       * without requiring another form save (backfill for existing PHI like Thalapathy).
       */
      syncPatientVisitPhi: async (patientId, opts = {}) => {
        if (!patientId || !authSession?.facilityId) return [];

        let visits = Array.isArray(opts.visits) ? opts.visits : null;
        if (!visits?.length) {
          try {
            visits = await fetchPatientEpisodes(patientId);
          } catch (err) {
            console.warn("syncPatientVisitPhi episodes failed", err);
            visits = [];
          }
        }
        // Fallback to whatever is already in local state
        if (!visits?.length) {
          visits = state.encounters
            .filter((e) => e.patientId === patientId && e.visitId)
            .map((e) => ({
              visitId: e.visitId,
              recordId: e.recordId,
              featureCode: e.featureCode || featureCodeForDisease(e.disease),
              disease: e.disease,
              encounterId: e.encounterId,
              createdOn: e.date,
              visitDate: e.date,
            }));
        }
        if (!visits.length) return [];

        const visitMetaById = new Map(
          visits.map((row) => [String(row.visitId || row.id || ""), row])
        );

        const results = await Promise.all(
          visits.map(async (row) => {
            const visitId = row.visitId || row.id;
            if (!visitId) return null;
            try {
              const featureCode =
                row.featureCode || featureCodeForDisease(row.disease) || undefined;
              const phi = await fetchPhiByVisit(patientId, {
                visitId,
                recordId: row.recordId || undefined,
                featureCode,
              });
              if (!phi.hasAny && !phi.items?.length) return null;
              const form = rehydrateFormFromPhi(phi.items || []);
              const completed = phi.hasCommitted || Object.keys(form).length > 0;
              const visitDateRaw =
                row.visitDate ||
                row.createdOn ||
                row.date ||
                (typeof row.createdOn === "string" ? row.createdOn : "");
              const visitDate = visitDateRaw
                ? String(visitDateRaw).includes("T")
                  ? String(visitDateRaw)
                  : `${String(visitDateRaw).slice(0, 10)}T12:00:00`
                : "";
              return {
                visitId,
                form,
                completed,
                encounterId: row.encounterId || "",
                featureCode: featureCode || "",
                recordId: row.recordId || "",
                disease: row.disease || "",
                visitDate,
              };
            } catch (err) {
              console.warn("syncPatientVisitPhi visit failed", visitId, err);
              return null;
            }
          })
        );
        const loaded = results.filter(Boolean);
        if (!loaded.length) return [];

        // Build merged encounter rows outside setState so backfill does not rely on updater timing.
        const mergedEncounters = loaded.map((row) => {
          const existing = state.encounters.find((e) => e.id === row.visitId) || {};
          const meta = visitMetaById.get(String(row.visitId)) || {};
          const date =
            existing.date ||
            row.visitDate ||
            (meta.createdOn ? String(meta.createdOn) : "") ||
            new Date().toISOString();
          const diagnosis = row.form.diagnosis || existing.diagnosis || "";
          const outcome =
            row.form.outcome || existing.outcome || (row.completed ? "Active" : "Open");
          return {
            ...existing,
            id: row.visitId,
            visitId: row.visitId,
            patientId,
            recordId: row.recordId || existing.recordId || "",
            encounterId: row.encounterId || existing.encounterId || "",
            featureCode:
              row.featureCode ||
              existing.featureCode ||
              featureCodeForDisease(row.disease || existing.disease),
            episodeId: row.recordId || existing.episodeId || row.visitId,
            disease: row.disease || existing.disease || "",
            facility: existing.facility || meta.locationName || "",
            locationId: existing.locationId || "",
            type: existing.type || meta.visitType || "",
            referral: existing.referral || "No",
            date,
            worker: existing.worker || meta.clinicianName || "",
            treatment: existing.treatment || "",
            synced: true,
            data: { ...(existing.data || {}), ...row.form },
            diagnosis,
            outcome,
            pendingStart: row.completed ? false : existing.pendingStart !== false,
            complete: row.completed ? true : existing.complete === true,
            status: row.completed ? "Complete" : existing.status || "Pending",
          };
        });

        patch((s) => {
          const byId = new Map(s.encounters.map((e) => [e.id, e]));
          for (const merged of mergedEncounters) {
            byId.set(merged.id, { ...(byId.get(merged.id) || {}), ...merged });
          }
          return { encounters: [...byId.values()] };
        });

        // Build latest clinical status per disease from hydrated PHI / encounters.
        const latestByDisease = new Map();
        for (const enc of mergedEncounters) {
          const diseaseId = String(enc.disease || "").toLowerCase();
          if (!diseaseId) continue;
          const diagnosis = String(enc.diagnosis || enc.data?.diagnosis || "").trim();
          const outcome = String(enc.outcome || enc.data?.outcome || "").trim();
          // Skip pure placeholders — do not overwrite Confirmed/Worse with Open.
          if (!diagnosis && (!outcome || /^(open|active)$/i.test(outcome))) continue;
          const lastEncounter = enc.date || new Date().toISOString();
          const prev = latestByDisease.get(diseaseId);
          if (!prev || String(lastEncounter).localeCompare(String(prev.lastEncounter || "")) >= 0) {
            latestByDisease.set(diseaseId, {
              diseaseId,
              diagnosis: diagnosis || prev?.diagnosis || "",
              outcome: outcome || prev?.outcome || "",
              lastEncounter,
            });
          }
        }

        // Immediate in-memory patch so going back to Patients shows correct chips
        // even before / while the PUT round-trips.
        if (latestByDisease.size) {
          const statuses = [...latestByDisease.values()];
          const overall = statuses
            .map((s) => s.lastEncounter)
            .filter(Boolean)
            .sort((a, b) => String(b).localeCompare(String(a)))[0];
          patch((s) => ({
            patients: s.patients.map((p) => {
              if (p.id !== patientId) return p;
              const prev = Array.isArray(p.diseaseStatuses) ? [...p.diseaseStatuses] : [];
              for (const next of statuses) {
                const idx = prev.findIndex(
                  (x) => String(x.diseaseId).toLowerCase() === next.diseaseId
                );
                if (idx >= 0) prev[idx] = { ...prev[idx], ...next };
                else prev.push(next);
              }
              return {
                ...p,
                diseases: [...new Set([...(p.diseases || []), ...statuses.map((x) => x.diseaseId)])],
                diseaseStatuses: prev,
                lastEncounter: overall || p.lastEncounter,
              };
            }),
          }));
        }

        // Await TriasNtd persist so a subsequent list fetch (or refresh) stays correct.
        if (latestByDisease.size && online) {
          let lastDoc = null;
          for (const s of latestByDisease.values()) {
            try {
              lastDoc = await upsertPatientDiseaseStatus(patientId, {
                diseaseId: s.diseaseId,
                disease: s.diseaseId,
                diagnosis: s.diagnosis,
                outcome: s.outcome,
                lastEncounter: s.lastEncounter,
              });
            } catch (err) {
              console.warn("backfill diseaseStatuses failed", patientId, s.diseaseId, err);
            }
          }
          if (lastDoc) {
            const normalized = normalizeApiPatient(lastDoc);
            if (normalized) {
              patch((s) => ({
                patients: s.patients.map((p) =>
                  p.id === patientId
                    ? {
                        ...p,
                        diseases: normalized.diseases?.length ? normalized.diseases : p.diseases,
                        diseaseStatuses: normalized.diseaseStatuses?.length
                          ? normalized.diseaseStatuses
                          : p.diseaseStatuses,
                        lastEncounter: normalized.lastEncounter || p.lastEncounter,
                      }
                    : p
                ),
              }));
            }
          }
        }

        return loaded;
      },
      /**
       * Persist one-PHI-per-question answers to HMIS via portal-be.
       * Local draft is still saved separately via saveEncounter.
       * @deprecated prefer upsertEncounterPhiField + finalizeEncounterPhi
       */
      saveEncounterPhi: async (encounter) => {
        if (!encounter?.patientId || !encounter?.encounterId || !encounter?.visitId) {
          return null;
        }
        return finalizeEncounterPhi(encounter.patientId, {
          encounterId: encounter.encounterId,
          visitId: encounter.visitId,
          disease: encounter.disease,
          diagnosis: encounter.diagnosis || encounter.data?.diagnosis || "",
          outcome: outcomeToStatus(encounter.outcome) || outcomeToStatus(encounter.data?.outcome) || "",
          date: encounter.date || new Date().toISOString(),
          lastEncounter: encounter.date || new Date().toISOString(),
        });
      },
      dismissSyncPrompt: () => setSyncPrompt(null),
      refreshOutboxState,
      syncNow: async () => {
        if (!online) return { synced: 0, failed: 0, errors: [{ message: "No internet" }] };
        if (!authSession?.facilityId) {
          return { synced: 0, failed: 0, errors: [{ message: "Sign in required to sync" }] };
        }
        const results = await syncOutbox({
          authSession,
          onOpDone: async ({ op, detail }) => {
            if (op.type === OP.REGISTER_PATIENT && detail.localPatientId && detail.patientId) {
              patch((s) => ({
                patients: s.patients.map((p) =>
                  p.id === detail.localPatientId
                    ? {
                        ...p,
                        id: detail.patientId,
                        patientId: detail.patientId,
                        patientCode: detail.patientCode || "",
                        localOnly: false,
                        synced: true,
                      }
                    : p
                ),
                encounters: s.encounters.map((e) =>
                  e.patientId === detail.localPatientId
                    ? { ...e, patientId: detail.patientId }
                    : e
                ),
                suspects: s.suspects.map((x) =>
                  x.patientId === detail.localPatientId
                    ? { ...x, patientId: detail.patientId }
                    : x
                ),
              }));
            }
            if (
              (op.type === OP.START_EPISODE || op.type === OP.ADD_VISIT || op.type === OP.START_SUSPECT) &&
              detail.localVisitId &&
              detail.visitId
            ) {
              patch((s) => ({
                encounters: s.encounters.map((e) =>
                  e.id === detail.localVisitId || e.visitId === detail.localVisitId
                    ? {
                        ...e,
                        id: detail.visitId,
                        visitId: detail.visitId,
                        recordId: detail.recordId || e.recordId,
                        encounterId: detail.encounterId || e.encounterId,
                        featureCode: detail.featureCode || e.featureCode,
                        patientId: detail.patientId || e.patientId,
                        episodeId: detail.recordId || e.episodeId,
                        localOnly: false,
                        synced: op.type === OP.SAVE_ENCOUNTER_FORM ? e.synced : e.complete ? false : true,
                      }
                    : e
                ),
              }));
            }
            if (op.type === OP.SAVE_ENCOUNTER_FORM && detail.localVisitId) {
              patch((s) => ({
                encounters: s.encounters.map((e) =>
                  e.id === detail.localVisitId ||
                  e.visitId === detail.localVisitId ||
                  e.visitId === detail.visitId
                    ? {
                        ...e,
                        id: detail.visitId || e.id,
                        visitId: detail.visitId || e.visitId,
                        encounterId: detail.encounterId || e.encounterId,
                        recordId: detail.recordId || e.recordId,
                        patientId: detail.patientId || e.patientId,
                        synced: true,
                        localOnly: false,
                      }
                    : e
                ),
              }));
            }
            if (op.type === OP.START_SUSPECT && detail.localSuspectId) {
              patch((s) => ({
                suspects: s.suspects.map((x) =>
                  x.id === detail.localSuspectId
                    ? {
                        ...x,
                        id: detail.suspectId || detail.visitMetaId || detail.visitId || x.id,
                        visitId: detail.visitId || x.visitId,
                        synced: true,
                        localOnly: false,
                        patientId: detail.patientId || x.patientId,
                      }
                    : x
                ),
              }));
            }
          },
        });
        await refreshOutboxState();
        setSyncPrompt(null);
        // Refresh facility patient list after successful syncs
        if (results.synced > 0 && authSession?.facilityId) {
          try {
            clearPatientsLoadCache();
            const rows = await fetchPatients({ facilityId: authSession.facilityId, limit: 200 });
            const remote = rows.map(normalizeApiPatient).filter(Boolean);
            patch((s) => {
              const localOnly = s.patients.filter((p) => p.localOnly || isLocalId(p.id));
              const byId = new Map(remote.map((p) => [p.id, p]));
              localOnly.forEach((p) => {
                if (!byId.has(p.id)) byId.set(p.id, p);
              });
              return { patients: [...byId.values()] };
            });
          } catch (err) {
            console.warn("post-sync patient refresh failed", err);
          }
        }
        return results;
      },
      resetDemo: () => {
        setAuthSession(null);
        clearLegacyAuthPersist();
        clearPatientsLoadCache();
        clearRecordLoadCaches();
        setState(initial());
      },
    };
  }, [state, online, syncPrompt, authSession, authReady, refreshOutboxState, offerSyncAfterSave]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
