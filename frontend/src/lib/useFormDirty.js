import { useCallback, useEffect, useRef, useState } from "react";

export const formSnapshot = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/**
 * Enables Save only after the form diverges from its baseline.
 * Baseline is taken shortly after mount / resetKey (so auto-init effects can settle),
 * and again via markSaved() after a successful save.
 */
export function useFormDirty(formState, resetKey = "") {
  const baselineRef = useRef(null);
  const bootstrappingRef = useRef(true);
  const stateRef = useRef(formState);
  stateRef.current = formState;
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    bootstrappingRef.current = true;
    baselineRef.current = null;
    setDirty(false);
    const t = window.setTimeout(() => {
      baselineRef.current = formSnapshot(stateRef.current);
      bootstrappingRef.current = false;
      setDirty(false);
    }, 150);
    return () => window.clearTimeout(t);
  }, [resetKey]);

  useEffect(() => {
    if (bootstrappingRef.current || baselineRef.current == null) return;
    setDirty(formSnapshot(formState) !== baselineRef.current);
  }, [formState]);

  const markSaved = useCallback((nextState) => {
    baselineRef.current = formSnapshot(nextState !== undefined ? nextState : stateRef.current);
    bootstrappingRef.current = false;
    setDirty(false);
  }, []);

  return { dirty, markSaved };
}
