# Shared Visual Language Contract

> Task: V09 contract, extended by V10 Service Scenes, V10-F1 Chinese wayfinding and V11 Adoption
> Baseline: Editorial / Swiss-informed Type × Media
> Scope: public-site static composition. Motion choreography belongs to Phase M.

## 1. Core Principle

Photography is the first visual anchor. Typography defines the field around it; rules, folios and destination labels explain where the visitor is and where the next scene begins. Shared grammar must make scenes feel related without turning them into one repeated layout.

Every scene must pass a static test: with non-essential animation disabled, its hierarchy, reading order and identity remain complete at Desktop and Mobile.

## 2. Editorial Scene Wayfinding Grammar

Each major public scene chooses the smallest meaningful subset of this grammar:

| Element | Contract | Featured implementation |
| --- | --- | --- |
| Scene label | Small uppercase English metadata; names the current scene, never decorative filler. | `SELECTED WORKS` |
| Destination cue | User-facing direction and destination are written in concise Chinese; the cue must name a real destination. | `下一幕 / 自设委托` |
| Long rule | Connects label and destination and establishes the scene boundary. | Bottom wayfinding rail |
| Folio/count | Two-digit current/total only when more than one real item exists; never leave an isolated `01` or invent missing entries. | `01 / 02` → `02 / 02`; hidden for one item |
| Media-edge alignment | At least one primary text or rule edge aligns deliberately with a media edge or grid line. | Featured heading, image and content use the same 12-column field. |
| Section boundary cue | The final rail closes one scene and announces the next; it is not a decorative divider. | `下一幕 / 代表作品` → `下一幕 / 自设委托` → `下一幕 / 设定领养` |
| English metadata | Uppercase, concise and subordinate to Chinese content. | `FEATURED PORTRAIT / 01` only in the real two-item state; otherwise `FEATURED PORTRAIT` |

The public wayfinding sequence is Chinese so visitors can understand the next action without reading English metadata: `下一幕 / 代表作品` → `下一幕 / 自设委托` → `下一幕 / 设定领养`. The Commission page continues with `继续查看 / 制作范围与估价 ↓` and closes with `开始申请 / 填写委托表单 →`. Small uppercase English remains valid for scene labels and indexing metadata, but no longer carries a required navigation instruction. Later scenes must use semantic Chinese variants, not repeat the same words or layout mechanically.

## 3. Type × Media Rules

- Primary photography is larger and higher contrast than supporting copy.
- Primary content photography uses the shared `--radius-image` radius. New photographic scenes must reuse this token so image treatment remains consistent across Featured, Service and later public scenes.
- Background type must either clearly overlap the foreground media or clearly clear it. Near misses are not allowed.
- Background type and folios stay behind content and never carry required information.
- Chinese display type carries the identity/title; English metadata orients and indexes it.
- Text groups may use controlled offsets, but reading order and keyboard order stay linear.
- Scene headings use the left scene label/title only; redundant right-side register slogans are omitted. Their heading rule is capped at `32rem` instead of spanning the entire scene, while Mobile uses the available width.
- Do not turn editorial scenes into rounded cards or floating section containers. The shared image radius applies only to photographic media; gradients, shadows and decorative blobs remain excluded.

## 4. Scene Identity

Shared across scenes:

- monochrome editorial ink and existing public tokens;
- thin structural rules;
- concise uppercase English metadata;
- directional destination cues;
- photography-led composition;
- zero letter spacing and restrained control geometry.

Unique per scene:

- media scale and crop/contain policy;
- typographic scale and overlap;
- content grouping and negative space;
- wayfinding placement and destination;
- page-specific actions and facts.

This contract prohibits a universal `eyebrow + Chinese title + left image + right copy` template.

## 5. Responsive Contract

- Desktop uses a 12-column field and explicit asymmetric balance.
- Mobile is independently composed: background type clearly ends before the media, media remains the first photographic anchor, and the switch control sits directly below it before the content group. It must not inherit Desktop overlap by compression.
- At the reference scene entry, standard Featured content and its destination rail should fit within the current viewport at `375 × 812`, `390 × 844`, `430 × 932`, `768 × 1024`, `1440 × 768` and `1440 × 900`. Reduce decorative scale before hiding semantic wayfinding or collapsing control/content spacing.
- Text never scales continuously with viewport width; discrete breakpoint sizes are used.
- Primary touch targets remain at least 44px. Required information never depends on hover.

## 6. V09 Featured Classification

- Component: `FeaturedWorks.vue`.
- Responsibility: render one complete Featured Type × Media static scene from the existing public featured-work DTO.
- Props: existing `available` and `works`; no new data contract.
- State: one local active index. When the existing DTO contains two eligible works, manual previous/next uses an immediate hard cut and the truthful `01 / 02` → `02 / 02` count. With one work, both controls and all numeric folios are absent.
- Navigation: the main photo opens the active featured work detail; the CTA opens `/works`; manual previous/next is visible and keyboard/touch operable only when a second real item exists.
- Deferred to V13: Featured autoplay, transition choreography, directional motion, reverse, interrupt and media settle. The V09 manual hard cut is a static-state selector, not Motion choreography.
- Deferred to V14: final carousel-control geometry and interaction states.

## 7. V10 Commission Service Classifications

### Homepage Commission · Service Docket

- Component: `HomeBusinessEntries.vue`.
- It answers Featured's `下一幕 / 自设委托` cue and closes with `下一幕 / 设定领养`.
- The standard Homepage scene title scale remains shared with Featured; service identity is established by the large media field, background Typography and the service register rather than by inflating the Chinese title.
- Desktop uses a horizontal photograph followed by an edge-aligned three-part information ledger: status/metadata, process copy and actions. These occupy a separate grid row with a hard gap from the media; no complete white UI card overlays the photograph.
- Mobile independently composes title, background type, rounded photograph, service information, actions and destination rail within the reference viewport.

### `/commission` · Photographic Service Ledger

- Components: `CommissionLead.vue` plus the `/commission` composition surface.
- It uses a wide landscape photograph on Desktop and the existing portrait placement on portrait Mobile, followed by a three-part identity/status/action ledger.
- The content page then separates `SERVICE RANGE / 01` and `ESTIMATE & CONTACT / 02` into an editorial service record. This is intentionally different from the Homepage Docket and must not inherit its compact one-scene geometry.
- Existing business status, application, QQ/Email, QR, terms, focal, media fallback and `home-commission-media` shared transition remain authoritative.
- The first viewport closes with `继续查看 / 制作范围与估价 ↓`; the page-level application rail uses `开始申请 / 填写委托表单 →`. Both are real links and keep the long-rule grammar.

### Deferred UI decisions

- CTA colors and final control geometry remain V14 UI/Controls work. V10 only establishes static composition, scene identity and readable action hierarchy.
- V10 adds no autoplay, arrival choreography or directional transition work; those remain subject to the later static Gate and V13.

## 8. V11 Adoption Classifications

### Homepage Adoption · Dynamic Character Display

- Component: `HomeCurrentAdoptions.vue`.
- The existing adoption comparator remains authoritative. The repository projects at most the newest three `available` roles; one or two real roles remain one or two, `adopted` roles are excluded, and no manual Homepage-featured field is introduced.
- The scene shows one active Character Display plus a truthful role index. Multiple roles provide explicit circular `上一个 / 下一个` controls and the media-edge role index, both operating the same immediate hard-cut state; first previous wraps to last and last next wraps to first. A single role has neither a fake switcher nor an isolated numeric folio.
- The main setting image and primary action both open the active adoption detail. The destination updates with the selected role and remains keyboard/touch operable.
- Long character names use a lower display-size tier instead of truncation. Index count, status, price and business status remain subordinate to the role name and contain media.
- `ADOPTIONS / ADOPTION` is the only retained English business label. Search, status, actions and required navigation use direct Chinese; `ARCHIVE` remains an internal composition classification rather than public copy.

### `/adoptions` · Two-column Adoption Directory

- `AdoptionCard.vue` is an editorial directory entry, not a one-card-per-screen hero or a boxed product card. The page uses a two-column comparison field on Desktop and one column on Mobile; inside each entry, Desktop places media left and the identity panel right, while Mobile stacks them.
- Desktop exposes two complete role summaries in the same 1440×900 opening viewport; Mobile completes one entry and reveals the next boundary. The public projection prefers the already-managed complete design sheet and falls back to the adoption cover only when no sheet exists.
- Each entry is a Character Record rather than an image with a caption: a complete `contain` media canvas remains the first anchor, and a separate information panel carries the horizontal Chinese role name and one detail action without covering the art. Media retains `--radius-image`, no hover scale and no container shadow.
- The information panel shows species, price and availability as three real values without the redundant labels “物种 / 领养价格 / 当前状态”. The values use a small `·` marker and vertical whitespace rather than mini rules, making future three-character species and five-digit prices safe. A large rounded-sans folio is derived from the public list position, sits behind the panel at bottom-right, remains recognisable and is lightly clipped by the record edge; UUID and Featured `sortOrder` are never exposed or repurposed. The whole entry remains a focusable detail link. Rows are separated by spacing and canvas contrast, not horizontal card dividers.
- The directory header pairs the enlarged `ADOPTIONS / 设定领养` identity with a large, rotated, low-opacity studio mark entering from the upper-right edge; the mark balances negative space and carries no content. The repository still calculates `availableCount`, but the page no longer displays a count or business-status prompt. Search and the primary contact action form one borderless, right-aligned operation group on Desktop; the search-result summary only appears after an active search and disappears again when cleared.
- Search, pagination, status-first ordering, price, detail routes and focus semantics remain unchanged.
- `联系我们申请领养` is the directory's primary conversion action and uses the shared primary-action treatment; search submit remains an operational control, not the business destination.

### Adoption Detail Variant

- The unified `/works/[slug]` base remains shared for future V12-A. V11 only adds the adoption-specific label, identity ledger, direct `联系咨询领养` action and return to all adoption roles.
- The detail does not infer status or price absent from its DTO. V11 changes only which existing public media record is preferred by the list projection; it introduces no endpoint, schema, database, migration or media-topology change.
- V11 is static: no adoption autoplay or transition choreography is added. Those decisions remain outside this task.
