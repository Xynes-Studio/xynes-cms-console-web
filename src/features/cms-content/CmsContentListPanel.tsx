"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { BreadcrumbItem } from "@lumia-ui/components";
import { Card } from "@lumia-ui/components";
import {
  CmsContentToolbar,
  type CmsContentSortBy,
  type CmsContentView,
} from "../../components/dashboard/CmsContentToolbar";

export function CmsContentListPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<CmsContentSortBy>("date");
  const [view, setView] = useState<CmsContentView>("list");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const pathParts = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const contentIndex = pathParts.lastIndexOf("content");
  const breadcrumbParts =
    contentIndex >= 0 ? pathParts.slice(contentIndex + 1) : [];
  const workspaceSlug =
    contentIndex > 0 && pathParts[contentIndex - 1]
      ? pathParts[contentIndex - 1]
      : null;
  const contentBasePath = workspaceSlug
    ? `/dashboard/${encodeURIComponent(workspaceSlug)}/content`
    : "/dashboard";

  const breadcrumbItems: BreadcrumbItem[] = [
    {
      label: "Contents",
      onClick: () => router.push(contentBasePath),
    },
  ];

  breadcrumbParts.forEach((segment, index) => {
    const to = `${contentBasePath}/${breadcrumbParts
      .slice(0, index + 1)
      .map((part) => encodeURIComponent(part))
      .join("/")}`;

    breadcrumbItems.push({
      label: segment,
      onClick: () => router.push(to),
    });
  });

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label="Content list panel"
    >
      <CmsContentToolbar
        breadcrumbItems={breadcrumbItems}
        itemCount={0}
        query={query}
        sortBy={sortBy}
        view={view}
        followingOnly={followingOnly}
        favoritesOnly={favoritesOnly}
        onCreate={() => {
          return;
        }}
        onQueryChange={setQuery}
        onSearchSubmit={() => {
          return;
        }}
        onSortChange={setSortBy}
        onViewChange={setView}
        onFollowingToggle={() => setFollowingOnly((current) => !current)}
        onFavoritesToggle={() => setFavoritesOnly((current) => !current)}
      />

      <Card className="m-4 flex min-h-[280px] items-center justify-center border border-border bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Content entries will appear here.
        </p>
      </Card>
    </section>
  );
}
