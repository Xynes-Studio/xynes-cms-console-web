import type { FormEvent } from "react";
import { Button, Chip, Input, Select, ViewToggle } from "@lumia-ui/components";
import { Icon } from "@lumia-ui/icons";

export type CmsContentSortBy = "date" | "title" | "popularity";
export type CmsContentView = "grid" | "list";

export type CmsContentToolbarProps = {
  pathLabel: string;
  itemCount: number;
  query: string;
  sortBy: CmsContentSortBy;
  view: CmsContentView;
  followingOnly: boolean;
  favoritesOnly: boolean;
  filterDisabled?: boolean;
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

export function CmsContentToolbar({
  pathLabel,
  itemCount,
  query,
  sortBy,
  view,
  followingOnly,
  favoritesOnly,
  filterDisabled = true,
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
      className="flex flex-col gap-3 border-b border-border bg-background px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="max-w-[420px] truncate rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-foreground"
            title={pathLabel}
          >
            {pathLabel}
          </span>
          <span className="text-sm text-foreground/90">{itemCount} Items</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onCreate} aria-label="Create content">
            <Icon name="add" size="sm" />
            Create
          </Button>
          <form className="flex items-center gap-2" onSubmit={handleSubmit}>
            <Input
              aria-label="Search for contents"
              placeholder="Search for Contents"
              value={query}
              onChange={(event) => onQueryChange(event.currentTarget.value)}
            />
            <Button type="submit" size="sm" variant="primary" aria-label="Search contents">
              Search
            </Button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            toggle
            active={followingOnly}
            onClick={onFollowingToggle}
            leadingIcon={<Icon name="users" size="sm" />}
            aria-label="Toggle following filter"
          >
            Following
          </Chip>
          <Chip
            toggle
            active={favoritesOnly}
            onClick={onFavoritesToggle}
            leadingIcon={<Icon name="check" size="sm" />}
            aria-label="Toggle favorites filter"
          >
            Favorites
          </Chip>
          <Chip
            toggle
            active={false}
            disabled={filterDisabled}
            onClick={onFilterClick}
            leadingIcon={<Icon name="filter" size="sm" />}
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
    </section>
  );
}

