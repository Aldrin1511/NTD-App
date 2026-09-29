import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  flattenEncounterToPhiItems,
  featureCodeForDisease,
  EXTRA_PHI_SECTIONS,
  examSectionTitle,
  phiItemsForExtraSectionDiff,
  phiItemForExtraFieldChange,
} from "@/lib/phiMap";

/**
 * Persist ANC / malnutrition / well-baby encounters the same way as skin NTDs:
 * local encounter + PHI upserts + finalize when online with real visit/encounter ids.
 */
export async function persistIntegratedEncounter({
  online,
  saveEncounter,
  upsertEncounterPhiField,
  finalizeEncounterPhi,
  existing,
  payload,
}) {
  const disease = payload.disease;
  const featureCode =
    payload.featureCode ||
    existing?.featureCode ||
    featureCodeForDisease(disease);
  const visitId = existing?.visitId || existing?.id || payload.visitId || payload.id;
  const encounterId = existing?.encounterId || payload.encounterId || "";
  const recordId = existing?.recordId || payload.recordId || existing?.episodeId || payload.episodeId;
  const episodeId = recordId || payload.episodeId || existing?.episodeId;

  const savedLocal = {
    ...payload,
    id: existing?.id || visitId || payload.id,
    visitId,
    recordId,
    encounterId,
    featureCode,
    episodeId,
    pendingStart: false,
    complete: true,
  };

  const canWritePhi =
    online &&
    encounterId &&
    visitId &&
    !String(visitId).startsWith("local-") &&
    !String(encounterId).startsWith("local-") &&
    featureCode;

  if (canWritePhi && typeof upsertEncounterPhiField === "function") {
    const items = flattenEncounterToPhiItems({
      disease,
      data: payload.data || {},
      diagnosis: payload.diagnosis,
      outcome: payload.outcome,
    });
    const phiEncounter = {
      patientId: payload.patientId,
      encounterId,
      visitId,
      recordId,
      featureCode,
      disease,
    };
    for (const item of items) {
      try {
        await upsertEncounterPhiField(phiEncounter, item);
      } catch (err) {
        console.warn("PHI upsert failed", item?.fieldKey || item?.item, err);
      }
    }
    if (typeof finalizeEncounterPhi === "function") {
      await finalizeEncounterPhi({
        patientId: payload.patientId,
        encounterId,
        visitId,
        disease,
        diagnosis: payload.diagnosis || "",
        outcome: payload.outcome || "",
        date: payload.date || existing?.date || new Date().toISOString(),
        data: payload.data || {},
      });
    }
  }

  const saved = await saveEncounter(savedLocal);
  return { saved, canWritePhi: Boolean(canWritePhi) };
}

/**
 * Debounced per-field PHI autosave (same pattern as Encounter.jsx for scabies/yaws/…).
 */
export function useExtraPhiAutosave({
  online,
  upsertEncounterPhiField,
  patientId,
  existing,
  diseaseId,
}) {
  const phiEncounter = useMemo(
    () => ({
      patientId,
      encounterId: existing?.encounterId || "",
      visitId: existing?.visitId || existing?.id || "",
      recordId: existing?.recordId || existing?.episodeId || "",
      disease: diseaseId,
      featureCode: existing?.featureCode || featureCodeForDisease(diseaseId),
    }),
    [patientId, existing, diseaseId],
  );

  const timers = useRef({});
  const sections = EXTRA_PHI_SECTIONS[diseaseId] || {};

  const queuePhiItems = (items, delay = 350) => {
    (items || []).forEach((item) => {
      const key = item.fieldKey || `${item.subFeatureCode}::${item.item}`;
      if (timers.current[key]) clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        const visitId = phiEncounter.visitId || "";
        const encId = phiEncounter.encounterId || "";
        if (!online || !encId || String(visitId).startsWith("local-") || String(encId).startsWith("local-")) {
          return;
        }
        upsertEncounterPhiField(phiEncounter, item).catch((err) => {
          console.warn("PHI autosave failed", key, err);
        });
      }, delay);
    });
  };

  /** Diff a whole section object (caseDetails, history, vitals, …). */
  const queueSectionDiff = (pathPrefix, prev, next, delay = 200) => {
    const sub =
      sections[pathPrefix] ||
      examSectionTitle(diseaseId);
    queuePhiItems(
      phiItemsForExtraSectionDiff({
        pathPrefix,
        subFeatureCode: sub,
        prev,
        next,
      }),
      delay,
    );
  };

  /** Single top-level or nested field. */
  const queueField = (fieldKey, value, subFeatureCode, itemLabel, delay = 350) => {
    const root = String(fieldKey || "").split(".")[0];
    queuePhiItems(
      [
        phiItemForExtraFieldChange({
          fieldKey,
          value,
          subFeatureCode: subFeatureCode || sections[root] || examSectionTitle(diseaseId),
          itemLabel,
        }),
      ],
      delay,
    );
  };

  return { phiEncounter, queuePhiItems, queueSectionDiff, queueField, sections };
}

/**
 * Load one-PHI-per-question answers from HMIS when opening a visit (same as Encounter.jsx / scabies).
 * @param {object} opts
 * @param {object|null} opts.existing
 * @param {boolean} opts.online
 * @param {(enc: object) => Promise<object|null>} opts.loadEncounterPhi
 * @param {(form: object) => object} opts.applyForm — merge PHI form into disease-specific empty shape
 * @param {(next: object) => void} opts.setD
 * @param {(label: string) => void} [opts.setSavedAt]
 */
export function useLoadEncounterPhi({
  existing,
  online,
  loadEncounterPhi,
  applyForm,
  setD,
  setSavedAt,
}) {
  const [phiLoading, setPhiLoading] = useState(false);

  useEffect(() => {
    if (!existing?.encounterId || !existing?.patientId) return undefined;
    if (!online) {
      setPhiLoading(false);
      return undefined;
    }
    if (typeof loadEncounterPhi !== "function" || typeof applyForm !== "function") return undefined;

    let cancelled = false;
    setPhiLoading(true);
    loadEncounterPhi(existing)
      .then((form) => {
        if (cancelled || !form || typeof form !== "object") return;
        setD(applyForm(form));
        setSavedAt?.("loaded from HMIS");
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("loadEncounterPhi failed", err);
        const msg = String(err?.message || "");
        if (
          /failed to fetch informations|Cannot POST|<!DOCTYPE|network|offline|Failed to fetch|Network Error/i.test(
            msg,
          )
        ) {
          return;
        }
        toast.error(err?.message || "Could not load form answers from server");
      })
      .finally(() => {
        if (!cancelled) setPhiLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Only re-fetch when the visit / OP encounter / connectivity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, existing?.encounterId, existing?.patientId, online]);

  return { phiLoading };
}
