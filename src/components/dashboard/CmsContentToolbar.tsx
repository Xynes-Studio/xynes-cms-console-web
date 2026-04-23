import type { CSSProperties, FormEvent, Ref } from "react";
import {
  Breadcrumbs,
  Button,
  Chip,
  Input,
  Select,
  ViewToggle,
  type BreadcrumbItem,
} from "@lumia-ui/components";
import { Star } from "lucide-react";
import { Icon } from "@lumia-ui/icons";

export type CmsContentSortBy = "date" | "title" | "popularity";
export type CmsContentView = "grid" | "list";

export type CmsContentToolbarProps = {
  breadcrumbItems: BreadcrumbItem[];
  itemCount: number;
  query: string;
  sortBy: CmsContentSortBy;
  view: CmsContentView;
  followingOnly: boolean;
  favoritesOnly: boolean;
  filterDisabled?: boolean;
  className?: string;
  primaryRowClassName?: string;
  secondaryRowClassName?: string;
  secondaryRowContainerClassName?: string;
  secondaryRowContainerStyle?: CSSProperties;
  secondaryRowHidden?: boolean;
  secondaryRowRef?: Ref<HTMLDivElement>;
  onCreate: () => void;
  onQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSortChange: (value: CmsContentSortBy) => void;
  onViewChange: (value: CmsContentView) => void;
  onFollowingToggle: () => void;
  onFavoritesToggle: () => void;
  onFilterClick?: () => void;
};

const sortOptions: Array<{ label: string; value: CmsContentSortBy }> = [
  { label: "Date", value: "date" },
  { label: "Title", value: "title" },
  { label: "Popularity", value: "popularity" },
];

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function CmsContentToolbar({
  breadcrumbItems,
  itemCount,
  query,
  sortBy,
  view,
  followingOnly,
  favoritesOnly,
  filterDisabled = true,
  className,
  primaryRowClassName,
  secondaryRowClassName,
  secondaryRowContainerClassName,
  secondaryRowContainerStyle,
  secondaryRowHidden = false,
  secondaryRowRef,
  onCreate,
  onQueryChange,
  onSearchSubmit,
  onSortChange,
  onViewChange,
  onFollowingToggle,
  onFavoritesToggle,
  onFilterClick,
}: CmsContentToolbarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchSubmit();
  };

  return (
    <section
      aria-label="Content toolbar"
      className={cx("flex flex-col bg-background", className)}
    >
      <div
        data-testid="cms-content-toolbar-primary-row"
        className={cx(
          "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3",
          primaryRowClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Breadcrumbs
            items={breadcrumbItems}
            maxItems={5}
            className="min-w-0 rounded-full border border-border px-3 py-1 [&_a]:cursor-pointer [&_button]:cursor-pointer"
          />
          <span className="text-sm text-foreground/90">{itemCount} Items</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onCreate} aria-label="Create content">
            <Icon
              name="add"
              size="sm"
              color="currentColor"
              aria-hidden="true"
            />
            Create
          </Button>
          <form className="flex items-center gap-2" onSubmit={handleSubmit}>
            <Input
              aria-label="Search for contents"
              placeholder="Search for Contents"
              value={query}
              onChange={(event) => onQueryChange(event.currentTarget.value)}
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              aria-label="Search contents"
            >
              Search
            </Button>
          </form>
        </div>
      </div>

      <div
        data-testid="cms-content-toolbar-secondary-shell"
        className={cx(
          "overflow-hidden bg-background",
          secondaryRowContainerClassName,
        )}
        style={secondaryRowContainerStyle}
      >
        <div
          ref={secondaryRowRef}
          data-testid="cms-content-toolbar-secondary-row"
          inert={secondaryRowHidden}
          className={cx(
            "flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-all duration-200 ease-out",
            secondaryRowHidden && "pointer-events-none -translate-y-2 opacity-0",
            secondaryRowClassName,
          )}
          aria-hidden={secondaryRowHidden || undefined}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              size="sm"
              toggle
              active={followingOnly}
              onClick={onFollowingToggle}
              iconName="users"
              aria-label="Toggle following filter"
            >
              Following
            </Chip>
            <Chip
              size="sm"
              toggle
              active={favoritesOnly}
              onClick={onFavoritesToggle}
              icon={<Star className="h-4 w-4" aria-hidden="true" />}
              aria-label="Toggle favorites filter"
            >
              Favorites
            </Chip>
            <Chip
              size="sm"
              toggle
              active={false}
              disabled={filterDisabled}
              onClick={onFilterClick}
              iconName="filter"
              aria-label="Open advanced filters"
            >
              Filter
            </Chip>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Sort content"
              value={sortBy}
              onChange={(event) =>
                onSortChange(event.currentTarget.value as CmsContentSortBy)
              }
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <ViewToggle mode={view} onChange={onViewChange} />
          </div>
        </div>
      </div>
    </section>
  );
}
