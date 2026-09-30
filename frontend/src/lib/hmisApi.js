import axios from "axios";
import { config } from "@/config";
import { mapNtdPatientToHmis, mapNtdPatientToHmisUpdate } from "@/lib/hmisPatient";

/** All NTD network calls go to tri-clinician-portal-be only. */
const http = axios.create({
  baseURL: config.apiURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

function apiError(err, fallback) {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data?.message) return String(data.message);
  if (err?.message) return err.message;
  return fallback;
}

/**
 * Login via BFF → admin facility resolve → tri-authentication.
 * Facility host comes from the frontend (same as Apex / HMIS):
 * - production: window.location.hostname
 * - localhost: REACT_APP_FACILITY_URL (optional local override)
 * Backend does not hardcode FACILITY_URL.
 */
export async function loginWithTriAuth(email, password) {
  const host =
    typeof window !== "undefined" && window.location?.hostname
      ? String(window.location.hostname).toLowerCase()
      : "";
  const isLocal =
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost");
  const facilityUrl = isLocal ? config.facilityUrl : host;
  const loginRes = await http.post("/api/auth/login", {
    email,
    password,
    ...(facilityUrl ? { facilityUrl } : {}),
  });
  if (!loginRes.data?.status) {
    throw new Error(loginRes.data?.message || "Login failed");
  }
  const data = loginRes.data.data || {};
  return {
    userId: data.userId,
    facilityId: data.facilityId,
    facilityCode: data.facilityCode,
    clientId: data.clientId,
    facilityName: data.facilityName,
    email: data.email || email,
    displayName: data.displayName || "",
    allowedDiseases: Array.isArray(data.allowedDiseases)
      ? data.allowedDiseases.map(String)
      : [],
  };
}

/**
 * Bootstrap session from httpOnly bearer cookie (no localStorage).
 * Returns null when cookie missing/expired.
 */
export async function fetchAuthSession() {
  try {
    const res = await http.get("/api/auth/session");
    if (!res.data?.status) return null;
    const data = res.data.data || {};
    if (!data.userId || !data.facilityId) return null;
    return {
      userId: data.userId,
      facilityId: data.facilityId,
      facilityCode: data.facilityCode || "",
      clientId: data.clientId || "",
      facilityName: data.facilityName || "",
      email: data.email || "",
      displayName: data.displayName || "",
      allowedDiseases: Array.isArray(data.allowedDiseases)
        ? data.allowedDiseases.map(String)
        : [],
    };
  } catch (err) {
    if (err?.response?.status === 401) return null;
    throw err;
  }
}

/** Refresh disease grants for the current bearer session. */
export async function fetchAllowedDiseases() {
  const res = await http.get("/api/auth/allowed-diseases");
  if (!res.data?.status) {
    throw new Error(res.data?.message || "Failed to load allowed diseases");
  }
  const ids = res.data?.data?.allowedDiseases;
  return Array.isArray(ids) ? ids.map(String) : [];
}

export async function logoutTriAuth() {
  try {
    await http.get("/api/auth/logout");
  } catch (_) {
    /* cookie may already be cleared — still treat as logged out */
  }
}

/** Fetch patients from tri-clinician-portal-be Mongo (not HMIS). */
export async function fetchPatients({ facilityId, q, limit = 200 } = {}) {
  const params = { limit };
  if (facilityId) params.facilityId = facilityId;
  if (q) params.q = q;
  const res = await http.get("/api/patients", { params });
  if (!res.data?.status) {
    throw new Error(res.data?.message || "Failed to load patients");
  }
  return Array.isArray(res.data.data) ? res.data.data : [];
}

/** HMIS address options via portal-be BFF — { value, viewValue }[] */
function normalizeGeoOptions(data) {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const value = String(row.value ?? row.id ?? "");
      const viewValue = String(row.viewValue ?? row.name ?? row.label ?? "");
      if (!value || !viewValue) return null;
      return { value, viewValue };
    })
    .filter(Boolean);
}

export async function fetchGeoCountries() {
  const res = await http.get("/api/geo/countries");
  if (!res.data?.status) {
    throw new Error(res.data?.message || "Failed to load countries");
  }
  return normalizeGeoOptions(res.data.data);
}

/**
 * Cascade geography search (same as Apex).
 * type: Country | Province | District | Village
 * parentId: parent reference UUID (use "id" for Country search)
 */
export async function fetchGeoOptions(type, parentId = "id", q = "") {
  const res = await http.get("/api/geo/search", {
    params: { type, parentId: parentId || "id", q: q || "" },
  });
  if (!res.data?.status) {
    throw new Error(res.data?.message || `Failed to load ${type}`);
  }
  return normalizeGeoOptions(res.data.data);
}

export async function fetchFacilityGeoDefaults() {
  try {
    const res = await http.get("/api/geo/facility");
    if (!res.data?.status) return null;
    const d = res.data.data || {};
    return {
      country: normalizeGeoOptions(d.country),
      province: normalizeGeoOptions(d.province),
      district: normalizeGeoOptions(d.district),
    };
  } catch (_) {
    return null;
  }
}

/** Active LocationsT rows the logged-in user can access (ACM, same as Apex OP booking). */
export async function fetchLocations({ facilityId, all } = {}) {
  const params = {};
  if (all) params.scope = "all";
  else if (facilityId) params.facilityId = facilityId;
  const res = await http.get("/api/locations", { params });
  if (!res.data?.status) {
    throw new Error(res.data?.message || "Failed to load locations");
  }
  const rows = Array.isArray(res.data.data) ? res.data.data : [];
  return rows
    .map((r) => ({
      id: r.id || r.locationId,
      name: r.name || r.locationName || "",
      facilityId: r.facilityId || "",
    }))
    .filter((r) => r.name);
}

/** Start NTD episode: creates RecordsT + VisitsT + VisitMetaT via portal-be. */
export async function startEpisode(patientId, body) {
  try {
    const res = await http.post(`/api/patients/${encodeURIComponent(patientId)}/episodes`, body);
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Failed to start episode");
    }
    return res.data.data || {};
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    throw new Error(apiError(err, "Failed to start episode"));
  }
}

/** Add a visit to an existing episode (same location / disease). */
export async function addEpisodeVisit(patientId, recordId, body) {
  try {
    const res = await http.post(
      `/api/patients/${encodeURIComponent(patientId)}/episodes/${encodeURIComponent(recordId)}/visits`,
      body
    );
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Failed to add encounter");
    }
    return res.data.data || {};
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    throw new Error(apiError(err, "Failed to add encounter"));
  }
}

/** List NTD episodes/visits for a patient (VisitMetaT disease map). */
export async function fetchPatientEpisodes(patientId, { disease } = {}) {
  const params = {};
  if (disease) params.disease = disease;
  const res = await http.get(`/api/patients/${encodeURIComponent(patientId)}/episodes`, { params });
  if (!res.data?.status) {
    throw new Error(res.data?.message || "Failed to load episodes");
  }
  return Array.isArray(res.data.data) ? res.data.data : [];
}

/** Persist suspect screening (+ optional disease episode) via VisitMetaT. */
export async function startSuspectEpisode(patientId, body) {
  try {
    const res = await http.post(
      `/api/patients/${encodeURIComponent(patientId)}/suspect-episodes`,
      body
    );
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Failed to save suspect screening");
    }
    return res.data.data || {};
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    throw new Error(apiError(err, "Failed to save suspect screening"));
  }
}

/** List suspect screenings for a patient (VisitMetaT ntd-suspect). */
export async function fetchPatientSuspects(patientId) {
  const res = await http.get(`/api/patients/${encodeURIComponent(patientId)}/suspects`);
  if (!res.data?.status) {
    throw new Error(res.data?.message || "Failed to load suspects");
  }
  return Array.isArray(res.data.data) ? res.data.data : [];
}

/** Facility appointments (NTD visits) for the Appointments page. */
export async function fetchAppointments({ facilityId, from, to, limit = 200 } = {}) {
  const params = { limit };
  if (facilityId) params.facilityId = facilityId;
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await http.get("/api/appointments", { params });
  if (!res.data?.status) {
    throw new Error(res.data?.message || "Failed to load appointments");
  }
  return Array.isArray(res.data.data) ? res.data.data : [];
}

/** Fetch encounter PHI from HMIS via portal-be (one row per question). */
export async function fetchEncounterPhi(patientId, { featureCode, encounterId, subFeatureCode } = {}) {
  try {
    const params = { featureCode, encounterId };
    if (subFeatureCode) params.subFeatureCode = subFeatureCode;
    const res = await http.get(`/api/patients/${encodeURIComponent(patientId)}/phi`, { params });
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Failed to load form answers");
    }
    return Array.isArray(res.data.data) ? res.data.data : [];
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    throw new Error(apiError(err, "Failed to load form answers"));
  }
}

/** Dashboard: PHI by visitId (+ optional recordId) from portal-be Mongo. */
export async function fetchPhiByVisit(patientId, { visitId, recordId, featureCode } = {}) {
  try {
    const params = { visitId };
    if (recordId) params.recordId = recordId;
    if (featureCode) params.featureCode = featureCode;
    const res = await http.get(`/api/patients/${encodeURIComponent(patientId)}/phi/by-visit`, {
      params,
    });
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Failed to load visit answers");
    }
    const data = res.data.data;
    // New shape: { items, hasCommitted, hasAny }; legacy: bare array
    if (Array.isArray(data)) {
      return { items: data, hasCommitted: data.length > 0, hasAny: data.length > 0, count: data.length };
    }
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      hasCommitted: Boolean(data?.hasCommitted),
      hasAny: Boolean(data?.hasAny ?? data?.count),
      count: Number(data?.count || 0),
    };
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    throw new Error(apiError(err, "Failed to load visit answers"));
  }
}

/** Autosave one question → HMIS create (ProgressEdited) or update. */
export async function upsertEncounterPhiItem(patientId, body) {
  try {
    const res = await http.put(`/api/patients/${encodeURIComponent(patientId)}/phi/item`, body);
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Failed to save answer");
    }
    return res.data.data || {};
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    throw new Error(apiError(err, "Failed to save answer"));
  }
}

/** Save / Save & close → ProgressEdited → action null (+ persist diseaseStatuses for list chips). */
export async function finalizeEncounterPhi(
  patientId,
  { encounterId, visitId, disease, diagnosis, outcome, date, lastEncounter }
) {
  try {
    const res = await http.post(`/api/patients/${encodeURIComponent(patientId)}/phi/finalize`, {
      encounterId,
      visitId,
      disease: disease || undefined,
      diagnosis: diagnosis || undefined,
      outcome: outcome || undefined,
      date: date || lastEncounter || undefined,
      lastEncounter: lastEncounter || date || undefined,
    });
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Failed to finalize form");
    }
    return res.data.data || {};
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    throw new Error(apiError(err, "Failed to finalize form"));
  }
}

/** Persist latest diagnosis/outcome/lastEncounter on TriasNtd patient (Patients list chips). */
export async function upsertPatientDiseaseStatus(patientId, body) {
  try {
    const res = await http.put(
      `/api/patients/${encodeURIComponent(patientId)}/disease-status`,
      body
    );
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Failed to update disease status");
    }
    return res.data.data || {};
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    throw new Error(apiError(err, "Failed to update disease status"));
  }
}

/** Cancel → Discard and leave → delete ProgressEdited drafts for this encounter. */
export async function discardEncounterPhi(patientId, { encounterId }) {
  try {
    const res = await http.post(`/api/patients/${encodeURIComponent(patientId)}/phi/discard`, {
      encounterId,
    });
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Failed to discard draft answers");
    }
    return res.data.data || {};
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    throw new Error(apiError(err, "Failed to discard draft answers"));
  }
}

/** NTD React form schemas from ApplicationConfig (NTD_SUSPECT, NTD_SCAS, …). */
export async function fetchNtdFormConfigs() {
  const res = await http.get("/api/ntd/form-configs");
  if (!res.data?.status) {
    throw new Error(res.data?.message || "Failed to load form configs");
  }
  return res.data.data || {};
}

/**
 * Type-ahead search against Apex Drug inventory (stocked items only).
 * Empty query returns [] — options appear only after the user types.
 */
export async function searchDrugInventory(q) {
  const query = String(q || "").trim();
  if (!query) return [];
  try {
    const res = await http.get("/api/drugs/search", { params: { q: query } });
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Failed to search drug inventory");
    }
    return Array.isArray(res.data.data) ? res.data.data : [];
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    throw new Error(apiError(err, "Failed to search drug inventory"));
  }
}

/**
 * Map payload in NTD, then POST to BFF → tri-hmis POST /patient.
 */
export async function createHmisPatient(formState) {
  const body = mapNtdPatientToHmis(formState);
  try {
    const res = await http.post("/api/patients/register", body);
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Patient create failed");
    }
    const data = res.data.data || {};
    const patientIndex = data.patientIndex || data;
    const patientId = patientIndex.patientId || data.patientId;
    const patientCode = patientIndex.patientCode || data.patientCode || "";
    if (!patientId) {
      throw new Error("HMIS did not return patientId");
    }
    return { patientId, patientCode, raw: data };
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    if (err?.response?.status === 403 || err?.response?.data === "FORBIDDEN") {
      throw new Error("Not allowed to register patients (missing RGPE policy)");
    }
    throw new Error(apiError(err, "Failed to create patient"));
  }
}

/**
 * Update patient demographics via BFF → HMIS PUT /patient/:id, then TriasNtd mirror.
 */
export async function updateHmisPatient(patientId, formState) {
  if (!patientId) throw new Error("patientId is required");
  const body = mapNtdPatientToHmisUpdate(formState);
  try {
    const res = await http.put(`/api/patients/${encodeURIComponent(patientId)}`, body);
    if (!res.data?.status) {
      throw new Error(res.data?.message || "Patient update failed");
    }
    return { patientId, raw: res.data.data || res.data };
  } catch (err) {
    if (err?.response?.status === 401) {
      throw new Error("Not authenticated — sign in with programme credentials");
    }
    if (err?.response?.status === 403 || err?.response?.data === "FORBIDDEN") {
      throw new Error("Not allowed to update patients");
    }
    throw new Error(apiError(err, "Failed to update patient"));
  }
}

/* -------------------- School Health (portal-be → HMIS) -------------------- */

function shData(res, fallback) {
  if (!res.data?.status) throw new Error(res.data?.message || fallback);
  return res.data.data;
}

export async function fetchSchoolHealthSchools() {
  const res = await http.get("/api/school-health/schools");
  return shData(res, "Failed to load schools") || [];
}

export async function createSchoolHealthSchool(body) {
  const res = await http.post("/api/school-health/schools", body);
  return shData(res, "Failed to create school");
}

export async function deleteSchoolHealthSchool(schoolId) {
  const res = await http.delete(`/api/school-health/schools/${encodeURIComponent(schoolId)}`);
  return shData(res, "Failed to remove school");
}

export async function fetchSchoolHealthDonors() {
  const res = await http.get("/api/school-health/donors");
  return shData(res, "Failed to load donors") || [];
}

export async function createSchoolHealthDonor(body) {
  const res = await http.post("/api/school-health/donors", body);
  return shData(res, "Failed to create donor");
}

export async function deleteSchoolHealthDonor(donorId) {
  const res = await http.delete(`/api/school-health/donors/${encodeURIComponent(donorId)}`);
  return shData(res, "Failed to remove donor");
}

export async function fetchSchoolHealthVisits(params = {}) {
  const res = await http.get("/api/school-health/visits", { params });
  return shData(res, "Failed to load school health visits") || [];
}

export async function fetchSchoolHealthVisit(visitId) {
  const res = await http.get(`/api/school-health/visits/${encodeURIComponent(visitId)}`);
  return shData(res, "Failed to load school health visit");
}

export async function createSchoolHealthVisit(body) {
  const res = await http.post("/api/school-health/visits", body);
  return shData(res, "Failed to create school health visit");
}

export async function updateSchoolHealthVisit(visitId, body) {
  const res = await http.patch(`/api/school-health/visits/${encodeURIComponent(visitId)}`, body);
  return shData(res, "Failed to update school health visit");
}

export async function deleteSchoolHealthVisit(visitId) {
  const res = await http.delete(`/api/school-health/visits/${encodeURIComponent(visitId)}`);
  return shData(res, "Failed to remove school health visit");
}

export async function saveSchoolHealthChild(visitId, child) {
  const res = await http.post(
    `/api/school-health/visits/${encodeURIComponent(visitId)}/children`,
    child
  );
  return shData(res, "Failed to save child");
}

export async function deleteSchoolHealthChild(visitId, childId) {
  const res = await http.delete(
    `/api/school-health/visits/${encodeURIComponent(visitId)}/children/${encodeURIComponent(childId)}`
  );
  return shData(res, "Failed to remove child");
}

export async function saveSchoolHealthReport(visitId, report) {
  const res = await http.put(
    `/api/school-health/visits/${encodeURIComponent(visitId)}/report`,
    report
  );
  return shData(res, "Failed to save report");
}
