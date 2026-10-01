# ConsciOS Responsive HTML Standard

All user-facing HTML surfaces should be usable without page-level horizontal scrolling from narrow phones through large desktop displays. This standard applies to new browser tools, dashboards, experiments, and generated HTML artifacts unless a documented visualization explicitly requires a pannable canvas.

## Required baseline

1. Use a mobile viewport declaration with safe-area support:
   `width=device-width,initial-scale=1,viewport-fit=cover`.
2. Apply `box-sizing: border-box` to all elements and pseudo-elements.
3. Keep `html` and `body` at `width/max-width: 100%` and prevent accidental page-level horizontal overflow.
4. Give flex/grid children `min-width: 0` so content can shrink instead of forcing the viewport wider.
5. Constrain media, canvases, and iframes to the available width.
6. Prefer fluid grids such as `minmax(0, 1fr)` and `repeat(auto-fit, minmax(...))`; avoid fixed columns that exceed the viewport.
7. Put intentionally wide navigation/tool strips in their own contained horizontal scroller rather than widening the page.
8. At phone breakpoints, collapse multi-column application layouts to one column and allow toolbars/actions to wrap or scroll inside their own container.
9. Use touch targets of about 44 CSS px or larger for primary phone controls.
10. Respect `env(safe-area-inset-*)` where chrome can touch device edges.
11. Preserve text zoom and browser zoom. Do not disable user scaling.
12. Preserve `prefers-reduced-motion` behavior for animated or transitioning interfaces.

## Content rules

- Long URLs, model IDs, code, JSON, and generated output must wrap or scroll inside a bounded component.
- Inputs, selects, textareas, dialogs, cards, and preformatted output must never have an intrinsic minimum width larger than the viewport.
- Use `100dvh` where full-height mobile application surfaces need to follow dynamic browser chrome; retain a content-flow fallback for small screens.
- Embedded applications must have an explicit security boundary (`sandbox`, referrer policy, and narrowly scoped permissions) and a usable fallback when framing is blocked.
- Do not depend on hover for essential controls.

## Responsive verification widths

Before merging a browser-surface change, review at minimum:

- 320 px narrow-phone width
- 360–390 px common Android/iPhone width
- 768 px tablet width
- 1024 px compact desktop/tablet landscape
- 1440 px desktop width

The acceptance criterion is not that every layout looks identical. It is that all controls remain reachable, text remains legible, intentional scrollers remain contained, and the document itself does not overflow horizontally.

## ConsciOS shared implementation

`local/conscios-ui.css` provides the shared responsive baseline. Product surfaces should load it and then add only surface-specific responsive rules. The Workbench verification suite checks the shared overflow containment, `min-width: 0`, safe-area behavior, reduced-motion support, and the exo application's bounded runtime/iframe contract.
