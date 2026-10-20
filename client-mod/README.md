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
On 1.21.4 (`adapters/fabric-1.21.4`), `AurorasSky.java` draws the sky dome, stars and aurora for the theme in your settings, using Fabric API's sky hook (`DimensionRenderingRegistry`) instead of a mixin. Colors, star positions and aurora curves come from core `Sky`, which the launcher preview mirrors. The mod reads its settings files when the game starts, so changes made in the launcher while the game is running apply on the next start. Changes made in the in-game menu apply at once, except switching Custom Skies on or off, which always needs a restart. The Nether and End keep their vanilla sky unless you pick a theme for them. Like the rest of the adapter it has **never been compiled or run**. Minecraft's own clouds, weather and fog are left as they are.

The themes come from `visuals/themes.json`, copied into the mod at build time, so the launcher and the game read the same file.

Animated effects come from core `SkyFx`: shooting stars, nebula drift, clouds, petals, constellations and layered aurora are pure functions of a seed, an index and the time, so nothing is simulated frame by frame and the launcher preview draws the same thing at the same moment. How much is drawn follows the sky quality budget (`SkyFx.budget`); Low skips the aurora and nebula. Measured on the build machine, not in game: 0.003 ms (Low), 0.03 ms (Balanced) and 0.07 ms (High) per frame for the effect maths, with no allocation.

## Module menu (Right Shift)
`ModuleScreen` draws the menu with the shared design tokens (`ui/AUi.java`, reading `visuals/design-tokens.json` bundled at build time). It has a category rail, search, module cards with switches, and a settings page per module with a switch, slider, segmented control, dropdown, color steps or key bind as the setting needs. Right-click resets a setting. You can scroll, Tab through controls and change values with the arrow keys. Unavailable modules show a lock and can't be switched on. All layout and editing rules are in core `ModuleMenu` and tested in `UiTests`; like the rest of the adapter, the drawing has **never been compiled or seen**.

## Main menu and pause menu (in game)
`TitleMenuScreen` replaces the vanilla title screen. It shows the Auroras wordmark over the menu theme's animated background (`MenuFx`), with glass buttons for Singleplayer, Multiplayer, Join VexVanilla (vexvanilla.net, through the multiplayer safety screen if you haven't skipped it), Auroras menu (the Right Shift radial menu), Options and Quit. Your name and 3D head are top right, and the versions are bottom left. Mojang's copyright line is kept bottom right and opens the credits screen. `PauseMenuScreen` replaces the full pause menu but not the F3+Esc one. It has Back to game, Advancements, Statistics, Options, Auroras menu, the world button (Open to LAN on 1.21.11/26.1, Multiplayer options on 26.2, World options on 26.3, as vanilla has it) and Save and quit or Disconnect. Every button runs the same code as the vanilla button (`VanillaMenus`, checked against javap). Both screens have a "Vanilla menu" link that opens the vanilla screen once, so Realms and Mod Menu's button stay reachable.

How it hooks in: `ScreenSwapMixin` is an optional `@ModifyVariable` on `setScreen`. That is `Minecraft#setScreen` on 1.21.11/26.1 and `Gui#setScreen` on 26.2/26.3. It swaps only an exact `TitleScreen` or `PauseScreen`, so mods' subclasses are left alone, and it falls back to vanilla on any error. In Settings you can turn each menu off ("Custom main menu", "Custom pause menu") and choose the main menu layout (left or centre). The entrance and hover animations follow Menu animations and reduced motion. Layout, focus order and motion maths are core `GameMenus`, tested in `UiTests`. Preview without the game: `tools/gui-preview` (MenuPreview). The build compiles on all four targets, but the menus have **not been run in game yet**.

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
| Custom Capes | (1.21.4) `CapeMixin` swaps the cape texture in your own `getSkinTextures()` for `config/auroras/cape.png` (written by Cape Studio > Use in game, re-read when it changes). Only you see it |
| Totem Effects | `GameRendererMixin#showFloatingItem` notices your totem popping; particles and the flash follow `GameLogic.TotemFx` |
| Information modules | Drawn by `HudRenderer` like HUD elements (direction, freelook status, session statistics, server information, frame time graph, memory, biome, logo) |

### Animation, player and stream modules (mojmap only, 1.21.11 and 26.x)
Rules and curves are core `PlayerFx` (tested in `ModuleTests.playerFx`); the adapter classes are `AurorasHands`, `AurorasStream`, `AurorasSpirit` and `AurorasSkin`. All of it is drawn on your screen only; none of it changes what the server or other players see. Compiled in CI for every target, never run in game yet.

| Module | Hook |
|---|---|
| Swing Animation | `versions/<t>/mixin/HandRendererMixin` changes the swing progress argument and wraps the held-item submit (push pose, offsets, pop); `LivingEntityMixin` changes `getCurrentSwingDuration` for your own player; inspect ends on a swing seen in that same swing argument; the "no cooldown dip" option redirects `getItemSwapScale` in `ItemInHandRenderer#tick` (not on 26.3, whose hand renderer was rewritten) |
| Weapon Inspect | Key `key.auroras.inspect` (default I). The inspect pose is added in the same item-submit wrap. Blade skins mark the item with an identity-unique tint array (`ItemLayerMixin`) and `ItemTintMixin` colours its quads at `getLayerColorSafe` |
| Hand Aura | The item-submit wrap submits extra scaled shells marked with the aura tint; `ItemTintMixin` makes them translucent (1.21.11: the submit's RenderType; 26.x: the buffer chosen in `ItemFeatureRenderer`). `HandAuraMixin` adds translucent emissive arm shells after `AvatarRenderer#renderHand` (`platform/HandDraw`) |
| Totem Spirit | `ClientPacketListenerMixin` sees entity event 35; `AurorasSpirit` spawns ordinary depth-tested world particles, so walls hide them |
| Name Protect | `FontMixin` swaps names for aliases in `prepareText` and `width` (String and FormattedCharSequence), so chat, tab list, name tags and scoreboard read the alias. Commands you type are sent as typed |
| Stream Hide Inventory | Key `key.auroras.streamhide`. Platform's hotbar element wrapper covers filled slots; `ContainerScreenMixin` skips drawing your own inventory's items and their tooltips; the hand renderer can skip the held item. The item on the cursor is not hidden |
| Skin Changer | The launcher's Skins page writes `config/auroras/skin.png` (a picked PNG, or a username's skin looked up through the launcher's existing Mojang lookup). `AbstractClientPlayerMixin` returns a copy of your own `PlayerSkin` with that texture and the arm model you chose. 64x32 skins are converted like vanilla does. The mod never goes online |

### Rendering modules (mojmap only, 1.21.11 and 26.x)
Maths (glide and fade, grading, blur weight, warning pulse, glint pattern, local clock) is core `RenderFx` (tested in `ModuleTests.renderFx`); the adapter class is `AurorasRender`. Everything is local and only changes what you see. Compiled in CI for every target, never run in game yet.

| Module | Hook |
|---|---|
| Block Overlay | `BlockOutlineMixin` changes the colour, width and pose (glide) passed to `renderHitOutline` / `submitHitOutline`; `versions/<t>/mixin/BlockOverlayMixin` keeps the last outline while it fades out and draws the fill (`RenderTypes.debugFilledBox`) in `renderBlockOutline` (1.21.11, 26.1) or `submitBlockOutline` (26.2, 26.3) |
| Color Grading, Motion Blur | Our post effects `assets/auroras_client/post_effect/{color_grade,motion_blur}.json` with shaders in `versions/<t>/resources` (26.3 needs its own GLSL header), run by `RenderFxGameRendererMixin` before `FogRenderer#endFrame` (after vanilla's post effect, before the HUD). Values come from 2x1 parameter textures, so changes apply at once. A chain that fails to load turns only that module off |
| Custom FOV | `RenderFxGameRendererMixin` (`getFov`, 1.21.11), `RenderFxCameraMixin` (`calculateFov`, 26.x); dynamic FOV via `FovEffectMixin` (`AbstractClientPlayer#getFieldOfViewModifier`'s effect scale) |
| Custom Enchant Glint | Our own 64x64 glint texture registered at Minecraft's two glint ids (released when off); speed and scale in `GlintMixin` (`TextureTransform#setupGlintTexturing`) |
| Low Health Warning | Drawn by `AurorasRender.hud` under the Auroras HUD (edge mask texture, tinted) |
| Time Changer | gui-v1 `TimeMixin`/`TimeTickMixin` (`ClientLevelData#getDayTime`, but not inside `tickTime`); gui-v2 `TimeMixin` (`ClientClockManager#getTotalTicks`, 26.1/26.2) and `TimeClockMixin` (`ClientClockInstance#totalTicks`, 26.3) |
| No Render | `NoRenderMixin` (fire, water, totem in `ScreenEffectRenderer`), `NoRenderWeatherMixin`, `NoRenderParticleMixin` (explosions), hurt shake (`bobHurt`), `NoRenderGuiMixin` (pumpkin and frost overlays, vignette, portal; on `Gui` or 26.2+ `Hud`). Low Fire still lowers the fire when No Render's fire toggle is off |

## Minecraft 1.21.11 and later (adapters/mojmap)
- **One source, four builds.** `common/` is written once against Mojang's official names, which Fabric uses for 1.21.11 (remapped) and 26.x (the game ships unobfuscated). The part that really differs between them is small and lives in `gui-v1/` (1.21.11: `GuiGraphics`, GLFW key codes) and `gui-v2/` (26.x: `GuiGraphicsExtractor`, SDL key codes): drawing (`Gfx`), the screen base class (`AScreen`), key mappings and the HUD layer (`Platform`). Settings files keep GLFW key codes; `Keys` converts through Minecraft's own key constants.
- **Build one target:** `cd adapters/mojmap && gradle build -Ptarget=26.3` (needs JDK 25 and Gradle 9.7+). Targets: `1.21.11`, `26.1`, `26.2`, `26.3`. Fabric loader, Loom and Fabric API versions come from Fabric's example mod for each version. A 26.x jar loads on every hotfix of its line (`~26.3`).
- **The HUD** goes through Fabric's HUD element registry: the Auroras layer sits just below chat, and the vanilla crosshair and boss bar are wrapped (not patched) for Crosshair Customizer and Boss Bar.
- **Every mixin is optional** (`defaultRequire: 0`). If a method name differs in some version, that one feature stays off and the game still starts; look for Mixin warnings mentioning Auroras in `logs/latest.log`.
- **Custom Skies** (`AurorasSky`, `mixin/LevelRendererSkyMixin`, `mixin/SkyRendererMixin`). Fabric has no sky hook for these versions, so the mixin runs at the start and end of Minecraft's sky pass (the lambda `LevelRenderer#addSkyPass` gives the frame graph: `method_62215` on 1.21.11, `lambda$addSkyPass$0` on 26.x, the names Iris uses for it). Core `SkyMesh` builds the frame from the same `Sky` / `SkyFx` maths as the launcher preview (dome, ground, nebula, constellations, stars, shooting stars, layered aurora, clouds, petals) as position-color quads, all wound to face the camera and layered at fixed distances, so culling and sorting can't change the result (tested in `VisualTests`; about 0.6 to 0.8 ms per High-quality night frame (about 9,000 to 10,000 quads) on the build machine, no allocation). The mesh is split into blend runs: glowing layers (sun and moon glow, sunset bloom, nebula, stars, aurora) are additive, the rest normal blend. `Platform.skyQuads` hands them to `versions/<target>/platform/SkyDraw`: on 1.21.11 and 26.1 through its own immediate buffer source, normal runs with `RenderTypes.debugFilledBox()` and additive runs with `RenderTypes.dragonRays()` (BlendFunction.LIGHTNING, main target); on 26.2 and 26.3, where `MultiBufferSource` is gone, through its own GPU vertex buffer and render passes the way vanilla draws its stars, with `RenderPipelines.DEBUG_QUADS` and `RenderPipelines.LIGHTNING`. Additive vertices are drawn at a tenth of their distance (same place on screen) so that pipeline's fog can't tint them. Depth is cleared afterwards (nothing else has been drawn yet, so distant terrain still shows; 26.2+ uses reverse Z, hence `RenderSystem.DEFAULT_DEPTH_CLEAR_VALUE`). `SkyRendererMixin` then skips the vanilla sky disc, sunrise glow, stars, dark disc and End sky for that frame, only if ours really drew; Minecraft's sun and moon stay on top. Switching the module on or off applies at once. All four targets compile this in CI (mod-check); none of it has run in game yet. Limits: Nether themes do nothing (vanilla has no sky pass in the Nether), fog isn't applied to the themed sky, and none of it has run in a real game.
- **Custom Capes** (`AurorasCape`, `mixin/AbstractClientPlayerMixin`). **Only you see your cape**: nothing is sent to the server and other players are untouched. Since 1.21.9 a skin is a `PlayerSkin` record (`body`, `cape`, `elytra` as `ClientAsset.Texture`); the mixin wraps `AbstractClientPlayer#getSkin` and, for your own player only, returns a copy whose cape is `config/auroras/cape.png` registered as a `DynamicTexture`. HD capes (64x32 times 2, 4 or 8) are used at their own resolution; old 22x17 capes are padded to 64x32 (core `Cosmetics.legacyCape`). The file is checked at most once a second and re-read when its time or size changes, and switching the module off or deleting the file drops the texture at once (core `Cosmetics.CapeWatch`, tested in `VisualTests`). Elytra without their own texture use the cape, as in vanilla. Unverified until the first build: the `PlayerSkin` / `ClientAsset.ResourceTexture` names and packages (`net.minecraft.world.entity.player`, `net.minecraft.core`).
- **Locked modules:** Low Fire is 1.21.11 only for now (`Platform.NOT_PORTED`); Custom Skies is locked only if its themes can't be loaded or the renderer calls are missing (core `Registry.restrict`).
- **Compiled against the real game, not yet run in it.** Since 2026-10-19 all four targets build in CI (`.github/workflows/mod-check.yml` on the `mod-fix` branch, same steps as the release job). The few names that change between releases live in `versions/<target>/`: `platform/Mc` (open screen: `Minecraft#screen` up to 26.1, `Gui#screen()` from 26.2; chat line: `addMessage` on 1.21.11, `addClientSystemMessage` on 26.x; F1: `Options#hideGui` up to 26.1, `Gui#hud.isHidden()` from 26.2; keyboard key type `KEYSYM`, `KEYBOARD` on 26.3) and the sky-pass mixin (static lambda up to 26.1, instance lambda from 26.2). The build doesn't check mixin targets, so they were checked by hand against `javap -p -c` of each jar (the workflow prints any classes listed in `ci/javap-classes.txt` and `ci/javap-code.txt`): zoom uses `GameRenderer#getFov` on 1.21.11 and `Camera#calculateFov` on 26.x, freelook `Camera#setup` / `Camera#alignWithEntity`, the totem hook `GameRenderer#displayItemActivation` (`LocalPlayer#displayItemActivation` on 26.3). Known runtime limits found that way: on 26.2 and 26.3 `MultiBufferSource` no longer exists, so Custom Skies draws there through render passes (`SkyDraw`, 26.3's GPU classes are in `com.mojang.renderpearl.api`); Low Fire stays 1.21.11 only (26.1's `renderFire` matches 1.21.11's bytecode, so it could be enabled there; 26.2+ draws fire through `submitFire`/`buildFireQuad`).

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
- Core tests: `cd core && java Build.java`, then `java -cp out gg.auroras.core.<Suite> ../../visuals` for `Tests`, `PerfTests`, `VisualTests`, `HudTests`, `EmoteTests`, `UiTests`, `ModuleTests` and `RadialTests`.
- Core microbenchmarks: `java -cp out gg.auroras.core.Bench` (machine-level numbers, not in-game ones).
- Adapter: install a JDK 21, then `cd adapters/fabric-1.21.4 && gradle build`. **This has never been run.** Expect small API fixes on the first build.
- Syntax check without Minecraft jars: `java ParseCheck.java adapters/fabric-1.21.4/src`
