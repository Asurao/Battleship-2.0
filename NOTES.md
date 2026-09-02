# Battleship 2.0 — Prototype Notes

Running log of where things stand between sessions. Newest entry first.
Companion to `Battleship_2.0_GDD.docx` and `Battleship_2.0_Prototype_Roadmap.docx`.

---

## Session 1 — Milestone 1 complete (grid, placement, fog of war)

### What was built
- React + Vite + TypeScript + Tailwind CSS v4 scaffold.
- 12 x 16 grid with the three GDD zones marked (close = rows 1-4, mid = 5-12,
  long = 13-16). Enemy border is the top edge.
- Structure placement: airfield, anti-air battery, command center. Click a cell
  to place the selected type, click a placed structure to remove it.
- Hot-seat flow: End Turn -> "pass the device" screen -> next player. The turn
  counter increments after Player 2 finishes, so one turn = both players acting.
- Fog of war: the enemy tab renders a solid, information-free grid.

### Deliberately NOT built (staying inside M1 scope)
- No economy or budget — placement is unlimited for now (M2/M5).
- No capital structure — the roadmap puts that in M7.
- No civilian cities, no terrain, no combat, no recon.
- Zones are visual only. Zone placement restrictions are in the GDD (§5) but
  are not in the M1 list, so they are not enforced yet.

### Open questions for the next session
1. Does 12 x 16 feel right on screen, or should the grid be coarser?
2. Are the three zones visually obvious enough without labels?
3. Should zone placement restrictions come in early (silos long-range only,
   forward airfields close-range only), or wait until there are more structure
   types to restrict?
4. Is unlimited placement acceptable as a test bed, or does M1 need a fake
   budget to make grid-size feedback meaningful?

### Where to pick up
Milestone 2: attack action, anti-air interception, structure HP, ruins markers,
action points, and the placeholder win condition.

### Architecture notes for future sessions
- `src/game/types.ts` — domain types.
- `src/game/constants.ts` — grid dimensions, zone definitions, structure catalog.
  Add new structures here; the palette and grid read from it automatically.
- `src/game/state.ts` — the whole match state lives in one `useReducer`. Add new
  actions to the `Action` union; TypeScript will flag unhandled cases.
- `src/components/` — presentational only, no game rules.
- Grid is CSS-grid divs, not SVG. When recon flight paths arrive in M3, overlay
  an absolutely-positioned SVG on top of the grid rather than rewriting it.
