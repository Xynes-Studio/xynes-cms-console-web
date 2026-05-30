// BUG-CMS-8 — shared owner-label resolution for CMS content cards.
//
// Single source of truth for the "what owner string do we render?" decision
// across `CmsContentCardGrid` and `CmsContentCardList`. Both cards must agree
// on the precedence rules (and the api-key fallback) so the same entry shows
// the same owner label in either layout.

export type CmsEntryCardCreator = {
  id: string;
  displayName: string | null;
};

export type ResolveOwnerLabelInput = {
  /**
   * Structured creator field from the CMS Core list payload.
   *   - `null`           => api_key actor (renders the `apiKeyCreatorLabel`).
   *   - `{ id, displayName }` => real human creator.
   *   - `undefined`      => caller did not pass — fall through to ownerName.
   */
  creator: CmsEntryCardCreator | null | undefined;

  /**
   * Legacy editor-alias on the entry `data` blob. Preserved as a fallback so
   * existing entries that had a custom owner string set via the (rare)
   * `data.ownerName` path keep their visible label.
   */
  ownerName: string | null | undefined;

  /**
   * Localized "Created via API key" label. Only surfaces when `creator === null`.
   * The caller MUST NOT pass any key id / prefix / hash here — the api-key
   * actor invariant is contractually preserved by the cms-core handler
   * shipping `creator: null` instead of a partial object.
   */
  apiKeyCreatorLabel: string;

  /**
   * Localized "Unknown owner" fallback. Surfaces when no creator info AND
   * no legacy ownerName alias is available.
   */
  fallbackOwnerLabel: string;
};

/**
 * Precedence:
 *   1. `creator === null`           -> `apiKeyCreatorLabel`
 *   2. `creator.displayName` trimmed -> displayName
 *   3. `ownerName` trimmed           -> ownerName  (legacy editor alias)
 *   4. otherwise                     -> `fallbackOwnerLabel`
 */
export function resolveOwnerLabel({
  creator,
  ownerName,
  apiKeyCreatorLabel,
  fallbackOwnerLabel,
}: ResolveOwnerLabelInput): string {
  if (creator === null) {
    return apiKeyCreatorLabel;
  }
  const displayName = creator?.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  const legacy = ownerName?.trim();
  if (legacy) {
    return legacy;
  }
  return fallbackOwnerLabel;
}
