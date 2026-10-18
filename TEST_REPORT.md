# Auroras Client: test report (Stage 4, the quality pass, version support from 1.21 on, and the remaining modules)

Date: 2026-10-18. Every suite was rerun after the version-support and module work the same day. See QUALITY_REVIEW.md for the design review. Environment: Linux sandbox, Node 22, Java 21 (JRE with compiler module), headless Chromium via Playwright.
Network: Mojang, Fabric, NeoForge, Forge, Modrinth, Spotify, Gradle and Maven were all unreachable from this environment. No Minecraft, no Electron binary, no Fabric toolchain. **Nothing in this report ran inside Minecraft.** Every number below comes from a command that was actually run for this report.

## Results
| Suite | Command | Result |
|---|---|---|
| Java core logic (registry, settings, profiles, migration) | `java -cp out gg.auroras.core.Tests ../../visuals` | 91 passed, 0 failed |
| Java modules (direction, information readouts, frame graph, session, toggles, zoom scroll, freelook, perspective, crosshair, particles, fullbright, hit color, boss bar, totem effects, menu speed) | `java -cp out gg.auroras.core.ModuleTests ../../visuals` | 46 passed, 0 failed |
| Java radial menu and Auroras font (layout on 9 screen sizes, anti-aliased art, hit testing, open/hover/press/close animation, sections, client settings page, font atlas) | `java -cp out gg.auroras.core.RadialTests ../../visuals` | 30 passed, 0 failed |
| Java versions, adapters, performance and allocation | `java -cp out gg.auroras.core.PerfTests ../../visuals` | 21 passed, 0 failed |
| Java visuals (sky, animated sky effects, particles, cosmetics, golden files) | `java -cp out gg.auroras.core.VisualTests ../../visuals` | 65 passed, 0 failed |
| Java HUD (placement, snapping, styles, formatters, animations, layouts, now playing) | `java -cp out gg.auroras.core.HudTests ../../visuals` | 44 passed, 0 failed |
| Java emotes (format, validation, sampling, controller, wheel, custom files) | `java -cp out gg.auroras.core.EmoteTests ../../visuals` | 30 passed, 0 failed |
| Java UI (design tokens and contrast, UI kit maths, in-game module menu model) | `java -cp out gg.auroras.core.UiTests ../../visuals` | 38 passed, 0 failed |
| Node (updater, versions incl. filters and stable/snapshot rules, launch plan, installer incl. retries, launch incl. offline, Java checks, snapshots and quick-play Join, visuals parity, mod settings incl. the in-game cape file, jars, compatibility, HUD incl. Spotify card, Spotify incl. cover art, sky effects, emotes, server status) | `npm test` | 116 passed, 0 failed, 0 skipped |
| Launcher interface (headless Chromium, mocked desktop bridge), incl. the quality checks, version filters and changing an instance's version, Cape Studio > Use in game | `npm run test:ui` | 126 passed, 0 failed |
| Fabric adapter for 1.21.11 and 26.x | `java ParseCheck.java adapters/mojmap`, plus a compile against stand-in Minecraft classes (both GUI variants) | syntax: 32 files, 0 problems (2026-10-18 widget pass: syntax only; the stand-in classes aren't in the repository, so the stand-in compile wasn't re-run) |
| Fabric adapter for 1.21.4 (older) | `java ParseCheck.java adapters/fabric-1.21.4/src` | syntax only: 26 files, 0 problems |

## Widget and module polish (2026-10-18, later)
- **Keystrokes rebuilt:** layout, labels and press fade are core `Keystrokes` (tested, mirrored in the launcher and golden-checked). New settings: key size, key gap, labels from your own key binds (or W A S D, or arrows), slim or full space bar, sneak and sprint keys, CPS under the mouse buttons, release fade time, pressed opacity and pressed text colour. Long labels shrink to fit their key.
- **Every HUD element** gained a background colour, a corner radius (rounded boxes drawn as the same rectangles in game and in the launcher, tested pixel by pixel) and a text colour mode: solid, chroma (flowing rainbow) or gradient (text colour to accent). Reduced motion holds chroma still. These settings are saved in HUD layouts.
- **Modules:** zoom now eases every frame instead of 20 times a second, and changing zoom settings mid-zoom no longer jumps; the dynamic crosshair's spread is smoothed; key binds changed in Auroras settings (zoom, sprint, sneak, freelook, front view, menu key, emote wheel) apply at once instead of after a restart; HUD elements read their settings from a per-element cache instead of building strings every frame; setting labels no longer rebuild a table on every call.
- **Not verified:** none of this has run inside Minecraft yet. The in-game drawing compiles only as far as a syntax check; the first real `gradle build` per target is still the next step.

## Launcher backgrounds (2026-10-18, later)
- Rebuilt Aurora Borealis (glowing per-pixel curtains with a bright lower edge and drifting rays instead of striped columns, plus a lake that mirrors them), Cosmic Nebula (baked gas clouds that drift and breathe, haloed stars, shooting stars), Midnight Rain (towers with lit windows on a grid, rooftop lights, haze, rain in two depths, a mirrored wet street, distant lightning), Floating Islands (layered blocks, trees, a waterfall, a sea) and Minimal (soft drifting lights).
- Every scene now renders at the screen's pixel density (up to 1.5x) instead of 0.7x, runs up to 60 fps instead of 30, and gets fine grain (hides gradient banding) and a soft vignette. Switching scenes cross-fades. Performance mode still renders at half size and 30 fps.
- Measured in headless Chromium with software rendering at 1920x1080 (not a real GPU): 1.4 to 5 ms per frame at 1x, 2.7 to 8.3 ms at 2x.
- The home page's welcome text sits on a glass pill so it stays readable on bright scenes; panels have a soft top highlight and shadow.

## Version support from 1.21 on (this round)
- **Discovery:** the list comes only from Mojang's `version_manifest_v2.json`; no version is hard-coded. Tested with fixture manifests shaped like Mojang's (Mojang was unreachable here), including 1.21 to 1.21.x hotfixes, year-based 26.x releases, pre-releases, release candidates, week-style and year-style snapshots, an April Fools build, and a snapshot-typed entry whose id looks like a release (it stays a snapshot).
- **Filters** (`test/versions.test.js`, `test/ui/versions.test.js`): Latest releases returns the newest patch of each release line; All releases lists every stable release from 1.21 on; Snapshots and pre-releases lists only development builds. Stable means Mojang's type is `release`, nothing else.
- **Launch** (`test/launcher.test.js`, `test/installer.test.js`): a snapshot instance downloads and launches through the same pipeline; the version's own `javaVersion` picks the Mojang runtime; a custom Java older than the version needs is refused with both versions named; with the network gone, an installed version launches from the saved metadata and says so; with nothing saved, the error says to connect once; a failing download is retried three times and the final error names the file and host; checksum and size mismatches are still refused.
- **Changing an instance's version** keeps its folder, mods and settings, and warns about mods and downgrading worlds.
- **Not tested here:** the real manifest, real downloads and real Microsoft sign-in (no network). Sign-in is unchanged and uses Microsoft's own device-code flow.

## Auroras mod for Minecraft 1.21.11 and later
- **New adapter** `client-mod/adapters/mojmap`: one source in Mojang's names for 1.21.11, 26.1, 26.2 and 26.3, built per target. Fabric loader, Loom and Fabric API versions were read from Fabric's own example mod branches for each version.
- **Checked:** class names, packages and many method names against Fabric API's own sources for 1.21.11 and 26.3. Those sources showed that 26.x renamed GUI drawing (`GuiGraphicsExtractor`, `Hud`) and moved keys to SDL codes, which the gui-v2 layer handles. The whole adapter compiles against stand-in classes that mirror these assumptions, for both GUI variants, so its own parts fit together.
- **Core:** adapters for each version (PerfTests). Locking unported modules keeps their settings (ModuleTests). The launcher installs the 26.x line jar on hotfixes such as 26.3.1 (`test/clientmod.test.js`). The compatibility matrix shows 1.21.11 and 26.1 to 26.3 as Experimental, except custom skies.
- **Not verified:** nothing has been compiled against the real Minecraft or Fabric jars (their servers can't be reached from here), and nothing has run in a game. The release workflow's first run is the first real compile. Every mixin is optional, so a wrong name turns off that one feature instead of crashing the game.

## Ready-made downloads (GitHub releases)
- `clientmod.js` (`test/clientmod.test.js`, 6 tests): installs the Auroras mod for a supported Fabric instance and leaves it alone while it's current. It updates when a new release appears and repairs a changed jar. A download that doesn't match `SHA256SUMS.txt` is refused, and the old jar stays. A copy it installed is removed when the instance moves to a version without a build (Fabric would refuse to start), but a jar you added yourself is left alone. Offline, it keeps the installed copy. Vanilla instances never get it. Release lookups are cached for 10 minutes. Launcher versions are compared by number.
- `scripts/ci-release.js` was run on a copy: it stamps the version, the repository and the Azure app ID, and refuses a malformed ID.
- **Not run:** `.github/workflows/release.yml` itself. It only runs on GitHub, and it has never run. The first run will show whether Electron 39 / electron-builder 26 install, whether the installer builds, and whether the mod compiles.

## Fixes after the first run on Windows
- **Emote keyframe sliders** now use the shared slider (the track fill follows the thumb, a typed value is clamped to the range). Dragging pauses playback and moves the preview to the keyframe being edited, so the model shows the pose you're changing. A whole drag is one undo step, and a keyframe's time is clamped to the emote's length and can't land on another keyframe. Tested with real mouse drags.
- **Cape preview walking and sneaking** use Minecraft's own movement numbers: walking speed, how the stride and cape flap build up, and the limb swing rhythm. Before, the cape flapped about eight times too far and three times too fast. Rendering now blends between game ticks, so it no longer judders at 20 updates a second. Sneaking uses Minecraft's crouch pose (body tilted 0.5 rad, head 6.2 px lower, legs back) and eases in, and the cape follows the body. The Stride slider is now **Speed**, labelled Standing / Slow walk / Walking / Sprinting.
- **Microsoft sign-in without an app ID** shows the setup steps and a field for the ID in the Add account window, instead of printing an error in the terminal.
- **Typed slider values** with a 0.05 step now show two decimals. They were rounded to one before.

## Remaining modules (this round)
- **Now with in-game code:** Zoom, Toggle Sprint, Toggle Sneak, Freelook, Perspective Controls, Crosshair Customizer, Hit Color, Low Fire, Particle Settings, Fullbright, Boss Bar, Direction, Freelook Status, Session Statistics, Server Information, FPS and Frame Time, Memory Usage, Biome Display, Auroras Logo, Custom Capes (your own player only), Player Glow (your own player only), Totem Effects (particles and flash), Menu Animations. All are labelled experimental, because none has run in a game.
- **Tested:** their rules, in `ModuleTests` (43 checks): headings and compass strip, readouts that leave out what the game didn't report, frame graph scaling, colors and zero allocation, session counting (teleports and repeated death ticks ignored), toggles, zoom scroll limits and exact FOV restore, freelook hold and toggle with pitch clamping, perspective cycling, crosshair shapes and outline, the particle share kept exactly, the hit color matching vanilla's `0xB2FF0000` at 70%, totem particle counts across frame sizes, and the overlay fade. The information modules can be placed in the HUD editor like HUD elements, and layout files hold them (HudTests and the golden parity).
- **Cape file** (`test/modconfig.test.js`, `test/ui/studios.test.js`): only real PNGs in Minecraft's cape sizes are written, atomically; a refused file leaves the previous cape; Use in game and Stop showing in game write and remove it and switch the module.
- **Not built (can't be switched on):** Damage Indicator, Cosmetic Aura, Nameplate Styling, Model Emblem, Cosmetic Trails, Particle System.
- **Not verified:** every mixin target and method name was written from Yarn 1.21.4 names without the jars. The mixin config requires every injection to apply, so a wrong name stops the game at start-up with a clear Mixin error naming it, rather than failing silently.

## What the quality pass added
- **Quality checks** (`test/ui/quality.test.js`, 15 tests):
  - Every page at 960x640, 1280x800, 1920x1080 and 2560x1080: no sideways scrolling, no text cut off without an ellipsis, nothing outside the window.
  - Tab order with visible focus rings.
  - WCAG AA contrast in all seven themes. This caught the Light theme's primary button at 4.26:1; its accent was darkened to fix it.
  - Reduced motion stops transitions and previews.
  - No emoji used as icons.
  - Long names don't overflow.
  - No invented identity, news or status.
  - Live server status: online, offline, bad address.
  - Account manager: states, switching, removal.
  - Skin upload through the bridge.
  - Previews stop drawing after their page closes.
- **Design tokens** (`UiTests`): the in-game GUI parses the same `design-tokens.json` the launcher's CSS is generated from. Contrast ratios, the spacing scale, motion timing and easing are checked.
- **In-game module menu** (`UiTests`): the layout and editing rules are tested.
  - The panel stays on screen from 320x240 to 960x540 GUI pixels, cards stay inside the body, and search doesn't overlap the HUD editor button.
  - Filtering, scrolling limits, and toggling are tested; unavailable modules refuse to switch on and say why.
  - Slider drag and keyboard nudges, option cycling, color steps, reset to default and focus order are tested.
- **Server status** (`test/serverping.test.js`): the Minecraft server list ping client against a local stand-in server.
  - Reads version, players, MOTD (formatting codes stripped), icon (only real PNG data URLs) and latency.
  - Gives clear errors for refused, silent, closed and garbled servers.
  - Does the SRV lookup, and refuses junk addresses.
- **Join** (`test/launcher.test.js`): a launch with a server adds Minecraft's own `--quickPlayMultiplayer` argument, and only when asked.
- **Spotify cover art and card** (`test/spotify.test.js`, `test/hud.test.js`):
  - The smallest cover of at least 64 px is picked, from Spotify's image host only. The image address never reaches the mod's file, and the game's reader sees the art flag.
  - The card layout, marquee and progress maths match between Java and JavaScript (58 new golden cases).

## What the Stage 4 tests cover
- **Same maths in game and launcher.** The Java core writes golden files that the launcher's `visuals.js` must reproduce exactly: `hud-golden.json` (309 HUD cases: anchors, snapping, scale from drag, styles, every formatter, module list order), `sky-golden.json` now including the animated effects (hash, shooting-star schedule over 90 s, petals, clouds, nebula, layered aurora, constellations, quality budgets, per-theme effect data), and `emote-golden.json` (every easing curve, all 14 built-in emotes at 7 moments, a scripted controller session with cross-fade, cancel and finish, wheel slots, 16 validation verdicts). Float32 positions match bit for bit; doubles within 1e-9.
- **Files written by the launcher are read by the game's own loader** (run as a separate Java process in the tests): settings and profiles, HUD layout presets, the Spotify now-playing file, and now custom emotes and the emote wheel.
- **HUD editor:** placement uses the game's anchor rules at 1920x1080 / Auto GUI scale; dragging re-anchors and snaps to the centre line; Alt turns snapping off; the corner handle changes scale; arrow keys nudge (Shift = 10 px); reset restores defaults; elements stay on screen at 1024x768, 1366x768 and 3440x1440 at GUI scales Auto and 4; presets save, load and delete; a layout file containing a non-HUD setting is refused; Save writes only changed keys; Cancel writes nothing. Found and fixed: dialogs opened from the editor appeared behind it, and alignment guides didn't show when an element was already exactly aligned.
- **Animated skies:** each theme draws its own effects (Sakura petals and clouds, Cosmic nebula, Aurora layered at High and none at Low, Celestial constellation lines), checked by reading preview pixels; the preview moves with animation on and is frozen with animation off or speed 0; shooting stars average the configured rate over an hour (4/min setting measured 4 ± 0.6); petals stay between zenith and just below the horizon; nebula holds still at drift 0; layer 0 at wave 1 equals the old aurora curve; the new settings save.
- **Emotes:** library search, category, favorites and recent; choosing an emote runs the shared controller and poses the model; Stop fades back to exactly the neutral pose; thumbnails draw and animate; wheel slots assign and empty through the desktop bridge; the creator adds keyframes from the timeline, edits pitch and easing, selects and deletes keyframes, undo and redo; invalid ids and built-in ids are refused with a reason; save, export, import (a broken file is refused naming the bad body part) and "Edit a copy". In core: cross-fades keep total weight at 1 (fixed during this stage: the first version dipped toward the normal pose mid-fade), one-shots finish on time, speed and blend limits, more than 64 keyframes per part refused, bad custom files skipped with a reason.
- **Versions and compatibility:** pre-releases, release candidates and snapshots are classified and filtered by type; a development build warns that the Auroras mod stays off and lists every feature as Unsupported; the matrix in Settings lists every version with honest states and never shows "Tested".
- **Allocation:** HUD placement, sky effects at High quality and the emote controller (playing, switching and sampling) allocate nothing per frame (measured with the JVM's per-thread allocation counter over 20,000 to 200,000 frames).

## Bugs found and fixed this stage
1. **Instance creation broke after adding the Emotes page:** the emote creator's `drawCreator` function had the same name as the instance-creation dialog's and replaced it, so the New instance dialog stopped working. Caught by the full interface suite; renamed.
2. **HUD editor dialogs hidden:** the Save preset and Delete dialogs opened behind the editor overlay and couldn't be clicked.
3. **Alignment guides:** they only showed while an element was being moved onto a line, not when it already sat exactly on it.
4. **Emote cross-fades dipped:** switching emotes briefly mixed in the normal pose (total weight 0.75 mid-fade). Fixed in both the Java core and the launcher twin; the golden file pins the corrected behaviour.
5. **Theme data:** a script inserting the new per-theme effect data put Sunset's into the Aurora theme (it matched Aurora's "sunset" color key). The Java loader refused the file as a duplicate key, which is how it was found.

## Performance (this machine, not in-game)
| What | Cost |
|---|---|
| Animated sky effect maths per frame: Low / Balanced / High | 0.003 ms / 0.03 ms / 0.07 ms, 0 bytes |
| Emote controller update + sample per frame | 0.0003 ms, 0 bytes |
| FPS and CPS counters, cached HUD text, frame stats and HUD placement | under 20 KB allocated over 1,000,000 iterations (effectively none per frame) |
| Launcher sky preview 760x380: Aurora night at High / Low, Sakura day, Cosmic night at High | 8 ms / 0.5 ms / 2.5 ms / 2.5 to 3 ms (headless Chromium, two runs) |
| Launcher emote preview 588x398 with your skin, and all 14 animated thumbnails | 4 to 7.5 ms, and about 1 ms per thumbnail refresh (12 per second) |

The launcher previews run at up to 30 fps (sky) and 60 fps (emotes), drop to about 10 fps when the window is unfocused, and stop while hidden or while Minecraft runs. **In-game frame rates were not measured, because the game couldn't run here.** Use the in-game 60-second benchmark (see `client-mod/README.md`) with the modules on and off.

## Compatibility matrix
`COMPATIBILITY.md` was generated by `node scripts/compat-matrix.js test/fixtures/sample-manifest.json`. That manifest is a hand-written sample in Mojang's format, because Mojang's servers were unreachable; the file says so at the top. Run `node scripts/compat-matrix.js` with network access to regenerate it from the official list. Current honest state: 1.21.4 on Fabric is **Experimental** for every feature (code exists, never built); every other version is **Unsupported**; nothing is **Tested** because `validated.json` is empty.

## Could not run (unverified)
- **The redesigned in-game GUI** (module menu, HUD editor toolbar, emote wheel, Spotify card): never compiled or seen. Layout rules are unit-tested; the drawing code is syntax-checked only.
- **Skin upload, server status and cover downloads against the real services:** tested with stand-ins (a local server that speaks the ping protocol, a mocked bridge), not against Mojang, real servers or Spotify.
- **All in-game code:** the HUD renderer and editor, animated skies, emote playback, the emote wheel, the player model mixin and the eleven new module mixins (plus the extended mouse mixin) have never been compiled or run. Expect small API fixes on the first build. The emote mixin assumes `PlayerEntityRenderState` exposes an entity `id` in 1.21.4 mappings.
- **Spotify:** the sign-in and polling code is tested against recorded response shapes, not the real Spotify API.
- **Emotes for other players:** not possible without a sync server; the app says emotes are local only everywhere they appear.
- **Real Minecraft versions list:** the version classification is tested against sample data shaped like Mojang's manifest.
- **Unverified from earlier stages:** real servers, Electron on Windows, the installer, Microsoft sign-in, real three.js.

## Known limitations
- Emote root motion is height only (no whole-body spin), so emotes stay within what a model-part mixin can do cleanly.
- The sky preview doesn't simulate Minecraft's fog, weather or lighting, and says so.
- Switching Custom Skies on or off needs a game restart (Fabric's sky hook can't be removed at runtime). Launcher changes to settings apply the next time the game starts.
- Favorites, recent emotes and module favorites are stored in the launcher on this computer; custom emotes, the wheel and HUD layouts are stored in the instance, where the game reads them.
