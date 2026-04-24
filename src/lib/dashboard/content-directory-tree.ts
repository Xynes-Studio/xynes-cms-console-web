import { normalizeContentPathSegment } from "./dashboard-section-route";

export type ContentDirectoryNode = {
  id: string;
  label: string;
  pathSegment?: string;
  children?: ContentDirectoryNode[];
};

export type PersistedContentDirectory = {
  id: string;
  parentId: string | null;
  name: string;
  pathSegment: string;
};

export const maxContentDirectoryNameLength = 80;

export const normalizeContentDirectoryName = (value: string) => value.trim();

export const getContentDirectoryPathSegment = (node: ContentDirectoryNode) =>
  normalizeContentPathSegment(node.pathSegment ?? "") ||
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

const findNodeContextById = (
  nodes: ContentDirectoryNode[],
  nodeId: string,
  parentId: string | null = null,
): { node: ContentDirectoryNode; parentId: string | null } | null => {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return {
        node,
        parentId,
      };
    }

    const nested = node.children?.length
      ? findNodeContextById(node.children, nodeId, node.id)
      : null;
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
  excludeNodeId,
}: {
  nodes: ContentDirectoryNode[];
  parentId: string | null;
  name: string;
  excludeNodeId?: string;
}) => {
  const normalizedTarget = normalizeContentPathSegment(name);
  if (!normalizedTarget) {
    return false;
  }

  const siblings = getSiblingNodes(nodes, parentId);
  return !siblings.some(
    (node) =>
      node.id !== excludeNodeId &&
      normalizeContentPathSegment(node.label) === normalizedTarget,
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
  pathSegment,
}: {
  nodes: ContentDirectoryNode[];
  parentId: string | null;
  rawName: string;
  maxNameLength?: number;
  createId?: () => string;
  pathSegment?: string;
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
    ...(pathSegment ? { pathSegment } : {}),
    children: [],
  };

  if (parentId === null) {
    return [...nodes, newNode];
  }

  const result = insertNodeRecursively(nodes, parentId, newNode);
  return result.inserted ? result.nodes : nodes;
};

const updateNodeLabelRecursively = ({
  nodes,
  nodeId,
  nextLabel,
}: {
  nodes: ContentDirectoryNode[];
  nodeId: string;
  nextLabel: string;
}): { nodes: ContentDirectoryNode[]; updated: boolean } => {
  let updated = false;

  const nextNodes = nodes.map((node) => {
    if (node.id === nodeId) {
      updated = true;
      const normalizedSegment = normalizeContentPathSegment(nextLabel);
      return {
        ...node,
        label: nextLabel,
        ...(normalizedSegment ? { pathSegment: normalizedSegment } : {}),
      };
    }

    if (!node.children?.length) {
      return node;
    }

    const nested = updateNodeLabelRecursively({
      nodes: node.children,
      nodeId,
      nextLabel,
    });
    if (!nested.updated) {
      return node;
    }

    updated = true;
    return {
      ...node,
      children: nested.nodes,
    };
  });

  return {
    nodes: nextNodes,
    updated,
  };
};

export const updateContentDirectoryName = ({
  nodes,
  nodeId,
  rawName,
  maxNameLength = maxContentDirectoryNameLength,
}: {
  nodes: ContentDirectoryNode[];
  nodeId: string;
  rawName: string;
  maxNameLength?: number;
}) => {
  const normalizedName = normalizeContentDirectoryName(rawName);
  if (!normalizedName || normalizedName.length > maxNameLength) {
    return nodes;
  }

  const currentContext = findNodeContextById(nodes, nodeId);
  if (!currentContext) {
    return nodes;
  }

  if (currentContext.node.label === normalizedName) {
    return nodes;
  }

  if (
    !isUniqueContentDirectoryName({
      nodes,
      parentId: currentContext.parentId,
      name: normalizedName,
      excludeNodeId: nodeId,
    })
  ) {
    return nodes;
  }

  const updated = updateNodeLabelRecursively({
    nodes,
    nodeId,
    nextLabel: normalizedName,
  });

  return updated.updated ? updated.nodes : nodes;
};

export const removeContentDirectory = ({
  nodes,
  nodeId,
}: {
  nodes: ContentDirectoryNode[];
  nodeId: string;
}): ContentDirectoryNode[] =>
  nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({
      ...node,
      children: node.children?.length
        ? removeContentDirectory({
            nodes: node.children,
            nodeId,
          })
        : node.children,
    }));

export const materializePersistedContentDirectories = ({
  baseNodes,
  directories,
}: {
  baseNodes: ContentDirectoryNode[];
  directories: PersistedContentDirectory[];
}) => {
  let nodes = baseNodes;
  const idToParentId = new Map(
    directories.map((directory) => [directory.id, directory.parentId]),
  );
  const depthMemo = new Map<string, number>();
  const getDepth = (directoryId: string, trail = new Set<string>()): number => {
    const cached = depthMemo.get(directoryId);
    if (typeof cached === "number") {
      return cached;
    }

    const parentId = idToParentId.get(directoryId) ?? null;
    if (!parentId || !idToParentId.has(parentId) || trail.has(directoryId)) {
      depthMemo.set(directoryId, 0);
      return 0;
    }

    trail.add(directoryId);
    const depth = getDepth(parentId, trail) + 1;
    trail.delete(directoryId);
    depthMemo.set(directoryId, depth);
    return depth;
  };

  const orderedDirectories = directories
    .map((directory, index) => ({
      directory,
      index,
      depth: getDepth(directory.id),
      rootRank: directory.parentId === null ? 0 : 1,
    }))
    .sort((left, right) => {
      if (left.rootRank !== right.rootRank) {
        return left.rootRank - right.rootRank;
      }
      if (left.depth !== right.depth) {
        return left.depth - right.depth;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.directory);

  for (const directory of orderedDirectories) {
    const withParent = addContentDirectory({
      nodes,
      parentId: directory.parentId,
      rawName: directory.name,
      createId: () => directory.id,
      pathSegment: directory.pathSegment,
    });

    if (withParent !== nodes) {
      nodes = withParent;
      continue;
    }

    if (directory.parentId !== null) {
      nodes = addContentDirectory({
        nodes,
        parentId: null,
        rawName: directory.name,
        createId: () => directory.id,
        pathSegment: directory.pathSegment,
      });
    }
  }

  return nodes;
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
            pathSegment: currentSegment,
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
          pathSegment: currentSegment,
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

export const mergeContentDirectoryRoots = ({
  primaryNodes,
  secondaryNodes,
}: {
  primaryNodes: ContentDirectoryNode[];
  secondaryNodes: ContentDirectoryNode[];
}) => {
  const seenSegments = new Set(
    primaryNodes.map((node) => getContentDirectoryPathSegment(node)),
  );

  const merged = [...primaryNodes];
  for (const node of secondaryNodes) {
    const segment = getContentDirectoryPathSegment(node);
    if (seenSegments.has(segment)) {
      continue;
    }
    seenSegments.add(segment);
    merged.push(node);
  }

  return merged;
};
