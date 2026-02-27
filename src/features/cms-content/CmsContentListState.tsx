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
    }
  | {
      kind: "empty";
      title: string;
      description: string;
    }
  | {
      kind: "ready";
    };

export const resolveCmsContentListState = ({
  isLoading,
  error,
  count,
  query,
  breadcrumbParts,
}: {
  isLoading: boolean;
  error: Error | null;
  count: number;
  query: string;
  breadcrumbParts: string[];
}): CmsContentListViewState => {
  if (isLoading) {
    return {
      kind: "loading",
      title: "Loading content entries",
      description: "Fetching entries for this workspace.",
    };
  }

  if (error) {
    return {
      kind: "error",
      title: "Unable to load content entries",
      description:
        "Please try again. If the problem continues, contact your workspace owner.",
      retryLabel: "Retry",
    };
  }

  if (count > 0) {
    return { kind: "ready" };
  }

  const normalizedQuery = query.trim();
  if (normalizedQuery) {
    return {
      kind: "empty",
      title: "No content matched your search",
      description: "Try another keyword or clear the search query.",
    };
  }

  if (breadcrumbParts.length > 0) {
    return {
      kind: "empty",
      title: "This directory is empty",
      description: "Create a new entry to add content to this directory.",
    };
  }

  return {
    kind: "empty",
    title: "No content entries yet",
    description: "Create your first content entry to get started.",
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
        <p className="mt-1 text-sm text-muted-foreground">{state.description}</p>
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
        <p className="text-sm font-medium text-foreground" aria-live="assertive">
          {state.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{state.description}</p>
        <Button type="button" className="mt-4" onClick={onRetry} aria-label="Retry loading">
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
