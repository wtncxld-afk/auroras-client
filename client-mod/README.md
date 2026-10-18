# Auroras Client mod

## Layout
```
client-mod/
  core/                      Plain Java, no Minecraft classes. Module registry, settings, profiles, HUD maths,
                             version adapters table, performance helpers. Fully unit-tested.
  adapters/mojmap/           Minecraft 1.21.11 and 26.1 / 26.2 / 26.3 (Fabric). One source written against Mojang's
                             names, built once per target (targets/*.properties) by the release workflow.
  adapters/fabric-1.21.4/    The older adapter for 1.21.4 (Yarn names). Kept for reference, no longer built in CI.
  ParseCheck.java            Syntax check for adapter code when the Minecraft jars aren't available.
```
Version-specific code lives only in an adapter. The core never checks Minecraft versions itself.

## Custom Skies (in game)
`AurorasSky.java` draws the sky dome, stars and aurora for the theme in your settings, using Fabric API's sky hook (`DimensionRenderingRegistry`) instead of a mixin. Colors, star positions and aurora curves come from core `Sky`, which the launcher preview mirrors. The mod reads its settings files when the game starts, so changes made in the launcher while the game is running apply on the next start. Changes made in the in-game menu apply at once, except switching Custom Skies on or off, which always needs a restart. The Nether and End keep their vanilla sky unless you pick a theme for them. Like the rest of the adapter it has **never been compiled or run**. Minecraft's own clouds, weather and fog are left as they are.

The themes come from `visuals/themes.json`, copied into the mod at build time, so the launcher and the game read the same file.

Animated effects come from core `SkyFx`: shooting stars, nebula drift, clouds, petals, constellations and layered aurora are pure functions of a seed, an index and the time, so nothing is simulated frame by frame and the launcher preview draws the same thing at the same moment. How much is drawn follows the sky quality budget (`SkyFx.budget`); Low skips the aurora and nebula. Measured on the build machine, not in game: 0.003 ms (Low), 0.03 ms (Balanced) and 0.07 ms (High) per frame for the effect maths, with no allocation.

## Module menu (Right Shift)
`ModuleScreen` draws the menu with the shared design tokens (`ui/AUi.java`, reading `visuals/design-tokens.json` bundled at build time). It has a category rail, search, module cards with switches, and a settings page per module with a switch, slider, segmented control, dropdown, color steps or key bind as the setting needs. Right-click resets a setting. You can scroll, Tab through controls and change values with the arrow keys. Unavailable modules show a lock and can't be switched on. All layout and editing rules are in core `ModuleMenu` and tested in `UiTests`; like the rest of the adapter, the drawing has **never been compiled or seen**.

## HUD and HUD editor (in game)
`HudRenderer` draws the enabled HUD modules with core `Hud` / `HudKit` maths (anchors, offsets, scale, styles, formatters, animations). `HudEditorScreen` lets you drag, snap (hold Alt to place freely), resize with the corner handle, nudge with the arrow keys, right-click to reset an element, and save or cycle layout presets in `config/auroras/hud-layouts/`, the same files the launcher's editor writes. Spotify now playing reads `config/auroras/nowplaying.json`, which the launcher writes while the game runs; the mod never talks to Spotify itself.

## Emotes (in game)
`AurorasEmotes` loads the built-in emotes (`visuals/emotes.json`, bundled at build time), your custom emotes from `config/auroras/emotes/*.json` and the wheel from `config/auroras/emotes/wheel.txt`, all written by the launcher. Hold the wheel key (B by default) to open `EmoteWheelScreen`, point at a slot and let go. Moving, jumping, sneaking, swimming or riding cancels an emote (setting), and pressing the key again stops it. While an emote plays the camera switches to third person and switches back afterwards (setting). `PlayerEntityModelMixin` poses only your own player model, mixing each part with the normal animation by the controller's weight, so emotes blend in and out. Playback, blending and cancelling are core `Emotes.Controller`, the same code the launcher preview runs. **Local only:** nothing is sent to the server, so other players don't see emotes. The mixin assumes `PlayerEntityRenderState` has an `id` field in 1.21.4 mappings; that's unverified until the first build.

## Player, rendering and cosmetic modules (in game)
`AurorasModules` runs them; the rules are core `GameLogic` and `Calc`, tested in `ModuleTests`. Each hook starts with one boolean check, so a module that is off costs nothing. Mixins (all in `mixin/`, all unverified until the first build):

| Module | Hook |
|---|---|
| Zoom | `GameRendererMixin` multiplies `getFov`; `MouseMixin` slows the mouse and turns the scroll wheel into zoom while zooming |
| Freelook | `MouseMixin` sends mouse movement to the freelook camera; `CameraMixin` replaces the camera's `setRotation` in `Camera#update`. The view switches to third person while freelooking and back afterwards |
| Toggle Sprint / Sneak, Perspective | No mixin: Minecraft's own sprint and sneak keys are held for you each tick, so the game still decides when you may sprint; the front-view key and skip-front rule set the perspective option |
| Crosshair | `InGameHudMixin` cancels `renderCrosshair` and draws the core shapes (not in spectator mode or with the debug screen open) |
| Boss Bar | `BossBarHudMixin` cancels or transforms `BossBarHud#render` |
| Low Fire | `InGameOverlayRendererMixin` moves the fire overlay down and lowers its alpha |
| Fullbright | `SimpleOptionMixin` makes the gamma option read higher while on; the saved value is never changed |
| Particle Settings | `ParticleManagerMixin` drops particles in `addParticle` and the block-break methods |
| Hit Color | `OverlayTextureMixin` changes the red rows of the overlay texture when it is built, so it needs a restart |
| Player Glow | `PlayerGlowMixin` (`hasOutline`, your own player only, third person) and `PlayerGlowColorMixin` (`getTeamColorValue`) |
| Custom Capes | `CapeMixin` swaps the cape texture in your own `getSkinTextures()` for `config/auroras/cape.png` (written by Cape Studio > Use in game, re-read when it changes). Only you see it |
| Totem Effects | `GameRendererMixin#showFloatingItem` notices your totem popping; particles and the flash follow `GameLogic.TotemFx` |
| Information modules | Drawn by `HudRenderer` like HUD elements (direction, freelook status, session statistics, server information, frame time graph, memory, biome, logo) |

## Minecraft 1.21.11 and later (adapters/mojmap)
- **One source, four builds.** `common/` is written once against Mojang's official names, which Fabric uses for 1.21.11 (remapped) and 26.x (the game ships unobfuscated). The part that really differs between them is small and lives in `gui-v1/` (1.21.11: `GuiGraphics`, GLFW key codes) and `gui-v2/` (26.x: `GuiGraphicsExtractor`, SDL key codes): drawing (`Gfx`), the screen base class (`AScreen`), key mappings and the HUD layer (`Platform`). Settings files keep GLFW key codes; `Keys` converts through Minecraft's own key constants.
- **Build one target:** `cd adapters/mojmap && gradle build -Ptarget=26.3` (needs JDK 25 and Gradle 9.7+). Targets: `1.21.11`, `26.1`, `26.2`, `26.3`. Fabric loader, Loom and Fabric API versions come from Fabric's example mod for each version. A 26.x jar loads on every hotfix of its line (`~26.3`).
- **The HUD** goes through Fabric's HUD element registry: the Auroras layer sits just below chat, and the vanilla crosshair and boss bar are wrapped (not patched) for Crosshair Customizer and Boss Bar.
- **Every mixin is optional** (`defaultRequire: 0`). If a method name differs in some version, that one feature stays off and the game still starts; look for Mixin warnings mentioning Auroras in `logs/latest.log`.
- **Not ported yet:** Custom Skies (Fabric has no sky hook for these versions) and Custom Capes (player skins changed shape in 1.21.9). On these versions the menu shows them locked with that reason (core `Registry.restrict`). Low Fire is 1.21.11 only for now.
- **Never compiled against the real game.** Names were checked against Fabric API's own sources for 1.21.11 and 26.3 where they use the same classes, and the whole adapter compiles against stand-in classes that mirror those assumptions (so its own pieces fit together). The first real build will show what still differs.

## Version guard
On startup the adapter reads the running Minecraft version and asks `Adapters.select(...)` whether it is the adapter for it. If not, it registers nothing at all and logs why, so a mismatched jar can't half-work. `fabric.mod.json` also pins the exact version, so Fabric refuses to load it on another release.

## Adding a new Minecraft release
1. Copy `adapters/fabric-1.21.4` to `adapters/fabric-<version>`.
2. In its `gradle.properties`, set `minecraft_version`, `yarn_mappings`, `loader_version` and `fabric_version` to the values listed at https://fabricmc.net/develop for that release.
3. In `fabric.mod.json`, set `"minecraft": "<version>"`. Rename the adapter id check in `AurorasClient.java`.
4. Build. Fix whatever Mojang changed (rendering, `DrawContext`, keybinds, text) **in that adapter only**.
5. Add an entry to `Adapters.ALL` in core with `Status.SCAFFOLD`, and a core test for it.
6. Play-test it (checklist below). Only then change it to `Status.VALIDATED` and add `{ "mc": "<version>", "loader": "fabric", "client": "<client version>" }` to the launcher's `validated.json`. The launcher shows "Untested" until that file says otherwise.

## In-game checklist before marking a version validated
- Right Shift opens and closes the menu; Escape closes it; the game doesn't pause in multiplayer.
- FPS, Coordinates, Clock and Keystrokes toggle on and off and draw in the right place at GUI scale 1, 2, 3 and Auto, and after resizing the window.
- Settings and the active profile survive a restart.
- No errors in `logs/latest.log` mentioning Auroras.
- Run the benchmark (below) with the client enabled and with the jar removed, same spot, same settings, and compare.

## Benchmark
Bind "Auroras benchmark (60 s)" in Controls. Stand still and press it. After 60 seconds it writes a row to `config/auroras/benchmarks.csv`: average FPS, 1% low FPS, average and 99th percentile frame time, memory used and allocated, and GC count and pause time. Compare runs with and without the mod to see its real cost.

## Building
- Core tests: `cd core && java Build.java`, then `java -cp out gg.auroras.core.<Suite> ../../visuals` for `Tests`, `PerfTests`, `VisualTests`, `HudTests`, `EmoteTests`, `UiTests` and `ModuleTests`.
- Core microbenchmarks: `java -cp out gg.auroras.core.Bench` (machine-level numbers, not in-game ones).
- Adapter: install a JDK 21, then `cd adapters/fabric-1.21.4 && gradle build`. **This has never been run.** Expect small API fixes on the first build.
- Syntax check without Minecraft jars: `java ParseCheck.java adapters/fabric-1.21.4/src`
