import { useCallback, useEffect, useRef, useState } from "react";
import { api, parseError } from "../services/api";

/** Loads data on mount / when deps change. Exposes {data, loading, error, reload, setData}. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const alive = useRef(true);

  const run = useCallback((silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    return fnRef.current()
      .then((data) => alive.current && setState({ data, loading: false, error: null }))
      .catch((err) => alive.current && setState((s) => ({ data: silent ? s.data : null, loading: false, error: parseError(err).message })));
  }, []);

  useEffect(() => {
    alive.current = true;
    run();
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater })), []);
  return { ...state, reload: run, setData };
}

let statusPromise = null;
/** Extraction provider status (demo fallback vs real AI), cached for the session. */
export function useExtractionStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    statusPromise = statusPromise || api.extractionStatus().catch(() => null);
    statusPromise.then((s) => {
      if (!s) statusPromise = null; // do not cache a failure
      setStatus(s);
    });
  }, []);
  return status;
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
