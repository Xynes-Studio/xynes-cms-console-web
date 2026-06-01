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
 *  - Lumia DS only for chrome (`Card`, `Badge`, `Alert`, `ExternalLink`,
 *    `Info`); native `<a>` for deep links so we do not nest interactive
 *    content inside Lumia's `<button>` element.
 *  - Pure URL/security logic lives in `./workspace-admin-links`.
 *  - Pure data-fetch + envelope logic lives in
 *    `../../lib/dashboard/workspace-integrations-client`.
 *  - This file owns rendering and effect orchestration only.
 *
 * Visual design (BUG-CMS-10, 2026-06-01): the page matches the
 * `~/Downloads/xynes-design-system/project/ui_kits/xynes-app/CMSIntegrations.jsx`
 * reference — read-only notice banner above the grid, single bordered metric
 * strip per card with internal divider (instead of two separate boxes), a
 * full-width "Workspace webhooks (Planned)" row below the grid that is NOT
 * a card in the grid, and an ExternalLink icon trailing each deep-link CTA.
 */

import { useEffect, useState } from "react";
import { Alert, Badge, Card, buttonStyles } from "@lumia-ui/components";
import { IconExternalLink, IconInfo } from "@lumia-ui/icons";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";
import { useTranslations } from "next-intl";
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
  workspaceSlug: string;
  metrics?: IntegrationMetric[];
};

const cardWrapperClasses = "flex h-full flex-col gap-4 p-6";
type IntegrationTranslator = ReturnType<typeof useTranslations>;

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
 *
 * Trailing icon: per the BUG-CMS-10 design reference, the CTA carries a
 * Lumia DS `ExternalLink` icon on the right edge. For relative-fallback
 * (same-origin) links, the icon is omitted because no new tab opens — the
 * affordance would be misleading.
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
    // Per the design reference, the CTA sits left-aligned at the bottom of
    // its card. `self-start` prevents it from stretching to fill the parent
    // flex row.
    "self-start",
    "gap-2",
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
          <IconExternalLink size={14} aria-hidden="true" />
          {/* sr-only hint so AT users hear the same affordance as sighted
              users get from the trailing ExternalLink icon. */}
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
  workspaceSlug,
  metrics,
}: IntegrationCardProps) {
  const href = buildWorkspaceAdminIntegrationUrl(linkTarget, workspaceSlug);

  return (
    <Card className={cardWrapperClasses}>
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {eyebrow}
        </span>
        <h2 className="text-[17px] font-semibold leading-6 text-foreground">
          {title}
        </h2>
        <p className="text-[13px] leading-5 text-muted-foreground">
          {description}
        </p>
      </div>

      {metrics && metrics.length > 0 ? (
        // Single bordered strip with internal divider — matches the design
        // reference's `.ci-stats` block. Each cell carries a tiny uppercase
        // label + a large numeric value. The wrapper is a `<dl>` for
        // semantics; cells are `<div>`s with `<dt>`/`<dd>` children.
        <dl
          className="mt-1 flex overflow-hidden rounded-md border border-border bg-muted/30 divide-x divide-border"
          data-testid={`cms-integrations-metric-strip-${linkTarget}`}
        >
          {metrics.map((metric) => (
            <div
              key={metric.testId}
              className="flex-1 px-3.5 py-3 flex flex-col gap-1.5"
            >
              <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {metric.label}
              </dt>
              <dd
                data-testid={metric.testId}
                className="text-2xl font-bold leading-none tracking-tight text-foreground"
              >
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-auto pt-1">
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
  t,
  workspaceSlug,
}: {
  status: CmsWorkspaceIntegrationStatus | null;
  t: IntegrationTranslator;
  workspaceSlug: string;
}): IntegrationCardProps[] {
  const live = isStatusLive(status);
  const fmt = (count: number): number | string => (live ? count : "—");

  return [
    {
      eyebrow: t("sections.domains.eyebrow"),
      title: t("sections.domains.title"),
      description: t("sections.domains.description"),
      linkLabel: t("sections.domains.linkLabel"),
      linkTarget: "domains",
      workspaceSlug,
      metrics: [
        {
          label: t("sections.domains.verifiedMetric"),
          value: fmt(status?.verifiedDomainCount ?? 0),
          testId: "cms-integrations-domains-verified-count",
        },
        {
          label: t("sections.domains.pendingMetric"),
          value: fmt(status?.pendingDomainCount ?? 0),
          testId: "cms-integrations-domains-pending-count",
        },
      ],
    },
    {
      eyebrow: t("sections.apiKeys.eyebrow"),
      title: t("sections.apiKeys.title"),
      description: t("sections.apiKeys.description"),
      linkLabel: t("sections.apiKeys.linkLabel"),
      linkTarget: "api_keys",
      workspaceSlug,
      metrics: [
        {
          label: t("sections.apiKeys.activeMetric"),
          value: fmt(status?.activeApiKeyCount ?? 0),
          testId: "cms-integrations-api-keys-active-count",
        },
        {
          label: t("sections.apiKeys.cmsScopedMetric"),
          value: fmt(status?.cmsScopedApiKeyCount ?? 0),
          testId: "cms-integrations-api-keys-cms-scoped-count",
        },
      ],
    },
    {
      eyebrow: t("sections.contentApi.eyebrow"),
      title: t("sections.contentApi.title"),
      description: t("sections.contentApi.description"),
      linkLabel: t("sections.contentApi.linkLabel"),
      linkTarget: "cms_readonly_key",
      workspaceSlug,
    },
    {
      eyebrow: t("sections.publisher.eyebrow"),
      title: t("sections.publisher.title"),
      description: t("sections.publisher.description"),
      linkLabel: t("sections.publisher.linkLabel"),
      linkTarget: "cms_publisher_key",
      workspaceSlug,
    },
  ];
}

export function CmsIntegrationsPanel({
  workspaceSlug,
}: CmsIntegrationsPanelProps) {
  const { isAuthenticated, isLoading, getAccessToken } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const t = useTranslations("cms.integrations");
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

  const cards = buildIntegrationCards({ status, t, workspaceSlug });

  return (
    <section className="flex h-full min-h-105 flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
          {t("slugLabel")}
          {" · "}
          <span data-testid="cms-integrations-workspace-slug">
            {workspaceSlug}
          </span>
        </p>
        <h1 className="text-[28px] font-bold leading-8.5 tracking-[-0.013em] text-foreground">
          {t("heading")}
        </h1>
        <p className="max-w-140 text-[14px] leading-5.5 text-muted-foreground">
          {t("summary")}
        </p>
      </header>

      {/* Read-only notice banner. Neutral surface (not destructive) — a
          warning Alert would over-signal here; this page being read-only
          is the *intended* state, not a failure mode. We deliberately use
          a plain `<div>` (NOT a Lumia `<Card>`) because Card's baked-in
          `rounded-lg border bg-background shadow-sm overflow-hidden`
          chrome (a) over-emphasises the notice into looking like a
          dedicated panel, and (b) conflicts with our `bg-muted/30`
          tint so the className-merger keeps both `bg-background`
          (Card's default) and `bg-muted/30` (our override) in the
          class list, leaving the final swatch up to CSS source order
          rather than our intent. The notice also keeps `role="alert"`
          contractually distinct from the status-unavailable warning
          Alert below. */}
      <div
        className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3 text-[13px] leading-5 text-muted-foreground"
        data-testid="cms-integrations-read-only-notice"
      >
        <IconInfo
          size={15}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-muted-foreground"
        />
        <p className="m-0 min-w-0 flex-1">
          <strong className="font-semibold text-foreground">
            {t("notice.title")}
          </strong>{" "}
          {t("notice.description")}
        </p>
      </div>

      {status?.unavailable ? (
        <Alert
          variant="warning"
          title={t("statusUnavailableTitle")}
          description={t("statusUnavailableDescription")}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <IntegrationCard key={card.linkTarget} {...card} />
        ))}
      </div>

      {/* Workspace webhooks (Planned) — full-width horizontal strip below the
          grid, NOT a card inside the grid. Matches the design reference's
          `.ci-webhooks` block. */}
      <Card
        className="flex items-center justify-between gap-3 rounded-lg border border-border px-5 py-4"
        data-testid="cms-integrations-future-automation"
      >
        <div className="flex items-center gap-2.5">
          <IconExternalLink
            size={17}
            aria-hidden="true"
            className="text-muted-foreground"
          />
          <h3 className="text-[15px] font-semibold leading-none text-foreground">
            {t("futureAutomationTitle")}
          </h3>
        </div>
        <Badge variant="outline">{t("futureAutomationBadge")}</Badge>
      </Card>
    </section>
  );
}
