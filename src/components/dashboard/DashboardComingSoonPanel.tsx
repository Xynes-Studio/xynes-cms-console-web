type DashboardComingSoonPanelProps = {
  sectionLabel: string;
};

type DashboardComingSoonCopy = {
  title: string;
  description: string;
};

const DEFAULT_COMING_SOON_COPY: DashboardComingSoonCopy = {
  title: "Contents are under development",
  description: "Content authoring and publishing are coming soon.",
};

const DASHBOARD_COMING_SOON_COPY_BY_SECTION: Record<string, DashboardComingSoonCopy> = {
  Plugins: {
    title: "Plugins are under development",
    description: "Plugin management is coming soon.",
  },
  "Access Control": {
    title: "Access Control is under development",
    description: "Role and permission management is coming soon.",
  },
  Integrations: {
    title: "Integrations are under development",
    description: "Connectors and external integrations are coming soon.",
  },
  Settings: {
    title: "Settings are under development",
    description: "Workspace settings controls are coming soon.",
  },
};

function getDashboardComingSoonCopy(sectionLabel: string): DashboardComingSoonCopy {
  return DASHBOARD_COMING_SOON_COPY_BY_SECTION[sectionLabel] ?? DEFAULT_COMING_SOON_COPY;
}

export function DashboardComingSoonPanel({
  sectionLabel,
}: DashboardComingSoonPanelProps) {
  const copy = getDashboardComingSoonCopy(sectionLabel);

  return (
    <section className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-border bg-muted/20 p-8">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card/80 p-8 text-center">
        <p className="text-lg font-semibold text-foreground">{copy.title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
      </div>
    </section>
  );
}
