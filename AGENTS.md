<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:figma-export-rules -->
# Figma Export — MANDATORY post-capture cleanup

After ANY `generate_figma_design` capture (web → Figma), you MUST immediately follow up with a `use_figma` script that frees ALL elements for unrestricted resizing, otherwise the user cannot edit them. Run BEFORE telling the user "done".

The script must do, recursively over EVERY descendant of the captured frame:

1. `node.locked = false` — unlock everything
2. If `node.layoutMode && node.layoutMode !== 'NONE'` → set `layoutMode = 'NONE'` (kills auto-layout)
3. `node.layoutPositioning = 'AUTO'` (no absolute-positioning lock)
4. `node.constraints = { horizontal: 'MIN', vertical: 'MIN' }` (no scale/stretch on resize of parent)
5. `node.layoutSizingHorizontal = 'FIXED'` and `node.layoutSizingVertical = 'FIXED'` (no FILL/HUG locks)
6. Clear `minWidth/maxWidth/minHeight/maxHeight` if present (set to `null`)
7. `node.clipsContent = false` on EVERY frame (else children get clipped when extending past parent)
8. For TEXT nodes: `node.textAutoResize = 'NONE'` (so user can drag-resize the bounding box freely)
9. **CRITICAL: Convert COMPONENT/COMPONENT_SET masters to plain FRAMEs.** `generate_figma_design` may emit nested `COMPONENT` nodes (not instances of any library — just bare masters embedded in the layout). Their children inherit instance-like edit restrictions and CANNOT be freely resized in the Figma UI. Algorithm:
   - First, detach all `INSTANCE` nodes via `inst.detachInstance()` (deepest-first to avoid stale IDs).
   - Then for every remaining `COMPONENT` / `COMPONENT_SET`: create a sibling `figma.createFrame()` at the same x/y/width/height with cloned fills, `parent.insertChild(idx, newFrame)`, move all children of the component into the new frame via `appendChild`, then `comp.remove()`.
   - Re-run the unlock pass after conversion (new frames need clipsContent=false, etc.).

10. **MOST CRITICAL — Parent-encloses-children fix (the REAL UI resize blocker).** `generate_figma_design` exports children with positions/sizes that often OVERFLOW their parent frame's bounds (e.g. Image 433×125 placed at x=-117 inside a 220×87 parent). When this happens, the Figma **UI hit-testing** treats clicks on the visible child as clicks on the parent, so the user can drag-MOVE but cannot drag-RESIZE the child — there are no corner handles in the clickable area. Fix:
    - For every non-auto-layout FRAME (post step 2), compute the bounding box of all its children in parent-local coords (`min(x), min(y), max(x+width), max(y+height)`).
    - If bbox extends outside parent: shift parent's `x/y` by `(minX, minY)`, compensate every child by `(-minX, -minY)`, then `parent.resize(maxX-minX, maxY-minY)`.
    - Also reset stale auto-layout-derived properties on the parent (residue from the original auto-layout state, even after `layoutMode='NONE'`): `primaryAxisSizingMode='FIXED'`, `counterAxisSizingMode='FIXED'`, `primaryAxisAlignItems='MIN'`, `counterAxisAlignItems='MIN'`, all paddings and `itemSpacing` to `0`.
    - Run TWO passes (children first, then parents) so bounds are stable.
    - Without this, ALL nested elements (logos, icons, text) become un-resizable in the Figma UI even though `node.resize()` works fine via the API.

Always wrap `try/catch` per property — some node types reject some props.
Return counts of what was modified.

This is the difference between a usable Figma file and an unusable one. Never skip it.
<!-- END:figma-export-rules -->

<!-- BEGIN:carousel-image-rules -->
# Carousel product images — CSS rules (DO NOT revert)

File: `src/app/globals.css`

`.catalog-card-image-wrap` must have `overflow: hidden` and `align-items/justify-content: center` (not `stretch`).
`.catalog-card-image` must have `transform: scale(1.4)` — this normalizes varying whitespace padding baked into product photos and fills the card visually.

Both desktop and mobile (`@media max-width: 767px`) blocks require these rules.

**Do not remove `transform: scale(1.4)` or `overflow: hidden` from these selectors.** They are intentional design decisions, not bugs.
<!-- END:carousel-image-rules -->
