"use client";

/**
 * CmsIntegrationsPanel — CMS contextual surface for the Workspace Admin
 * integrations epic.
 *
 * Architecture (per `xynes/xynes-infra/infra/architecture/epics/workspace-admin-integrations.md`):
 *  - The CMS console is a *consumer* of workspace integration primitives
 *    (verified domains, workspace API keys, future webhooks).
 *  - Global lifecycle forms live in the Workspace Admin (auth) app.
 *  - This panel is allowed to display aggregate counts and Workspace Admin
 *    deep links; it MUST NOT host add-domain, create-key, or webhook forms.
 *
 * Composition rules:
 *  - Lumia DS only for chrome (`Card`, `Badge`, `Alert`); native `<a>` for
 *    deep links so we do not nest interactive content inside Lumia's
 *    `<button>` element.
 *  - Pure URL/security logic lives in `./workspace-admin-links`.
 *  - Pure data-fetch + envelope logic lives in
 *    `../../lib/dashboard/workspace-integrations-client`.
 *  - This file owns rendering and effect orchestration only.
 */

import { useEffect, useState } from "react";
import { Alert, Badge, Card, buttonStyles } from "@lumia-ui/components";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";
import {
  fetchCmsWorkspaceIntegrationStatus,
  UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS,
  type CmsWorkspaceIntegrationStatus,
} from "../../lib/dashboard/workspace-integrations-client";
import {
  buildWorkspaceAdminIntegrationUrl,
  type WorkspaceAdminIntegrationTarget,
} from "./workspace-admin-links";

type CmsIntegrationsPanelProps = {
  /** Slug from the dashboard route; surfaced in the page header for context. */
  workspaceSlug: string;
};

type IntegrationMetric = {
  label: string;
  value: number | string;
  testId: string;
};

type IntegrationCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  linkLabel: string;
  linkTarget: WorkspaceAdminIntegrationTarget;
  metrics?: IntegrationMetric[];
};

const cardWrapperClasses = "flex h-full flex-col gap-5 p-6";

/** Pure helper: did the integration status load successfully? */
function isStatusLive(
  status: CmsWorkspaceIntegrationStatus | null,
): status is CmsWorkspaceIntegrationStatus & { unavailable: false } {
  return status !== null && !status.unavailable;
}

/**
 * Renders a Workspace Admin deep-link as a styled native anchor. We
 * intentionally do NOT render this as a `<Button>` because Lumia's `Button`
 * is a real `<button>` element and nesting an `<a>` inside would produce
 * invalid HTML and an a11y violation (interactive content inside interactive
 * content). Instead we apply Lumia's exported `buttonStyles` to an `<a>`.
 */
function WorkspaceAdminDeepLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const isExternal = href.startsWith("http://") || href.startsWith("https://");
  const className = [
    buttonStyles.base,
    buttonStyles.variants.outline,
    buttonStyles.sizes.sm,
    "no-underline",
  ].join(" ");

  return (
    <a
      href={href}
      className={className}
      data-testid="cms-integrations-deep-link"
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span>{label}</span>
      {isExternal ? (
        <>
          <span aria-hidden="true">↗</span>
          {/* sr-only hint so AT users hear the same affordance as sighted
              users get from the arrow icon. */}
          <span className="sr-only"> (opens in new tab)</span>
        </>
      ) : null}
    </a>
  );
}

function IntegrationCard({
  eyebrow,
  title,
  description,
  linkLabel,
  linkTarget,
  metrics,
}: IntegrationCardProps) {
  const href = buildWorkspaceAdminIntegrationUrl(linkTarget);

  return (
    <Card className={cardWrapperClasses}>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </span>
        <h2 className="text-lg font-semibold leading-6 text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-5 text-muted-foreground">{description}</p>
      </div>

      {metrics && metrics.length > 0 ? (
        <dl className="grid grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.testId}
              className="rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </dt>
              <dd
                data-testid={metric.testId}
                className="mt-1 text-xl font-semibold text-foreground"
              >
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-auto">
        <WorkspaceAdminDeepLink href={href} label={linkLabel} />
      </div>
    </Card>
  );
}

/**
 * Build the four CMS-context cards. Pure helper — kept outside the
 * component so it stays trivially testable and never re-allocates closures
 * per render.
 */
function buildIntegrationCards({
  status,
}: {
  status: CmsWorkspaceIntegrationStatus | null;
}): IntegrationCardProps[] {
  const live = isStatusLive(status);
  const fmt = (count: number): number | string => (live ? count : "—");

  return [
    {
      eyebrow: "Workspace setup",
      title: "Verified domains",
      description:
        "Verify domains in Workspace Admin once, then reuse them across CMS publishing, delivery, and any future workspace product.",
      linkLabel: "Manage verified domains",
      linkTarget: "domains",
      metrics: [
        {
          label: "Verified",
          value: fmt(status?.verifiedDomainCount ?? 0),
          testId: "cms-integrations-domains-verified-count",
        },
        {
          label: "Pending",
          value: fmt(status?.pendingDomainCount ?? 0),
          testId: "cms-integrations-domains-pending-count",
        },
      ],
    },
    {
      eyebrow: "Workspace setup",
      title: "Workspace API keys",
      description:
        "API keys are issued and scoped from Workspace Admin. Raw key values are shown once at creation and stored only as hashes — they cannot be revealed again.",
      linkLabel: "Manage workspace API keys",
      linkTarget: "api_keys",
      metrics: [
        {
          label: "Active",
          value: fmt(status?.activeApiKeyCount ?? 0),
          testId: "cms-integrations-api-keys-active-count",
        },
        {
          label: "CMS-scoped",
          value: fmt(status?.cmsScopedApiKeyCount ?? 0),
          testId: "cms-integrations-api-keys-cms-scoped-count",
        },
      ],
    },
    {
      eyebrow: "CMS delivery",
      title: "Content API",
      description:
        "Issue a read-only API key for headless content delivery. The key only grants access to published content and cannot mutate entries.",
      linkLabel: "Create a read-only Content API key",
      linkTarget: "cms_readonly_key",
    },
    {
      eyebrow: "Publisher automation",
      title: "Publisher automation",
      description:
        "Issue a publisher API key for build pipelines or scheduled publishing tools that need to author and publish entries on your behalf.",
      linkLabel: "Create a publisher automation key",
      linkTarget: "cms_publisher_key",
    },
  ];
}

export function CmsIntegrationsPanel({
  workspaceSlug,
}: CmsIntegrationsPanelProps) {
  const { isAuthenticated, isLoading, getAccessToken } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [status, setStatus] = useState<CmsWorkspaceIntegrationStatus | null>(
    null,
  );

  // Track the "fetch context" (workspace id + auth state) that produced the
  // current `status`. When that context changes — workspace switch, logout,
  // re-auth — we reset `status` to `null` *during render* so the user never
  // sees workspace A's counts while workspace B's fetch is in flight.
  //
  // This is the canonical React pattern for "adjust some state when a prop
  // changes" (see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  // It is preferred over a `setState`-in-effect reset because (a) it avoids
  // a flash of stale data between effect runs, and (b) it is allowed by the
  // `react-hooks/set-state-in-effect` lint rule.
  const fetchContextKey = `${isAuthenticated ? "auth" : "noauth"}|${currentWorkspace?.id ?? ""}`;
  const [lastFetchContextKey, setLastFetchContextKey] =
    useState(fetchContextKey);
  if (lastFetchContextKey !== fetchContextKey) {
    setLastFetchContextKey(fetchContextKey);
    setStatus(null);
  }

  useEffect(() => {
    if (isLoading || !isAuthenticated || !currentWorkspace?.id) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
      if (!apiBaseUrl) {
        if (!cancelled) {
          setStatus(UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS);
        }
        return;
      }

      try {
        const accessToken = await getAccessToken();
        if (cancelled) {
          return;
        }
        if (!accessToken) {
          setStatus(UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS);
          return;
        }

        const next = await fetchCmsWorkspaceIntegrationStatus({
          apiBaseUrl,
          workspaceId: currentWorkspace.id,
          accessToken,
          signal: controller.signal,
        });

        if (!cancelled) {
          setStatus(next);
        }
      } catch {
        if (!cancelled) {
          setStatus(UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAuthenticated, isLoading, currentWorkspace?.id, getAccessToken]);

  const cards = buildIntegrationCards({ status });

  return (
    <section className="flex h-full min-h-[420px] flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace Admin · CMS context
          {" · "}
          <span data-testid="cms-integrations-workspace-slug">
            {workspaceSlug}
          </span>
        </p>
        <h1 className="text-2xl font-semibold leading-7 text-foreground">
          Integrations
        </h1>
        <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
          Verified domains, API keys, and future automation are managed from
          Workspace Admin so the rest of the platform can reuse them. This page
          summarizes what is configured for your workspace and links you to the
          right Workspace Admin tab to make changes.
        </p>
      </header>

      {status?.unavailable ? (
        <Alert
          variant="warning"
          title="Integration status unavailable"
          description="Integration status is temporarily unavailable. Counts shown below may be out of date — refresh the page or open Workspace Admin to confirm."
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <IntegrationCard key={card.linkTarget} {...card} />
        ))}
      </div>

      <Card className="flex flex-col gap-2 border-dashed p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold leading-6 text-foreground">
            Webhooks &amp; deployment hooks
          </h3>
          <Badge variant="outline">Coming soon</Badge>
        </div>
        <p className="text-sm leading-5 text-muted-foreground">
          Workspace webhooks for content events and deployment hooks for
          downstream rebuilds are part of the Workspace Admin roadmap. They will
          appear here once Workspace Admin ships them — CMS does not own the
          webhook lifecycle.
        </p>
      </Card>
    </section>
  );
}
