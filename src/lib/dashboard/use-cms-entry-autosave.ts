"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CmsEntrySaveState = "idle" | "saving" | "saved" | "error";

export type UseCmsEntryAutosaveOptions<TValue> = {
  enabled: boolean;
  cacheKey: string;
  value: TValue;
  delayMs?: number;
  saveDraft: (value: TValue) => Promise<void>;
};

export type UseCmsEntryAutosaveResult<TValue> = {
  saveState: CmsEntrySaveState;
  lastSavedAt: string | null;
  error: Error | null;
  pendingSnapshot: TValue | null;
  retry: () => Promise<void>;
  flush: () => Promise<void>;
  restoreSnapshot: () => TValue | null;
  clearSnapshot: () => void;
};

const storagePrefix = "cms-entry-autosave:";

const getStorageKey = (cacheKey: string) => `${storagePrefix}${cacheKey}`;
const getLocalStorage = (): Storage | null => {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
};
const readSnapshot = (storageKey: string): string | null => {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(storageKey);
  } catch {
    return null;
  }
};
const writeSnapshot = (storageKey: string, value: string): void => {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(storageKey, value);
  } catch {
    // Ignore storage write failures (quota/private mode), autosave still continues via network.
  }
};
const removeSnapshot = (storageKey: string): void => {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(storageKey);
  } catch {
    // Ignore storage remove failures.
  }
};

function serializeSnapshot<TValue>(value: TValue): string {
  return JSON.stringify(value);
}

function parseSnapshot<TValue>(value: string): TValue | null {
  try {
    return JSON.parse(value) as TValue;
  } catch {
    return null;
  }
}

export function useCmsEntryAutosave<TValue>({
  enabled,
  cacheKey,
  value,
  delayMs = 2000,
  saveDraft,
}: UseCmsEntryAutosaveOptions<TValue>): UseCmsEntryAutosaveResult<TValue> {
  const [saveState, setSaveState] = useState<CmsEntrySaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const storageKey = getStorageKey(cacheKey);
  const [pendingSnapshot, setPendingSnapshot] = useState<TValue | null>(() => {
    const cached = readSnapshot(storageKey);
    if (!cached) {
      return null;
    }
    return parseSnapshot<TValue>(cached);
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef<TValue>(value);
  const lastSnapshotSerializedRef = useRef<string | null>(null);
  const lastSavedSerializedRef = useRef<string | null>(null);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const clearPendingTimer = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);
  useEffect(() => {
    lastSavedSerializedRef.current = null;
    lastSnapshotSerializedRef.current = null;
    let isCancelled = false;
    const cached = readSnapshot(storageKey);
    if (!cached) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setPendingSnapshot(null);
        }
      });
      return () => {
        isCancelled = true;
      };
    }
    lastSnapshotSerializedRef.current = cached;
    const parsed = parseSnapshot<TValue>(cached);
    queueMicrotask(() => {
      if (!isCancelled) {
        setPendingSnapshot(parsed);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [storageKey]);

  const clearSnapshot = useCallback(() => {
    removeSnapshot(storageKey);
    lastSnapshotSerializedRef.current = null;
    setPendingSnapshot(null);
  }, [storageKey]);

  const persistSnapshot = useCallback(
    (snapshot: TValue) => {
      const serialized = serializeSnapshot(snapshot);
      if (serialized === lastSnapshotSerializedRef.current) {
        setPendingSnapshot((current) => current ?? snapshot);
        return;
      }

      lastSnapshotSerializedRef.current = serialized;
      writeSnapshot(storageKey, serialized);
      setPendingSnapshot(snapshot);
    },
    [storageKey],
  );

  const runSave = useCallback(
    (snapshot: TValue) => {
      if (savePromiseRef.current) {
        return savePromiseRef.current;
      }

      const saveTask = (async () => {
        setSaveState("saving");
        setError(null);

        try {
          await saveDraft(snapshot);
          setSaveState("saved");
          setLastSavedAt(new Date().toISOString());
          lastSavedSerializedRef.current = serializeSnapshot(snapshot);
          clearSnapshot();
        } catch (saveError) {
          const normalizedError =
            saveError instanceof Error ? saveError : new Error("Autosave failed");
          setSaveState("error");
          setError(normalizedError);
          persistSnapshot(snapshot);
          throw normalizedError;
        } finally {
          savePromiseRef.current = null;
        }
      })();

      savePromiseRef.current = saveTask;
      return saveTask;
    },
    [clearSnapshot, persistSnapshot, saveDraft],
  );

  const flush = useCallback(async () => {
    clearPendingTimer();

    if (!enabled) {
      return;
    }

    while (true) {
      const snapshot = latestValueRef.current;
      const serializedSnapshot = serializeSnapshot(snapshot);

      if (
        pendingSnapshot === null &&
        lastSavedSerializedRef.current === null
      ) {
        lastSavedSerializedRef.current = serializedSnapshot;
        return;
      }

      if (serializedSnapshot === lastSavedSerializedRef.current) {
        return;
      }

      if (savePromiseRef.current) {
        await savePromiseRef.current;
        continue;
      }

      await runSave(snapshot);
      return;
    }
  }, [clearPendingTimer, enabled, pendingSnapshot, runSave]);

  useEffect(() => {
    if (saveState === "error") {
      clearPendingTimer();
      return;
    }

    if (!enabled) {
      clearPendingTimer();
      return;
    }

    const serializedValue = serializeSnapshot(value);

    if (
      pendingSnapshot === null &&
      lastSavedSerializedRef.current === null
    ) {
      lastSavedSerializedRef.current = serializedValue;
      return;
    }

    if (
      pendingSnapshot === null &&
      serializedValue === lastSavedSerializedRef.current
    ) {
      return;
    }

    if (
      pendingSnapshot === null &&
      serializedValue !== lastSavedSerializedRef.current
    ) {
      if (serializedValue !== lastSnapshotSerializedRef.current) {
        lastSnapshotSerializedRef.current = serializedValue;
        writeSnapshot(storageKey, serializedValue);
      }
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      const snapshot = latestValueRef.current;
      void runSave(snapshot).catch(() => {
        // Save failures are already reflected in hook state.
      });
    }, delayMs);

    return () => {
      clearPendingTimer();
    };
  }, [
    clearPendingTimer,
    delayMs,
    enabled,
    pendingSnapshot,
    runSave,
    saveState,
    storageKey,
    value,
  ]);

  const retry = useCallback(async () => {
    const snapshot = pendingSnapshot ?? latestValueRef.current;
    await runSave(snapshot);
  }, [pendingSnapshot, runSave]);

  const restoreSnapshot = useCallback(() => {
    const cached = readSnapshot(storageKey);
    if (!cached) {
      return null;
    }

    return parseSnapshot<TValue>(cached);
  }, [storageKey]);

  return {
    saveState,
    lastSavedAt,
    error,
    pendingSnapshot,
    retry,
    flush,
    restoreSnapshot,
    clearSnapshot,
  };
}
