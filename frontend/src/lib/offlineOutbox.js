/**
 * Offline outbox + local entity persistence (IndexedDB).
 * Ops are replayed to portal-be / HMIS when the user taps Sync.
 */

import { idbDelete, idbDeleteMany, idbGet, idbGetAll, idbPut } from "@/lib/offlineDb";

export const OP = {
  REGISTER_PATIENT: "REGISTER_PATIENT",
  START_EPISODE: "START_EPISODE",
  ADD_VISIT: "ADD_VISIT",
  START_SUSPECT: "START_SUSPECT",
  SAVE_ENCOUNTER_FORM: "SAVE_ENCOUNTER_FORM",
};

export function newLocalId(prefix = "local") {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

export function isLocalId(id) {
  return typeof id === "string" && id.startsWith("local-");
}

/** Clone form data for outbox / PHI sync (keeps assessment photographs). */
export function cloneFormDataForSync(data = {}) {
  if (!data || typeof data !== "object") return data || {};
  return JSON.parse(JSON.stringify(data));
}

/** @deprecated use cloneFormDataForSync — photos are synced to HMIS on Sync. */
export function stripPhotosFromFormData(data = {}) {
  return cloneFormDataForSync(data);
}

export async function enqueueOp({
  type,
  localEntityId = "",
  dependsOn = [],
  payload = {},
  label = "",
}) {
  const op = {
    id: newLocalId("op"),
    type,
    localEntityId: localEntityId || "",
    dependsOn: Array.isArray(dependsOn) ? dependsOn.filter(Boolean) : [],
    payload,
    label: label || type,
    status: "pending",
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await idbPut("outbox", op);
  return op;
}

export async function listOutboxOps() {
  const rows = await idbGetAll("outbox");
  return rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function listPendingOps() {
  const rows = await listOutboxOps();
  return rows.filter((o) => o.status === "pending" || o.status === "failed" || o.status === "in_progress");
}

export async function countPendingOps() {
  const rows = await listPendingOps();
  return rows.length;
}

export async function updateOp(id, patch) {
  const cur = await idbGet("outbox", id);
  if (!cur) return null;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  await idbPut("outbox", next);
  return next;
}

export async function deleteOps(ids) {
  await idbDeleteMany("outbox", ids);
}

export async function setIdMapping(localId, remote) {
  if (!localId || !remote) return;
  await idbPut("idMap", {
    id: localId,
    ...remote,
    updatedAt: new Date().toISOString(),
  });
}

export async function getIdMapping(localId) {
  if (!localId) return null;
  return idbGet("idMap", localId);
}

export async function resolveEntityId(id) {
  if (!id) return id;
  if (!isLocalId(id)) return id;
  const map = await getIdMapping(id);
  return map?.remoteId || map?.patientId || map?.visitId || map?.recordId || map?.encounterId || id;
}

export async function resolvePatientIds(patientId) {
  if (!patientId) return { patientId };
  if (!isLocalId(patientId)) return { patientId };
  const map = await getIdMapping(patientId);
  return {
    patientId: map?.patientId || map?.remoteId || patientId,
    patientCode: map?.patientCode || "",
  };
}

export async function putLocalPatient(patient) {
  await idbPut("patients", { ...patient, id: patient.id });
  return patient;
}

export async function putLocalEncounter(enc) {
  await idbPut("encounters", { ...enc, id: enc.id });
  return enc;
}

export async function putLocalSuspect(sus) {
  await idbPut("suspects", { ...sus, id: sus.id });
  return sus;
}

export async function getLocalPatients() {
  return idbGetAll("patients");
}

export async function getLocalEncounters() {
  return idbGetAll("encounters");
}

export async function getLocalSuspects() {
  return idbGetAll("suspects");
}

export async function deleteLocalPatient(id) {
  await idbDelete("patients", id);
}

export async function deleteLocalEncounter(id) {
  await idbDelete("encounters", id);
}

export async function deleteLocalSuspect(id) {
  await idbDelete("suspects", id);
}

/** Find the latest pending op that created a visit for this local visit id. */
export async function findOpForLocalVisit(localVisitId) {
  const ops = await listOutboxOps();
  return (
    ops.find(
      (o) =>
        (o.type === OP.START_EPISODE || o.type === OP.ADD_VISIT || o.type === OP.START_SUSPECT) &&
        (o.payload?.localVisitId === localVisitId || o.localEntityId === localVisitId) &&
        o.status !== "done"
    ) || null
  );
}

export async function findRegisterOpForPatient(localPatientId) {
  const ops = await listOutboxOps();
  return (
    ops.find(
      (o) =>
        o.type === OP.REGISTER_PATIENT &&
        (o.localEntityId === localPatientId || o.payload?.localPatientId === localPatientId) &&
        o.status !== "done"
    ) || null
  );
}
