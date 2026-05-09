import { Button, Card } from "@lumia-ui/components";

export type CmsContentListViewState =
  | {
      kind: "loading";
      title: string;
      description: string;
    }
  | {
      kind: "error";
      title: string;
      description: string;
      retryLabel: string;
      retryAriaLabel: string;
    }
  | {
      kind: "empty";
      title: string;
      description: string;
    }
  | {
      kind: "ready";
    };

export type CmsContentListStateCopy = {
  loadingTitle: string;
  loadingDescription: string;
  errorTitle: string;
  errorDescription: string;
  retryLabel: string;
  retryAriaLabel: string;
  searchEmptyTitle: string;
  searchEmptyDescription: string;
  directoryEmptyTitle: string;
  directoryEmptyDescription: string;
  rootEmptyTitle: string;
  rootEmptyDescription: string;
};

const defaultCopy: CmsContentListStateCopy = {
  loadingTitle: "Loading content entries",
  loadingDescription: "Fetching entries for this workspace.",
  errorTitle: "Unable to load content entries",
  errorDescription:
    "Please try again. If the problem continues, contact your workspace owner.",
  retryLabel: "Retry",
  retryAriaLabel: "Retry loading",
  searchEmptyTitle: "No content matched your search",
  searchEmptyDescription: "Try another keyword or clear the search query.",
  directoryEmptyTitle: "This directory is empty",
  directoryEmptyDescription:
    "Create a new entry to add content to this directory.",
  rootEmptyTitle: "No content entries yet",
  rootEmptyDescription: "Create your first content entry to get started.",
};

export const resolveCmsContentListState = ({
  isLoading,
  error,
  count,
  query,
  breadcrumbParts,
  copy = defaultCopy,
}: {
  isLoading: boolean;
  error: Error | null;
  count: number;
  query: string;
  breadcrumbParts: string[];
  copy?: CmsContentListStateCopy;
}): CmsContentListViewState => {
  if (isLoading) {
    return {
      kind: "loading",
      title: copy.loadingTitle,
      description: copy.loadingDescription,
    };
  }

  if (error) {
    return {
      kind: "error",
      title: copy.errorTitle,
      description: copy.errorDescription,
      retryLabel: copy.retryLabel,
      retryAriaLabel: copy.retryAriaLabel,
    };
  }

  if (count > 0) {
    return { kind: "ready" };
  }

  const normalizedQuery = query.trim();
  if (normalizedQuery) {
    return {
      kind: "empty",
      title: copy.searchEmptyTitle,
      description: copy.searchEmptyDescription,
    };
  }

  if (breadcrumbParts.length > 0) {
    return {
      kind: "empty",
      title: copy.directoryEmptyTitle,
      description: copy.directoryEmptyDescription,
    };
  }

  return {
    kind: "empty",
    title: copy.rootEmptyTitle,
    description: copy.rootEmptyDescription,
  };
};

export function CmsContentListState({
  state,
  onRetry,
}: {
  state: CmsContentListViewState;
  onRetry?: () => void;
}) {
  if (state.kind === "ready") {
    return null;
  }

  if (state.kind === "loading") {
    return (
      <Card
        className="m-4 border border-border bg-background p-6"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-medium text-foreground">{state.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.description}
        </p>
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card className="m-4 border border-border bg-background p-6">
        <p
          className="text-sm font-medium text-foreground"
          aria-live="assertive"
        >
          {state.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.description}
        </p>
        <Button
          type="button"
          className="mt-4"
          onClick={onRetry}
          aria-label={state.retryAriaLabel}
        >
          {state.retryLabel}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="m-4 border border-border bg-muted/20 p-6 text-center">
      <p className="text-sm font-medium text-foreground" aria-live="polite">
        {state.title}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{state.description}</p>
    </Card>
  );
}
