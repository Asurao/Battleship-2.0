# Battleship 2.0 — Prototype Notes

Running log of where things stand between sessions. Newest entry first.
Companion to `Battleship_2.0_GDD.docx` and `Battleship_2.0_Prototype_Roadmap.docx`.

---

## Session 12 — State hygiene, then simultaneous deployment

### The bugs, and their shared cause
Moving state to the server moved things that were never match state. Panel mode,
selected structure and selected airfield were all shared, so one player's
palette selection was the other's. Order queues were global too, so a player's
marked targets were drawn on the opponent's screen — and in the opponent's
coordinate frame, which put them on the wrong half of the map.

Fixed by putting view state back in the client and moving order queues onto the
player who owns them. Actions now carry what they need (`placeStructure` carries
the kind, `queueStrike` carries the source airfield) rather than reading UI
state, which also makes them self-contained as a network protocol.

### The reducer takes an actor
`reducer(state, action, actor)` rather than assuming `activePlayer`. The
transport already knows who is acting: hot-seat passes the active player, the
server passes the seat the socket belongs to. This is what made simultaneous
deployment a small change rather than a rewrite.

### Simultaneous deployment
Online, both players field their forces at once and the match starts when both
declare ready — no waiting while the other places three buildings.

Hot-seat keeps the hand-off, because one device cannot show two secret maps at
once. Both fall out of the same rule: `finishSetup` starts the match if the
opponent is already ready, and otherwise hands over. Online the server steps
straight past the hand-off; hot-seat shows it.

The worker also had to stop gating actions on `activePlayer` during setup, since
during deployment both seats are legitimately acting — each only ever touching
their own territory.

### Verified across two live clients
Player 2 deployed first without waiting, declared ready, saw "waiting for your
opponent to finish deploying", and the match began the moment Player 1 was
ready. Hot-seat still passes the device correctly. No console errors either way.

### Where to pick up
Pass 2 — the resolution experience: the defender watches incoming operations
land on their own map, preceded by an alert so they are looking, at a slower
pace, with a scrollable match log replacing the briefing interstitial. Board
selector comes out of the game screen (it lives on the landing screen now) and
Situation gets slimmed into the left column.

---

## Session 11 — Networked multiplayer, part one

Multiplayer moved forward from M4 to now, so the game can be tested with people
remotely. The order is unchanged — multiplayer was the next milestone anyway —
but the scope grew from two tabs on one machine to real networked play.

### Why a server rather than peer-to-peer
Alexander is not worried about cheating at this stage, which removes one
argument, but two stronger ones remain:
- **Determinism.** Interception rolls use `Math.random` and every id comes from
  a module-level counter. Two browsers running the same reducer would roll
  different dice and mint different ids, so one player would see "shot down"
  where the other saw "airfield damaged". That is far worse than cheating: it is
  silent, and each client is individually consistent.
- **Reconnection.** Friends refresh, close laptops and lose wifi. With state on
  the server they rejoin; with state in a tab the match is gone.

Peer-to-peer also needs a signalling server regardless, so it buys nothing.

### What was built
- **A Match seam** (`src/match/types.ts`) carrying state, dispatch, which seat
  you occupy, and whether you may act. Hot-seat and networked play are two
  implementations of it; `App` renders from your seat either way.
- **A Durable Object per match** (`worker/MatchRoom.ts`) holding authoritative
  state in storage and relaying it over hibernatable WebSockets. State lives in
  storage rather than memory because hibernation evicts the object while players
  think — which is what keeps an idle match free, and means matches also survive
  a browser close.
- **Seats claimed by browser token**, not arrival order, so a refresh resumes
  the same side and a third viewer gets "match is full".
- **Landing screen**: host (choosing the board, which cannot change later), join
  by code, or hot-seat. The match code lives in the URL hash, so the link is the
  match.
- The pass screen is stepped through server-side online, since there is no
  device to hand over.

### Deviation from what was planned
Deployment stays **sequential**, not simultaneous. Making it simultaneous needs
the reducer to accept "who is acting" rather than assuming `activePlayer` — the
same change simultaneous *turns* will need. Doing it once, properly, in part two
is better than a hack here.

### Bug found in testing
Briefings rendered on both clients, so the player who had just finished their
turn was shown their opponent's intelligence report addressed to them, with
zeroes in it. Briefings and hand-offs now render only for the player whose turn
is opening; the other client stays on its board behind the waiting banner.

### Testing two players in one browser
Two tabs share `localStorage` and would fight over one seat, so `?seat=b`
selects a second identity. The waiting screen links to it. That also delivers
the roadmap's original "two-tab multiplayer" for free.

### Where to pick up
Part two: simultaneous turns and deployment, via an explicit actor on reducer
actions. Then deploy — that needs Alexander's Cloudflare account (`wrangler
login`), which is the one step that cannot be done for him.

---

## Session 10 — Recon course preview, briefing colours, End Turn guard

### What changed
- **Hovering a recon destination previews the whole course**: a dashed line from
  the airfield plus every cell the flight would overfly, outlined in green.
  This makes the diagonal advantage legible instead of theoretical — measured
  from the same airfield at full range: straight ahead 13 cells, a shallow
  diagonal 16, a full diagonal 17. Once units and upgrades arrive, choosing a
  course for a purpose is a real decision, and it now reads before committing.
- **Briefing entries are colour-coded by outcome** — rose for destroyed, orange
  for damaged, sky for intercepted, slate for a miss, alongside the emerald
  already used for overflights.
- **End Turn asks twice when orders are pending.** It sits directly under
  Commit, and ending a turn with unfired orders silently burns them along with
  the whole turn's action points. With nothing queued it still ends on one
  click, so the common case keeps no friction. It is also separated by a divider
  and styled as a secondary action now.

### Implementation note
The End Turn confirmation is stored as a snapshot key (player, turn, mode,
pending count) rather than a boolean, so any change of situation invalidates it
during render. A boolean would have needed an effect to reset it, which lint
correctly flags as cascading renders.

---

## Session 9 — Recon

The first half of the original M3. Civilians and sanctions remain deferred.

### Decisions taken this session
- **Recon flies on its own sortie allowance.** An airfield gets one combat
  sortie and one recon sortie per turn, so it can both scout and strike.
  Sharing a single sortie would have forced a choice so stark that a
  one-airfield player could never do both.
- **A flight reveals only the cells it actually passes over**, however briefly
  — not a corridor. This makes the angle you fly a real decision: a diagonal
  crosses far more cells than a straight run for the same range budget.
  Measured in play: a diagonal to J9 revealed 13 cells.
- Recon reaches further than bombs (Standard 14 vs 12, Compact 10.5 vs 9), so a
  player can see ground they cannot yet hit — which is what makes planning a
  forward base worthwhile.

### What was built
- Recon action: pick an airfield, pick a destination, 1 AP per flight.
- `cellsAlongPath` in `combat.ts` — collects the parameters where the segment
  crosses a column or row boundary, then reads the cell at the midpoint of each
  span. Counts a cell the path merely clips, which is what makes diagonals pay.
- Anti-air engages recon aircraft exactly as it engages strikes. **A downed
  flight keeps whatever it saw before it fell**, so interception is a partial
  loss rather than a wasted action point.
- Scouted cells show the structure standing there; empty overflown cells become
  confirmed empty. Recon overwrites older intel, and goes stale like everything
  else.
- The defender is briefed on aircraft crossing their territory, per GDD
  pillar 2 — the passive intelligence the design wants.
- **One commit fires both queues**, recon first, then strikes (GDD §12). Because
  both are committed together, this turn's intel cannot inform this turn's
  attacks — the separation is structural rather than a rule to police.

### Bugs found while testing
- The briefing only triggered on incoming strikes, so a recon-only turn was
  completely silent to the defender — exactly the passive intelligence the GDD
  is built on.
- Resolution stalled after the last recon: the effect driving the beat watched
  `queued.length` but not `queuedRecon.length`, so draining a recon did not
  retrigger the timer and the strikes sat in the queue forever.

### Follow-up fix
Recon mode showed no range overlay and no hover feedback on the enemy map: the
reachable set was computed correctly for recon but then discarded, because the
map was only given it when `attacking`. The reach circle also drew at bomber
range while scouting. Both now follow the active mode — 117 cells and radius 12
attacking, 143 cells and radius 14 scouting.

### Still open
The phase/timeline UI. Three tabs (Build / Recon / Attack) plus a single commit
button are functionally sufficient, so the timeline is now presentation rather
than mechanism. Worth doing, but it is no longer blocking anything.

### Where to pick up
Play it: the question this milestone exists to answer is whether recon
investment feels worth it, or whether guessing is still viable. After that,
civilians and sanctions.

---

## Session 8 — Interception marks, left control column, repeat strikes

Small tweaks from playtesting, plus the GDD edit.

### GDD updated
Added "Anti-Air Activation States" to §18 (Open Questions / Deferred Decisions),
between "Doctrine Triggers" and "Working Title". It records that §6 already
calls for active/passive defense, that the prototype does not implement it, the
concrete two-state mechanic proposed (roughly 15% baseline, 35% activated, 1
action point per battery), and that the anti-air radius cut is a holding measure
until it lands.

Word had a lock on the file, so the edit waited until it was closed — editing
underneath an open document loses the change on its next save. Worth checking
for `~$*.docx` before touching either document.

### What changed
- **Interception marks persist.** Where a strike was shot down is recorded on
  the attacker's map and survives across turns. This is real intelligence: the
  mark is the closest point on the flight path to the battery that fired, so a
  battery sits within its engagement radius of that point and repeated marks
  triangulate it. A "Clear N marks" button wipes them when the map gets busy.
- **All controls moved into one left column** — player, turn, budget, actions,
  the Build/Attack tabs, the active panel, and End Turn, stacked vertically. The
  header is now just the title. The map keeps only its own view controls.
- **Strikes may stack on one cell.** A second click adds another sortie rather
  than cancelling the first, so a known but well-defended target can be hit
  twice in a turn. Removal moved to the strike plan list, which already had
  per-entry remove buttons. A cell with several strikes shows ×N.

### Note
Stacking a cell needs more than one airfield, because each flies one sortie per
turn — so it only becomes possible once a second airfield is bought, around
turn 3 on current income.

### Where to pick up
Recon, then the phase/timeline UI, then civilians and sanctions.

---

## Session 7 — Economy tuning: sorties, no starting budget, weaker anti-air

Playtest feedback: the starting budget double-dipped, and every match converged
on either stacking command centres or stacking anti-air.

### Why those two dominated
They were the only structures whose value compounds.
- A command centre gives +2 action points **every remaining turn**, so it scales
  with match length. A second airfield gave nothing, because attacking was
  limited by action points, not by airfields.
- Anti-air compounds multiplicatively: every battery crossing a flight path
  rolled independently, so four cheap batteries made a corridor 82% lethal
  (0.65^4 survival).

### The fix, which was Alexander's idea and is better than cost escalation
**One sortie per airfield per turn.** Command centres now grant action points
and airfields grant the capacity to spend them, so stacking either alone leaves
the surplus unusable. Going from two attacks a turn to three needs both another
airfield (5) and another command centre (6) — about three turns of income.

Cost escalation was considered and dropped: with sorties in place it is only
needed for anti-air, and upgrades (M5) are the better answer to "what else do I
spend on". Kept flat.

### What changed
- **Starting budget removed** (8 to 0). It let a player deploy three free
  structures and immediately buy more, so the opening never felt committed.
  First purchase now lands around turn 1-2 on income alone.
- **One sortie per airfield.** An airfield that has flown shows as grounded, and
  further targets from it are refused.
- **Anti-air radius reduced** — Standard 3 to 2, Compact 2 to 1.5, keeping it
  proportional to board width. Covering a corridor now takes more batteries, so
  stacking costs more without changing the per-battery maths.

### Deferred: active vs passive anti-air
GDD §6 already says defenses should be an active investment — unactivated
batteries at "reduced effectiveness", activation costing action points. The
concrete mechanic we landed on (roughly 15% baseline, 35% activated, 1 AP per
battery) is deferred, and has been written into GDD §18 as a deferred decision.

That mechanic is still the real fix for anti-air stacking; the radius reduction
is a holding measure. If fleets of batteries still dominate after a playtest,
activation is the thing to reach for.

### Income does not arrive on turn 1 either
Removing the starting budget alone was not enough: income still landed as turn 1
opened, so a player had money before doing anything with the forces they
deployed — the same problem in a different place. The government's first payment
now arrives on turn 2, for both players.

| | Turn 1 | Turn 2 | Turn 3 |
|---|---|---|---|
| Budget | 0 | 4 | 8 |

First anti-air affordable turn 2, first extra airfield turn 3.

### Verified in play
Turn 1 opens with budget 0 and 4 action points from the deployed command centre,
but only 1 sortie — so 2 action points sit unusable until a second airfield is
bought. That squeeze is the intended pressure, and recon will absorb spare
points permanently once it lands, since recon costs 1.

### Where to pick up
Recon, then the phase/timeline UI. Watch whether the sortie limit makes the
early game feel starved rather than tight.

---

## Session 6 — Economy, first pass

Milestone order changed. Resources come before recon, and civilians/sanctions
move to a later milestone: they are not needed for the core loop yet, and
sanctions had nothing to bite on without a budget.

### What the GDD specifies (§11)
Three resources. **Defense budget** — granted each turn by the civilian
government, spent on structures and upgrades, with income rising on successful
strikes and on being attacked, falling on civilian casualties, and subject to
diminishing returns on consecutive strikes. **Research points** — from labs and
command centres, spent on the tech tree and scientist bids. **Action points** —
per turn, no carryover, and "capacity scales with the player's command
infrastructure". §5 adds that structures are consumables: a forward airfield is
a "fast-burning fuse" whose earnings finance the safer back-line structures that
replace it.

### What this pass includes
- Defense budget: 8 to start, +4 flat each turn, carries over.
- Structure costs — airfield 5, anti-air 4, command centre 6.
- **Action points = 2 + 2 per surviving command centre**, replacing the flat 6.
- Deployment restored to GDD §16: one of each required structure free, then the
  starting budget buys extras.
- Structures raised this turn refund in full; once the turn is handed over they
  are permanent. Without that window a player could relocate their whole base
  every turn for nothing.

### Deliberately excluded
- **Research points.** Nothing to spend them on until the tech tree, so they
  would be a number accumulating with no sink. They arrive with what they buy.
- **Income modifiers** (strike income, attacked income, comeback bonus).
  Alexander's call, and a good one: the GDD pairs strike income with two
  anti-runaway brakes precisely because it snowballs, so shipping the engine and
  its brakes together would make it impossible to tell which is doing what. Flat
  income gives a clean read on scarcity alone.
  *Known gap while this holds:* the "fast-burning fuse" economy is not being
  tested. Forward placement currently trades on reach versus survival only, not
  on earnings.
- **Economic collapse win condition.** Costs nothing to omit — the existing win
  condition fires the moment a player's last airfield is destroyed, so nobody
  can sit airfield-less and broke. There is no blocked state to rescue.

### The consequence to watch
Tying action points to command centres makes them a tempo target: destroying one
cuts the enemy's actions per turn. Until now only airfields were worth hitting,
because they were the win condition. Verified in play — a player who bought a
second command centre at deployment had 6 action points against the other's 4.

A budget also means losing your last airfield is no longer instant death; you
can rebuild if you can afford it. And rebuilding behind an enemy's search is now
a spending decision rather than a free move, which is the first real pressure on
the stale-intel problem from session 4.

### Where to pick up
Recon: flight paths reusing `combat.ts` geometry, corridor reveal, anti-air
engaging recon aircraft, and the phase/timeline UI. Recon range and corridor
width are cell-denominated, so they belong in the board preset next to bomber
range and anti-air radius. Civilians and sanctions follow after that.

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
