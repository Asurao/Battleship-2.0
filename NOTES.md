# Battleship 2.0 — Prototype Notes

Running log of where things stand between sessions. Newest entry first.
Companion to `Battleship_2.0_GDD.docx` and `Battleship_2.0_Prototype_Roadmap.docx`.

---

## Session 5 — Board presets and strike feedback

Playtest feedback. Still pre-M3.

### Decisions taken this session
- **Two board presets, chosen at match start.** Standard 12x16 and Compact 8x12.
  Switching starts a fresh match; it cannot change mid-game without invalidating
  every placement and crater.
- **Only cell-denominated numbers scale with the board.** Bomber range and
  anti-air radius are measured in cells, so they distort if the grid changes.
  Action points, damage, HP and the interception chance are counts and
  probabilities, and stay honest at any size.
- **Action points held at 6 on Compact**, which makes those matches roughly
  twice as fast because structure density doubles. That speed is the reason to
  try a smaller board; if it overshoots, action points are the dial.

### Why range has to scale
Range 12 on a 16-row map puts a forward airfield three quarters of the way down
enemy territory and leaves their long-range zone unreachable — that gap is the
whole forward-versus-rear trade-off. Hold range at 12 on a 12-row map and a
forward airfield covers *everything*, so the long-range zone stops meaning
anything. Range 9 restores the proportions. Measured on Compact:

| Airfield zone | Reaches enemy row |
|---|---|
| Close (row 1) | 9 of 12 |
| Mid (row 6) | 4 of 12 |
| Long (row 11) | nothing |

Anti-air radius drops 3 to 2 because 3 cells covers 25% of a 12-wide board but
37% of an 8-wide one.

### What changed
- Airfield reach previews on hover during build and deployment, not just when
  selected as a launch site. Deployment was previously a blind choice: you found
  out what an airfield reached only on the next turn, after it was built.
- Strike results log in the left panel. Entries appear as each strike lands, so
  the list fills on the beat, and impact markers carry the same number as their
  log line for cross-reference.
- Flight paths animate: the line draws toward its target, then the impact marker
  lands. Done in CSS, not animation frames, which are suspended in a hidden tab.
- Result tiles recoloured and given distinct glyphs.

### Bug worth remembering: two backgrounds on one element
Result tiles carried both the zone tint (`bg-slate-400/[0.04]`) and their result
colour (`bg-orange-500/80`). With two `bg-` utilities on one element **CSS source
order decides the winner, not the order in the class attribute** — and Tailwind
emits arbitrary-value utilities last, so a "damaged" tile was rendering at 4%
opacity. That is why the tiles looked mushy. Cells now declare `opaque` when
they supply their own background, and the zone tint is skipped for those.

### Testing note: hidden panes freeze transitions
`getComputedStyle` on a cell reported the *previous* colour indefinitely while
the browser pane was hidden, because CSS transitions are suspended along with
animation frames. An identical element created fresh in the same parent rendered
correctly. When verifying colour in an embedded browser, screenshot it — reading
computed styles can be measuring a frozen transition rather than the truth.

### Where to pick up
Milestone 3: recon flight paths, fog lifting in scanned areas, civilian cities,
sanctions, casualty auto-loss, plus the phase/timeline UI. Worth playing both
presets first to decide which board M3 gets tuned against.

---

## Session 4 — Setup phase and map legibility

Playtest feedback again. Still pre-M3.

### Decisions taken this session
- **Deployment phase before turn 1.** Each player fields exactly one airfield,
  one anti-air battery and one command centre before any shot is fired. GDD §16
  already specified this; we had skipped it. The free-choice extras it also
  mentions are deliberately left out until the M5 economy prices them.
- **Anti-air envelopes show on hover only**, including while choosing where to
  place one. Always-on gets noisy once several batteries overlap.
- **Stale intel stays stale.** A cell you cleared five turns ago may not be
  clear now. This reinforces the recon pillar: intelligence is maintenance, not
  a one-time sweep.
- **Craters recorded but not blocking, behind a switch.** See below.

### Why the deployment phase mattered more than it looked
P1 firing into an empty map on turn 1 did not merely waste action points — those
misses were recorded as *confirmed empty*, and P2 then built in exactly those
cells. P1 was poisoning their own intel with false negatives that would never
correct. Deploying both sides first removes the turn-1 case, and it also
narrows the first-strike advantage we accepted in session 2, since both players
now enter turn 1 with equal forces.

### The crater idea, and why it is off
Alexander proposed making cells unbuildable once a strike lands on them, so the
board slowly scars. It would fix stale intel outright — a confirmed-empty cell
would stay empty forever. It is deferred rather than rejected, for three
reasons:
- It makes uninformed shooting genuinely useful (area denial with no recon),
  which fights the design's first pillar.
- It collides with M3's sanctions, which punish missing. Rewarding misses now
  and punishing them in M3 means tuning two opposing forces, and it would muddy
  M3's actual test question — is recon worth it, or is guessing still viable?
- GDD §5 explicitly says the defender may build over ruins.

Craters are recorded from now on and rendered faintly on your own map, with
`COMBAT.cratersBlockBuilding` (default false) to switch the rule on mid-playtest
without a code change. If it earns its place, consider craters that heal after
a few turns so the board scars and recovers rather than only shrinking.

### What changed
- Thick red border line between the two front rows, drawn as an overlay so the
  halves still touch and the flight-path coordinate mapping holds.
- Row numbers and zone bands now line up with their rows. They were drifting
  1px per row — about 15px, half a cell, by row 16 — because the grid used
  `gap-px` while the label column used exactly `var(--cell)`. Removing the gaps
  in favour of per-cell borders fixed the labels, the zone rail and the SVG
  overlay alignment in one move.
- Column letters are back, in a sticky strip that stays visible while scrolling.
  They were lost in the session-3 rewrite and survived only in tooltips.
- Anti-air engagement envelope drawn as a circle on hover. A circle, not tinted
  cells: a battery engages anything whose *path crosses* it, including strikes
  aimed well beyond it, so tinted cells would wrongly imply "these squares are
  safe".
- Airfield reach drawn as a full circle across both halves — bright over enemy
  ground where cells are targetable, dim grey over your own, where it only
  shows the envelope's shape.
- Hand-off screen no longer says "Turn 1" during deployment.

### Where to pick up
Milestone 3: recon flight paths, fog lifting in scanned areas, civilian cities,
sanctions, casualty auto-loss. The phase/timeline UI belongs here too. Reuse
`combat.ts` geometry and the `Envelopes` overlay in `MapStack`.

---

## Session 3 — UX pass between M2 and M3 (stacked maps, strike queue)

Driven by playtest feedback. Sits between M2 and M3 deliberately: recon in M3
draws flight paths across the border, so restacking the maps first avoids
building that twice.

### Decisions taken this session
- **Timeline / next-phase UI deferred to M3.** A build/recon/attack sequence is
  what makes a phase model worth having; two modes do not need one.
- **Strikes resolve one at a time with a beat between them** (850ms), rather
  than all at once. Previews M8's cinematic resolution.
- **Attack mode keeps part of your own map visible**, with explicit
  "↑ Front line" and "↓ Your map" buttons to move between halves.

### What changed
- **Maps are stacked, not tabbed.** Enemy territory sits above yours, mirrored
  so its close-range zone meets the shared border. Row 1 is nearest the seam on
  both halves, so row numbers count outward in both directions. A strike now
  draws as one continuous line from the launching airfield across the border to
  its target, which is what the model was doing all along.
- **Plan then commit.** Clicking the enemy map marks a numbered target and
  reserves its action points; clicking a marked cell unmarks it and refunds.
  Nothing flies until Go. This matches GDD §3's action phase, and the queue is
  the same object M4's simultaneous submission needs.
- Flight paths and impact markers are colour-coded by outcome: grey miss,
  orange damaged, red destroyed, blue dashed for intercepted.
- Structure HP is labelled `2/2 HP` and the action-point cost moved onto the
  action, so two unrelated numbers no longer sit side by side unlabelled.
- Each half only accepts clicks in its own mode.

### Bugs found and fixed
- **Flight paths were invisible, not subtle.** `vector-effect: non-scaling-stroke`
  makes stroke width mean screen pixels, so `strokeWidth={0.08}` asked for a
  line 0.08px wide. Removed the vector-effect and set widths in grid units.
- In build mode the enemy half was still live: clickable buttons that silently
  did nothing. Each half is now gated by mode.
- Initial scroll positioning measured the seam before layout, parking the view
  at the top of the stack. Now measured in a layout effect against the
  container's own rect rather than `offsetParent`.

### Environment note worth remembering
Neither `scrollTo({behavior:'smooth'})` nor CSS `scroll-behavior: smooth` is
reliable in every embedded browser — with the CSS property applied, even a
direct `scrollTop` assignment was swallowed. The easing is now done by hand in
`MapStack.scrollTo`. That function also jumps straight to its destination when
`document.hidden`, because animation frames are suspended in a background tab
and the view would otherwise never position itself.

### Where to pick up
Milestone 3: recon flight paths (reuse `combat.ts` geometry and the stacked
overlay), fog lifting in scanned areas, civilian cities, sanctions, and the
casualty auto-loss threshold. The phase/timeline UI belongs here too.

---

## Session 2 — Milestone 2 complete (attack, defend, basic combat)

### Decisions taken this session
- **Sequential turns, not simultaneous.** Simultaneous resolution can't be
  watched together without leaking positions, so it needs 4 device hand-offs per
  turn against sequential's 2. The roadmap also lists simultaneous planning as an
  M4 deliverable, so building it now would have been M4 work done early.
- **No alternating first player.** P1 leads every turn; first-strike advantage
  accepted as a known distortion this early.
- Attacks launch from a specific airfield and fly a real path. Confirmed as
  central to the game, not a detail.

### What was built
- Attacks: choose an airfield, then a target. Cost 2 AP from a flat 6/turn.
- **Range from geometry, not rules.** The two grids face each other across a
  border at y = 0 (`game/combat.ts`). A bomber's reach is plain Euclidean
  distance, which reproduces GDD §5's zone restrictions on its own:
  a close-range airfield reaches 130 enemy cells down to enemy row 12; a
  mid-zone one reaches 34 cells and stops at enemy row 4; a long-range one
  cannot reach at all.
- Anti-air screens a corridor: any battery within 3 cells of the flight path
  rolls 35% to down the strike, nearest-to-border first. Batteries placed
  forward therefore protect everything behind them.
- Structure HP (airfield 2, anti-air 2, command 3), ruins markers, and building
  over ruins is blocked.
- Attacker's picture of the enemy grid accumulates: confirmed empty, damaged,
  destroyed. Intercepted strikes teach the attacker nothing.
- Intelligence briefing at the start of a turn listing what hit you.
- Win condition: destroy every enemy airfield.

### Bugs found and fixed during testing
- Hand-off kept the wrong half of the strike log, so briefings were always
  empty.
- Briefing and pass screen both dispatched `confirmPass`, so acknowledging a
  briefing advanced the turn twice and handed control back to the wrong player.

### The thing to watch in playtest
Blind search is *slow*, and the numbers say so. A forward airfield can reach
~130 cells; a 1x1 structure in that space is found in ~65 shots on average, or
about 22 turns at 3 shots per turn. Expect long, inconclusive matches. That is
the finding M2 exists to produce — it is the argument for recon in M3 — but it
means a match may not reach a natural end. There is no turn-limit failsafe yet
(roadmap puts it in M7). If testing stalls, note the turn count and stop; that
number is the data.

Two levers if it is unbearable: raise `COMBAT.actionPointsPerTurn`, or pull the
turn-30 failsafe forward from M7.

### Where to pick up
Milestone 3: recon flight paths, fog lifting in scanned areas, civilian cities,
sanctions, and the casualty auto-loss threshold.

### Architecture notes added this session
- `src/game/combat.ts` — all strike geometry. Stacked coordinate space with the
  border at y = 0; the defender's half shares the grid's own coordinates, so
  flight paths draw into the SVG overlay with no conversion. Recon paths in M3
  should reuse this.
- `COMBAT` in `constants.ts` — every tunable number in one object. These are the
  hooks the M5 tech tree raises and lowers, and the M8 balance pass turns.

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
