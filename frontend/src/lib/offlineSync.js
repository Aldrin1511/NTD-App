/**
 * Replay IndexedDB outbox ops against existing portal-be / HMIS endpoints.
 */

import {
  createHmisPatient,
  startEpisode,
  addEpisodeVisit,
  startSuspectEpisode,
  upsertEncounterPhiItem,
  finalizeEncounterPhi,
  fetchPatientEpisodes,
} from "@/lib/hmisApi";
import { flattenEncounterToPhiItems, featureCodeForDisease } from "@/lib/phiMap";
import {
  OP,
  listPendingOps,
  listOutboxOps,
  updateOp,
  deleteOps,
  setIdMapping,
  resolvePatientIds,
  resolveEntityId,
  getIdMapping,
  deleteLocalPatient,
  deleteLocalEncounter,
  deleteLocalSuspect,
  cloneFormDataForSync,
  isLocalId,
} from "@/lib/offlineOutbox";

function depsSatisfied(op, doneIds) {
  return (op.dependsOn || []).every((id) => doneIds.has(id));
}

async function replayRegister(op) {
  const formState = op.payload?.formState;
  if (!formState) throw new Error("REGISTER_PATIENT missing formState");
  const { patientId, patientCode } = await createHmisPatient(formState);
  const localPatientId = op.localEntityId || op.payload.localPatientId;
  if (localPatientId) {
    await setIdMapping(localPatientId, { remoteId: patientId, patientId, patientCode });
  }
  return { patientId, patientCode, localPatientId };
}

async function replayStartEpisode(op, facilityId, clinicianId) {
  const p = op.payload || {};
  const { patientId } = await resolvePatientIds(p.patientId);
  if (isLocalId(patientId)) {
    throw new Error("Patient must be synced before starting an episode");
  }
  const data = await startEpisode(patientId, {
    disease: p.disease,
    visitType: p.visitType,
    locationId: p.locationId,
    locationName: p.locationName,
    visitDate: p.visitDate,
    referral: p.referral || "No",
    clinicianName: p.clinicianName,
    facilityId: p.facilityId || facilityId,
    clinicianId: p.clinicianId || clinicianId,
  });
  const localVisitId = p.localVisitId || op.localEntityId;
  const localRecordId = p.localRecordId;
  if (localVisitId) {
    await setIdMapping(localVisitId, {
      remoteId: data.visitId,
      visitId: data.visitId,
      recordId: data.recordId,
      encounterId: data.encounterId || "",
      featureCode: data.featureCode || "",
      patientId,
    });
  }
  if (localRecordId && data.recordId) {
    await setIdMapping(localRecordId, {
      remoteId: data.recordId,
      recordId: data.recordId,
      patientId,
    });
  }
  return { ...data, patientId, localVisitId, localRecordId };
}

async function replayAddVisit(op, facilityId, clinicianId) {
  const p = op.payload || {};
  const { patientId } = await resolvePatientIds(p.patientId);
  const recordId = await resolveEntityId(p.recordId);
  if (isLocalId(patientId) || isLocalId(recordId)) {
    throw new Error("Patient/episode must be synced before adding a visit");
  }
  const data = await addEpisodeVisit(patientId, recordId, {
    disease: p.disease,
    visitType: p.visitType,
    locationId: p.locationId,
    locationName: p.locationName,
    visitDate: p.visitDate,
    referral: p.referral || "No",
    clinicianName: p.clinicianName,
    facilityId: p.facilityId || facilityId,
    clinicianId: p.clinicianId || clinicianId,
  });
  const localVisitId = p.localVisitId || op.localEntityId;
  if (localVisitId) {
    await setIdMapping(localVisitId, {
      remoteId: data.visitId,
      visitId: data.visitId,
      recordId: recordId || data.recordId,
      encounterId: data.encounterId || "",
      featureCode: data.featureCode || "",
      patientId,
    });
  }
  return { ...data, patientId, recordId, localVisitId };
}

async function replayStartSuspect(op, facilityId, clinicianId) {
  const p = op.payload || {};
  const { patientId } = await resolvePatientIds(p.patientId);
  if (isLocalId(patientId)) {
    throw new Error("Patient must be synced before suspect screening");
  }
  const data = await startSuspectEpisode(patientId, {
    disease: p.disease || undefined,
    suspect: p.suspect,
    symptoms: p.symptoms || [],
    notes: p.notes || "",
    photos: Array.isArray(p.photos) ? p.photos : [],
    visitType: p.visitType,
    locationId: p.locationId,
    locationName: p.locationName,
    visitDate: p.visitDate,
    referral: p.referral || "No",
    clinicianName: p.clinicianName,
    facilityId: p.facilityId || facilityId,
    clinicianId: p.clinicianId || clinicianId,
  });
  const localVisitId = p.localVisitId || op.localEntityId;
  const localSuspectId = p.localSuspectId;
  if (localVisitId && data.visitId) {
    await setIdMapping(localVisitId, {
      remoteId: data.visitId,
      visitId: data.visitId,
      recordId: data.recordId || "",
      encounterId: data.encounterId || "",
      featureCode: data.featureCode || "",
      patientId,
    });
  }
  if (localSuspectId) {
    await setIdMapping(localSuspectId, {
      remoteId: data.suspectId || data.visitId || localSuspectId,
      patientId,
    });
  }
  return { ...data, patientId, localVisitId, localSuspectId };
}

async function replaySaveForm(op) {
  const p = op.payload || {};
  const { patientId } = await resolvePatientIds(p.patientId);
  let visitId = p.visitId;
  let encounterId = p.encounterId;
  let recordId = p.recordId;
  let featureCode = p.featureCode || featureCodeForDisease(p.disease);
  const disease = String(p.disease || "").toLowerCase();

  if (p.localVisitId) {
    const map = await getIdMapping(p.localVisitId);
    if (map) {
      visitId = map.visitId || visitId;
      encounterId = map.encounterId || encounterId;
      recordId = map.recordId || recordId;
      featureCode = map.featureCode || featureCode || featureCodeForDisease(disease);
    }
  }

  visitId = await resolveEntityId(visitId);
  encounterId = await resolveEntityId(encounterId);
  recordId = await resolveEntityId(recordId);

  let resolvedPatientId = patientId;
  if (isLocalId(resolvedPatientId)) {
    if (p.localVisitId) {
      const map = await getIdMapping(p.localVisitId);
      if (map?.patientId && !isLocalId(map.patientId)) resolvedPatientId = map.patientId;
    }
    if (isLocalId(resolvedPatientId)) {
      const mapped = await resolvePatientIds(p.patientId);
      resolvedPatientId = mapped.patientId;
    }
  }

  if (isLocalId(resolvedPatientId) || !visitId || isLocalId(visitId)) {
    throw new Error("Visit must be synced before uploading form answers");
  }

  if (!encounterId || isLocalId(encounterId)) {
    const map = p.localVisitId ? await getIdMapping(p.localVisitId) : null;
    encounterId = map?.encounterId || encounterId;
  }

  // Fallback: look up encounterId from episode list after visit exists in Postgres
  if (!encounterId || isLocalId(encounterId)) {
    try {
      const rows = await fetchPatientEpisodes(resolvedPatientId, { disease: disease || undefined });
      const match = (rows || []).find(
        (r) => String(r.visitId || r.id || "") === String(visitId)
      );
      if (match?.encounterId) {
        encounterId = String(match.encounterId);
        if (!recordId && match.recordId) recordId = String(match.recordId);
        if (!featureCode && match.featureCode) featureCode = String(match.featureCode);
        if (p.localVisitId) {
          await setIdMapping(p.localVisitId, {
            remoteId: visitId,
            visitId,
            recordId: recordId || "",
            encounterId,
            featureCode: featureCode || "",
            patientId: resolvedPatientId,
          });
        }
      }
    } catch (err) {
      console.warn("encounterId lookup via episodes failed", err);
    }
  }

  if (!encounterId || isLocalId(encounterId)) {
    throw new Error("Missing encounterId for form sync — sync the episode first");
  }
  if (!disease) {
    throw new Error("Missing disease on form sync payload");
  }
  if (!featureCode) {
    featureCode = featureCodeForDisease(disease);
  }
  if (!featureCode) {
    throw new Error(`Missing featureCode for disease ${disease}`);
  }

  const data = cloneFormDataForSync(p.data || {});
  const items = flattenEncounterToPhiItems({
    disease,
    data,
    diagnosis: p.diagnosis,
    outcome: p.outcome,
  });

  if (!items.length) {
    throw new Error("No form answers to sync — save the entry form again while offline, then Sync");
  }

  const phiBodyBase = {
    featureCode,
    encounterId,
    visitId,
    recordId: recordId || "",
    disease,
  };

  for (const item of items) {
    await upsertEncounterPhiItem(resolvedPatientId, {
      ...phiBodyBase,
      item: item.item,
      subFeatureCode: item.subFeatureCode,
      value: item.value,
      fieldKey: item.fieldKey,
    });
  }

  await finalizeEncounterPhi(resolvedPatientId, {
    encounterId,
    visitId,
    disease,
    diagnosis: p.diagnosis || data.diagnosis || "",
    outcome: p.outcome || data.outcome || "",
    date: p.date || new Date().toISOString(),
    lastEncounter: p.date || new Date().toISOString(),
  });
  return {
    patientId: resolvedPatientId,
    visitId,
    encounterId,
    recordId,
    localVisitId: p.localVisitId || op.localEntityId,
    itemCount: items.length,
    photoCount: Array.isArray(data.photos) ? data.photos.length : 0,
  };
}

/**
 * Process pending outbox ops in dependency order.
 */
export async function syncOutbox({ authSession, onOpDone } = {}) {
  if (!authSession?.facilityId) {
    throw new Error("Sign in with programme credentials before syncing");
  }

  const all = await listOutboxOps();
  const doneIds = new Set(all.filter((o) => o.status === "done").map((o) => o.id));
  const queue = [...(await listPendingOps())];

  const results = { synced: 0, failed: 0, errors: [], details: [] };
  let guard = 0;

  while (queue.length && guard < 500) {
    guard += 1;
    const idx = queue.findIndex((op) => depsSatisfied(op, doneIds));
    if (idx < 0) {
      queue.forEach((op) => {
        results.failed += 1;
        results.errors.push({
          opId: op.id,
          type: op.type,
          label: op.label,
          message: "Waiting on a previous step that failed or is missing",
        });
      });
      break;
    }

    const [op] = queue.splice(idx, 1);
    await updateOp(op.id, { status: "in_progress", error: null });

    try {
      let detail;
      switch (op.type) {
        case OP.REGISTER_PATIENT:
          detail = await replayRegister(op);
          break;
        case OP.START_EPISODE:
          detail = await replayStartEpisode(op, authSession.facilityId, authSession.userId);
          break;
        case OP.ADD_VISIT:
          detail = await replayAddVisit(op, authSession.facilityId, authSession.userId);
          break;
        case OP.START_SUSPECT:
          detail = await replayStartSuspect(op, authSession.facilityId, authSession.userId);
          break;
        case OP.SAVE_ENCOUNTER_FORM:
          detail = await replaySaveForm(op);
          break;
        default:
          throw new Error(`Unknown outbox op type: ${op.type}`);
      }

      await updateOp(op.id, { status: "done", error: null });
      doneIds.add(op.id);
      results.synced += 1;
      results.details.push({ opId: op.id, type: op.type, detail });

      if (typeof onOpDone === "function") {
        await onOpDone({ op, detail });
      }

      if (op.type === OP.REGISTER_PATIENT && detail.localPatientId) {
        await deleteLocalPatient(detail.localPatientId);
      }
      if (
        (op.type === OP.START_EPISODE || op.type === OP.ADD_VISIT || op.type === OP.START_SUSPECT) &&
        detail.localVisitId
      ) {
        await deleteLocalEncounter(detail.localVisitId);
      }
      if (op.type === OP.START_SUSPECT && detail.localSuspectId) {
        await deleteLocalSuspect(detail.localSuspectId);
      }
      if (op.type === OP.SAVE_ENCOUNTER_FORM && detail.localVisitId) {
        await deleteLocalEncounter(detail.localVisitId);
      }
    } catch (err) {
      const message = err?.message || String(err);
      await updateOp(op.id, { status: "failed", error: message });
      results.failed += 1;
      results.errors.push({ opId: op.id, type: op.type, label: op.label, message });

      const blocked = new Set([op.id]);
      for (let i = queue.length - 1; i >= 0; i -= 1) {
        if ((queue[i].dependsOn || []).some((d) => blocked.has(d))) {
          blocked.add(queue[i].id);
          const blockedOp = queue.splice(i, 1)[0];
          results.failed += 1;
          results.errors.push({
            opId: blockedOp.id,
            type: blockedOp.type,
            label: blockedOp.label,
            message: `Blocked because ${op.type} failed`,
          });
        }
      }
    }
  }

  const finished = (await listOutboxOps()).filter((o) => o.status === "done");
  if (finished.length) await deleteOps(finished.map((o) => o.id));

  return results;
}
