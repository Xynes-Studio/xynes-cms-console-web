# CMS Console Marketing Copy (LP-CMS)

> **Owner:** `xynes-front-end/xynes-cms-console-web`
> **Surface:** `https://cms.xynes.com/` (the public landing page at `/`).
> **Plan reference:** [LP-CMS §5](../../infra/docs/plans/2026-06-04-landing-page-template/03-xynes-cms-console-web-landing.md).

This file is the **human-editable source of truth** for the landing-page copy. Non-engineers can review changes here via PR without touching JSX.

The same strings also live in `messages/en-US/cms.landing.json` (the i18n catalog `next-intl` reads at runtime) and are pseudo-localized into `messages/en-XA/cms.landing.json`. The two surfaces are kept in lockstep by `src/lib/landing-copy.ts` — see **§ Wire-up** below. The translator metadata sidecar at `messages.meta/cms.landing.json` describes the audience, surface, security policy, link policy, and marketing-honesty policy for translators.

When this file changes, update the JSON catalogs in lockstep so the runtime + the source of truth stay aligned. The `src/lib/landing-copy.test.ts` suite asserts catalog parity.

---

## § Brand voice

- Direct and confident. Avoid marketing fluff.
- Verbs over adjectives. "Publish from your team's directory" beats "Powerful publishing platform".
- Concrete only when honest. Do NOT fabricate audit cadences, hosting regions, or feature promises that require operator-side env flips to deliver.
- Tone matches the rest of the CMS surface (authenticated dashboard, editor, integrations) — not a separate marketing voice.

## § Hero

Mirrors the LP-AUTH hero shape so the two public surfaces feel like one product.

- **Headline:** "Xynes CMS Console"
- **Sub-head:** "Write, organize, and publish content in a workspace your editors understand, with Workspace Admin handling access and API keys."
- **Primary CTA:** "Sign in" → auth-app handshake `/login` *(returning user funnel — dominant case for `cms.xynes.com/`)*
- **Secondary CTA:** "Create an account" → auth-app handshake `/signup`
- **Footnote:** "Session cookies only. No tracking cookies."

## § Features (3 cards)

### 1. Structure Editors Can Follow

- **Icon:** `folder`
- **Headline:** "Structure Editors Can Follow"
- **Body:** "Organize pages, posts, and reusable content around the way your team plans work, so publishing does not depend on tribal knowledge."

### 2. Connected To Workspace Admin

- **Icon:** `key`
- **Headline:** "Connected To Workspace Admin"
- **Body:** "Use the same workspace identity, verified domains, and API-key lifecycle your administrators already manage in Xynes Workspace Admin."

### 3. Developer-Ready Delivery

- **Icon:** `code`
- **Headline:** "Developer-Ready Delivery"
- **Body:** "Give developers a clean content API while editors keep a simple console for drafting, publishing, and returning to work quickly."

## § Trust strip

- **Repo:** `https://github.com/Xynes-Studio/xynes-cms-console-web`
- **License:** `AGPL-3.0`
- **Security:** `/SECURITY.md`
- **Residency:** *(intentionally omitted — until product confirms the apex hosting region per 00-overview §14 Q4, the landing page does not assert it.)*

## § Footer columns

### Product

- **Sign in** → auth-app handshake `/login`
- **Sign up** → auth-app handshake `/signup`
- **Workspace Admin** → auth-app `/dashboard/integrations`

### Developers

- **cms-console on GitHub** → `https://github.com/Xynes-Studio/xynes-cms-console-web` *(external)*
- **Docs** → `https://docs.xynes.com` *(external)*

### Company

- **xynes.com** → `https://xynes.com` *(external)*
- **Status** → `https://status.xynes.com` *(external)*

### Legal

- **Privacy** → `https://xynes.com/legal/privacy` *(external)*
- **Terms** → `https://xynes.com/legal/terms` *(external)*
- **Cookies** → `https://xynes.com/legal/cookies` *(external)*
- **Security** → `/SECURITY.md`

## § Copyright

> © 2026 Xynes Studio. Built in the open.

## § Cookie disclosure

- **Body:** "We use a session cookie for sign-in. No tracking cookies."
- **Policy link label:** "Cookie policy" → `https://xynes.com/legal/cookies`
- **Dismiss label:** "Got it"

## § What we deliberately do NOT promise

These were considered for the landing page and intentionally cut because they would either overpromise or leak implementation detail:

- "Image / video / document processing" as a default feature — at MVP, live processors require `STORAGE_PROCESSOR_MODE=live` + sidecar deployment (per the STORAGE-FU-A..G follow-ups in AGENTS.md). Stub mode is the laptop default.
- "Audit cadence" claims — there is no published cadence yet.
- "Hosted in <region>" — apex hosting region is an open product question (00-overview §14 Q4).
- Implementation-detail FAQ entries (ClamAV, signed-URL delivery, R2 specifics) — they belong in `docs.xynes.com`, not in a 30-second first-time-visitor scan.

Marketing copy should be loaded into the landing page as features ship to all customers, not as they ship to operators willing to flip env vars.

## § Wire-up

The page reads localized strings via `useTranslations('cms.landing')` from `next-intl`. The non-localized structural data (icon IDs, URLs, footer columns) lives in `src/lib/landing-copy.ts`, which is the bridge between this human-editable source and the JSX.

To change a URL or icon, edit `src/lib/landing-copy.ts`. To change visible text, edit `messages/en-US/cms.landing.json` AND this file in lockstep, then update `messages/en-XA/cms.landing.json` to keep the pseudo-locale parity test green.

`src/lib/landing-copy.test.ts` enforces that this wiring (structure, URLs, allowlists, catalog key parity) stays consistent.
