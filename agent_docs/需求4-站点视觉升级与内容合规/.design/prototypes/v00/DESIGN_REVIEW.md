# Design Review: V00 A + M2

Reviewed against: `agent_docs/需求4-站点视觉升级与内容合规/.design/prototypes/v00/INDEX.md`
Date: 2026-08-23

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `.design/prototypes/v00/screenshots/review-a-m2-mobile-375.png` | Mobile (375x812) | Single-column media and content flow |
| `.design/prototypes/v00/screenshots/review-a-m2-tablet-768.png` | Tablet (768x1024) | Left media, right content and folio balance |
| `.design/prototypes/v00/screenshots/review-a-m2-desktop-1280.png` | Desktop (1280x800) | Editorial offset composition with right folio anchor |

## Summary

A now has a clear left-to-right reading path: the portrait leads, the role copy follows, and the pale `01` folio balances the lower-right edge. The desktop change is visible without changing the mobile single-column hierarchy.

## Must Fix

None found in this focused review.

## Should Fix

None for the requested balance adjustment. A second published Featured Work is still needed to visually validate the enabled `01 / 02` controls; the current database intentionally exposes `01 / 01`.

## Could Improve

After a customer selects a layout and motion character, run the broader T47 responsive and reduced-motion pass before promoting any prototype styles into production.

## What Works Well

- Desktop media is anchored in the left grid (`x=174-598` at 1280px).
- The folio is a quiet right-side anchor (`x=1087-1215`) and remains behind content.
- Mobile keeps readable single-column ordering with no horizontal overflow.
- A + M2 retains its soft-settle offset plate without shifting the visual center back toward the left.
