import { normalizeContentPathSegment } from "./dashboard-section-route";

export type ContentDirectoryNode = {
  id: string;
  label: string;
  children?: ContentDirectoryNode[];
};

export const maxContentDirectoryNameLength = 80;

export const normalizeContentDirectoryName = (value: string) => value.trim();

export const getContentDirectoryPathSegment = (node: ContentDirectoryNode) =>
  normalizeContentPathSegment(node.label) ||
  normalizeContentPathSegment(node.id) ||
  "directory";

const findNodeById = (
  nodes: ContentDirectoryNode[],
  nodeId: string,
): ContentDirectoryNode | null => {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    const nested = node.children ? findNodeById(node.children, nodeId) : null;
    if (nested) {
      return nested;
    }
  }

  return null;
};

const getSiblingNodes = (
  nodes: ContentDirectoryNode[],
  parentId: string | null,
) => {
  if (parentId === null) {
    return nodes;
  }

  const parentNode = findNodeById(nodes, parentId);
  return parentNode?.children ?? [];
};

export const isUniqueContentDirectoryName = ({
  nodes,
  parentId,
  name,
}: {
  nodes: ContentDirectoryNode[];
  parentId: string | null;
  name: string;
}) => {
  const normalizedTarget = normalizeContentPathSegment(name);
  if (!normalizedTarget) {
    return false;
  }

  const siblings = getSiblingNodes(nodes, parentId);
  return !siblings.some(
    (node) => normalizeContentPathSegment(node.label) === normalizedTarget,
  );
};

const insertNodeRecursively = (
  nodes: ContentDirectoryNode[],
  parentId: string,
  newNode: ContentDirectoryNode,
): { nodes: ContentDirectoryNode[]; inserted: boolean } => {
  let inserted = false;

  const nextNodes = nodes.map((node) => {
    if (node.id === parentId) {
      inserted = true;
      return {
        ...node,
        children: [...(node.children ?? []), newNode],
      };
    }

    if (!node.children?.length) {
      return node;
    }

    const result = insertNodeRecursively(node.children, parentId, newNode);
    if (!result.inserted) {
      return node;
    }

    inserted = true;
    return {
      ...node,
      children: result.nodes,
    };
  });

  return { nodes: nextNodes, inserted };
};

const defaultIdFactory = () => {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) {
    return randomUUID();
  }

  return `dir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

type EnsurePathIdFactory =
  | (() => string)
  | ((pathSegments: string[]) => string);

const resolveEnsurePathIdFactory = (createId?: EnsurePathIdFactory) => {
  if (!createId) {
    return () => defaultIdFactory();
  }

  if (createId.length > 0) {
    const createIdWithPath = createId as (pathSegments: string[]) => string;
    return (pathSegments: string[]) => createIdWithPath(pathSegments);
  }

  const createIdWithoutPath = createId as () => string;
  return () => createIdWithoutPath();
};

export const addContentDirectory = ({
  nodes,
  parentId,
  rawName,
  maxNameLength = maxContentDirectoryNameLength,
  createId = defaultIdFactory,
}: {
  nodes: ContentDirectoryNode[];
  parentId: string | null;
  rawName: string;
  maxNameLength?: number;
  createId?: () => string;
}) => {
  const normalizedName = normalizeContentDirectoryName(rawName);

  if (!normalizedName || normalizedName.length > maxNameLength) {
    return nodes;
  }

  if (
    !isUniqueContentDirectoryName({
      nodes,
      parentId,
      name: normalizedName,
    })
  ) {
    return nodes;
  }

  const newNode: ContentDirectoryNode = {
    id: createId(),
    label: normalizedName,
    children: [],
  };

  if (parentId === null) {
    return [...nodes, newNode];
  }

  const result = insertNodeRecursively(nodes, parentId, newNode);
  return result.inserted ? result.nodes : nodes;
};

export const getContentDirectoryPathNodes = ({
  nodes,
  pathSegments,
}: {
  nodes: ContentDirectoryNode[];
  pathSegments: string[];
}) => {
  const normalizedSegments = pathSegments
    .map(normalizeContentPathSegment)
    .filter(Boolean);
  if (normalizedSegments.length === 0) {
    return [] as ContentDirectoryNode[];
  }

  const matched: ContentDirectoryNode[] = [];
  let currentNodes = nodes;

  for (const segment of normalizedSegments) {
    const nextNode = currentNodes.find(
      (node) => getContentDirectoryPathSegment(node) === segment,
    );
    if (!nextNode) {
      return [] as ContentDirectoryNode[];
    }
    matched.push(nextNode);
    currentNodes = nextNode.children ?? [];
  }

  return matched;
};

export const getContentDirectoryPathIds = ({
  nodes,
  pathSegments,
}: {
  nodes: ContentDirectoryNode[];
  pathSegments: string[];
}) =>
  getContentDirectoryPathNodes({
    nodes,
    pathSegments,
  }).map((node) => node.id);

const ensureContentDirectoryPathRecursively = ({
  nodes,
  normalizedSegments,
  createIdFromPath,
  traversedSegments = [],
}: {
  nodes: ContentDirectoryNode[];
  normalizedSegments: string[];
  createIdFromPath: (pathSegments: string[]) => string;
  traversedSegments?: string[];
}): { nodes: ContentDirectoryNode[]; changed: boolean } => {
  const [currentSegment, ...tailSegments] = normalizedSegments;
  if (!currentSegment) {
    return { nodes, changed: false };
  }

  const currentPathSegments = [...traversedSegments, currentSegment];

  const matchingIndex = nodes.findIndex(
    (node) => getContentDirectoryPathSegment(node) === currentSegment,
  );

  if (matchingIndex < 0) {
    if (tailSegments.length === 0) {
      return {
        nodes: [
          ...nodes,
          {
            id: createIdFromPath(currentPathSegments),
            label: currentSegment,
            children: [],
          },
        ],
        changed: true,
      };
    }

    const nestedResult = ensureContentDirectoryPathRecursively({
      nodes: [],
      normalizedSegments: tailSegments,
      createIdFromPath,
      traversedSegments: currentPathSegments,
    });

    return {
      nodes: [
        ...nodes,
        {
          id: createIdFromPath(currentPathSegments),
          label: currentSegment,
          children: nestedResult.nodes,
        },
      ],
      changed: true,
    };
  }

  if (tailSegments.length === 0) {
    return { nodes, changed: false };
  }

  const matchingNode = nodes[matchingIndex];
  const nestedResult = ensureContentDirectoryPathRecursively({
    nodes: matchingNode.children ?? [],
    normalizedSegments: tailSegments,
    createIdFromPath,
    traversedSegments: currentPathSegments,
  });

  if (!nestedResult.changed) {
    return { nodes, changed: false };
  }

  const nextNodes = [...nodes];
  nextNodes[matchingIndex] = {
    ...matchingNode,
    children: nestedResult.nodes,
  };

  return {
    nodes: nextNodes,
    changed: true,
  };
};

export const ensureContentDirectoryPath = ({
  nodes,
  pathSegments,
  createId,
}: {
  nodes: ContentDirectoryNode[];
  pathSegments: string[];
  createId?: EnsurePathIdFactory;
}) => {
  const normalizedSegments = pathSegments
    .map(normalizeContentPathSegment)
    .filter(Boolean);
  if (normalizedSegments.length === 0) {
    return nodes;
  }

  const result = ensureContentDirectoryPathRecursively({
    nodes,
    normalizedSegments,
    createIdFromPath: resolveEnsurePathIdFactory(createId),
  });

  return result.changed ? result.nodes : nodes;
};
