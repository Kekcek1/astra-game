# Next game brief: EMBERSHIFT

Copy this file into the next game session and follow it as the product brief.

```text
Create an original, publication-ready browser game for Yandex Games called EMBERSHIFT: an infinite co-op-style solo expedition about keeping an underground city alive during moving seasonal disasters.

DESIGN GOAL
Deliver the long-term appeal of a survival strategy and a compact run-based roguelite, but avoid the usual passive clicker, endless runner, idle wall of upgrade buttons, or clone of an existing tower-defense title. Every run must force the player to make meaningful tradeoffs and every long-term system must change play, not merely inflate numbers.

CORE LOOP
1. A run lasts 6-10 minutes. The player sees a clear, hand-authored opening situation, chooses one of three neighboring underground sectors to explore, resolves its encounter, and decides whether to spend scarce oxygen, heat, and tools now or carry them forward.
2. Encounters are assembled from a small set of authored, deterministic templates: cave-in, flooded shaft, displaced residents, spore bloom, and salvage dispute. Procedural rules vary map shape, entrances, hazards, loot, and one twist. Each generated map must remain reachable; show a route-check result in development tests.
3. In real time, navigate a tiny pixel-art engineer through a compact top-down room. Move with WASD or a mobile virtual stick; interact at close range with a context button. The threat evolves while the player acts. Combat is a deliberate secondary response, not automatic tapping.
4. Between rooms, select one of two mutually exclusive contracts. Choosing shelter improves recovery; choosing salvage improves the city but adds danger to the next sector. Deep runs introduce more complex combinations rather than multiplying enemy health without limit.
5. At a run-ending evacuation, convert rescued inhabitants, recovered blueprints, and repaired relays into permanent choices: unlock alternate starting teams, new tool behaviors, map information, and risky route options. Permanent progression must open choices, not make early content trivial.
6. Return to a persistent atlas with region conditions, a daily deterministic seed, a local high-score table, and short weekly-style modifiers. The atlas is the reason to return; no fake real-time timers, pressure streaks, or expiring rewards.

ORIGINALITY AND TONE
Make the central mechanic the Heat Circuit: a small graph of connected districts whose rooms share heat. Redirecting heat powers a forge, thaws a route, or draws creatures toward a vent. Switching one relay saves one room while altering a neighboring room's conditions. Express this through playable systems, not text-only choices. The setting is a warm, handmade, after-the-storm settlement built under the roots of a vast tree. Original characters, factions, maps, symbols, effects, and names only.

VISUALS AND ACCESSIBILITY
2D, portrait-friendly responsive HTML5, original readable pixel art, 384x216 internal canvas with crisp integer scaling, and a tactile interface. Use a restrained 8-12-color palette with several distinct hue families. Clearly distinguish safe/warm, wet, toxic, and structural-danger states with icon + color so color alone is never required. Include pause, sound controls, reduced-motion preference, keyboard support, touch support, and visible objective/state information. Localize at least Russian and English with no text overflow on 390x844, 768x1024, and 1280x800.

PROCEDURAL CONTRACT
- Seed format: unsigned 32-bit integer; same seed, stage, and rules version reproduce the same run.
- Use authored encounter tiles/modules assembled by explicit constraints; procedural variety may not place hazards inside the sole exit, create unreachable required loot, overlap interaction targets, or exceed a documented content budget.
- Add a headless deterministic generator check that verifies connectivity, valid entrances/exits, non-overlapping placement, stable seed output, and a complete scripted run from entry to evacuation.
- Store campaign progress, unlocks, settings, and local best runs in versioned storage. Saving a run checkpoint must restore its seed, current room, inventory, HP, heat graph, upgrades, and generation version after reload.
- Surface missing/corrupt saves as a usable fresh game without destroying unrelated stored data.

FIRST DELIVERY AND STOP GATE
First inspect the existing workspace, Git status, licenses, and available headless browser tooling. Then build a small but complete vertical slice: workshop/atlas, 3 connected deterministic encounter rooms, one relay-heat decision, one contract choice, one escape/death result, and a meaningful permanent unlock. Include at least 3 authored encounter modules and two seed-variation checks. Prove that victory and loss paths both save correctly, a resumed run is identical, and mobile/desktop inputs work. Run build/lint/type gates present in the repository, the deterministic generator checks, a 30-second headless browser gate with zero console exceptions, and a screenshot review at desktop and mobile sizes. Report actual results and remaining limitations. Stop for the user's playtest before adding biomes, new factions, SDK, monetization, or large content packs.

PLATFORM AND MONETIZATION
Treat web delivery as the default. Use Yandex Games SDK only from the official current documentation. If integrated in a later phase, ads may appear only between expeditions or as explicitly optional rewarded video for a useful but nonessential consumable; pause simulation/audio while an ad is active; preserve in-run checkpoints across ad return; never fake an ad or use an external ad provider. An unavailable SDK must use honest local fallbacks and must not pretend the game is published or monetized.

NON-GOALS
No online multiplayer, backend, account requirement, paid loot boxes, copied artwork or text, third-party ad network, fake multiplayer population, or endless content claims without a validated deterministic generator and measurable content boundaries.

HANDOFF
Always provide the actual local preview URL, changed-file list, executable commands for the deterministic tests, evidence from the end-to-end run, and any unresolved publication/SDK limits. Never commit, publish, or push without separate user approval.
```
