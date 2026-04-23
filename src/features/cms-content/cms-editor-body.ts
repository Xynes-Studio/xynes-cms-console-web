export interface LumiaEditorRootNode {
  type: "root";
  version: number;
  direction: string | null;
  format: string;
  indent: number;
  children: unknown[];
  [key: string]: unknown;
}

export interface LumiaEditorDocument {
  root: LumiaEditorRootNode;
  [key: string]: unknown;
}

export interface EditorDraftShape {
  title?: string;
  description?: string;
  tags?: string | string[];
  body?: unknown;
}

const EMPTY_DOCUMENT: LumiaEditorDocument = {
  root: {
    type: "root",
    version: 1,
    direction: "ltr",
    format: "",
    indent: 0,
    children: [
      {
        type: "paragraph",
        version: 1,
        direction: null,
        format: "",
        indent: 0,
        textFormat: "",
        children: [],
      },
    ],
  },
};

const isPlainObject = (value: object) => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  isPlainObject(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isJsonSafeValue = (
  value: unknown,
  ancestors: Set<object>,
): boolean => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol" || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return false;
    }
    ancestors.add(value);
    const isValid = value.every((item) => isJsonSafeValue(item, ancestors));
    ancestors.delete(value);
    return isValid;
  }

  if (!isRecord(value)) {
    return false;
  }

  if (ancestors.has(value)) {
    return false;
  }
  ancestors.add(value);

  const isValid = Object.values(value).every((item) =>
    isJsonSafeValue(item, ancestors),
  );
  ancestors.delete(value);
  return isValid;
};

const isValidLumiaDocument = (value: unknown): value is LumiaEditorDocument => {
  if (!isRecord(value)) {
    return false;
  }

  if (!isRecord(value.root)) {
    return false;
  }

  return (
    value.root.type === "root" &&
    typeof value.root.version === "number" &&
    (typeof value.root.direction === "string" || value.root.direction === null) &&
    typeof value.root.format === "string" &&
    typeof value.root.indent === "number" &&
    Array.isArray(value.root.children) &&
    value.root.children.length > 0 &&
    isJsonSafeValue(value, new Set())
  );
};

const normalizeBodyCandidate = (value: unknown): unknown => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
};

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value;
};

const normalizeTags = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }

  if (!isStringArray(value)) {
    return [];
  }

  return [...value];
};

const stableStringify = (value: unknown): string => {
  if (!isJsonSafeValue(value, new Set())) {
    throw new Error("Cannot stringify unsafe editor draft");
  }

  return JSON.stringify(value, (_, current) => {
    if (isRecord(current)) {
      return Object.keys(current)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = current[key];
          return acc;
        }, Object.create(null) as Record<string, unknown>);
    }
    return current;
  });
};

const cloneJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.keys(value).reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = cloneJsonValue(value[key]);
      return acc;
    }, Object.create(null) as Record<string, unknown>);
  }

  return value;
};

const sanitizeJsonValue = (
  value: unknown,
  ancestors: Set<object>,
): unknown => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (
    value === undefined ||
    typeof value === "bigint" ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    return undefined;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return undefined;
    }

    ancestors.add(value);
    const sanitized = value
      .map((item) => sanitizeJsonValue(item, ancestors))
      .filter((item) => item !== undefined);
    ancestors.delete(value);
    return sanitized;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (ancestors.has(value)) {
    return undefined;
  }

  ancestors.add(value);
  const sanitized = Object.keys(value).reduce<Record<string, unknown>>(
    (acc, key) => {
      const nextValue = sanitizeJsonValue(value[key], ancestors);
      if (nextValue !== undefined) {
        acc[key] = nextValue;
      }
      return acc;
    },
    Object.create(null) as Record<string, unknown>,
  );
  ancestors.delete(value);
  return sanitized;
};

export const createEmptyLumiaDocument = (): LumiaEditorDocument => ({
  root: cloneJsonValue(EMPTY_DOCUMENT.root) as LumiaEditorRootNode,
});

export const normalizeEditorBody = (value: unknown): LumiaEditorDocument => {
  const candidate = sanitizeJsonValue(normalizeBodyCandidate(value), new Set());
  if (!isValidLumiaDocument(candidate)) {
    return createEmptyLumiaDocument();
  }

  return candidate;
};

export const hasEditorDraftChanged = (
  previous: EditorDraftShape,
  next: EditorDraftShape,
): boolean => {
  const normalizedPrevious = {
    title: normalizeString(previous.title),
    description: normalizeString(previous.description),
    tags: normalizeTags(previous.tags),
    body: normalizeEditorBody(previous.body),
  };

  const normalizedNext = {
    title: normalizeString(next.title),
    description: normalizeString(next.description),
    tags: normalizeTags(next.tags),
    body: normalizeEditorBody(next.body),
  };

  return stableStringify(normalizedPrevious) !== stableStringify(normalizedNext);
};
