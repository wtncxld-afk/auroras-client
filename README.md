# Auroras Client (desktop launcher + client mod)

## Get the app (no building)
Download **AurorasClientSetup-<version>.exe** from this repository's **Releases** page and run it. That's all: the launcher downloads Minecraft, Java and, for Fabric instances on a supported version, the ready-made Auroras mod and Fabric API when you press Play. It keeps the mod up to date by itself, and Settings > Updates tells you when a new launcher is out.

## Publish it (once, for the owner of the copy)
1. Put this folder in a GitHub repository (GitHub Desktop: File > Add local repository, then Publish). Use the branch `main`.
2. Optional, so players can sign in without any setup: create your Azure app (see Microsoft sign-in setup below) and add its Application (client) ID as a repository **variable** named `AZURE_CLIENT_ID` (Settings > Secrets and variables > Actions > Variables).
3. Every push to `main` runs `.github/workflows/release.yml` on GitHub's computers: tests, the Windows installer, the Auroras mod jar, checksums, and a new release (version 0.1.<build number>). Nothing is built on your PC.
4. If the mod fails to build, the release still has the launcher, and the "mod" job's log in the Actions tab says why.

## Run from source instead (developers)
1. Install Node.js LTS from https://nodejs.org
2. Double-click `Run Auroras.bat` (first run installs dependencies), or run `npm install` then `npm start`.
3. Optional installer with desktop shortcut: `npm run dist` (output in `dist/`, untested).

## What is real in this version
- Home page with 3D skin stage, instance selector, account switcher, and a Play button wired to a real launch pipeline (below).
- Minecraft versions: every Java version from 1.21 onward, discovered from Mojang's official manifest (`piston-meta.mojang.com/mc/game/version_manifest_v2.json`). Nothing is hard-coded: new releases (including year-based ones such as 26.1), hotfixes and snapshots appear as soon as Mojang lists them, and the ↻ button refreshes the list. The version picker has three filters: **Latest releases** (the newest patch of each release line, e.g. 1.21.11 and 26.1.2), **All releases** from 1.21 on, and **Snapshots and pre-releases** (snapshots, pre-releases, release candidates and experimental builds, with type chips and a warning). Only versions Mojang marks as `release` count as stable; anything Mojang marks `snapshot` stays a development build even if its number looks like a release. Each version uses the Java runtime and launch arguments from its own Mojang version file. An existing instance can change version (Instances > Change version) and keeps its folder, mods, worlds and settings, with warnings when mods may not load or when moving a world to an older version.
- Offline and errors: the manifest, version files, asset index and Java runtime index are saved after the first download, so an installed version still launches without internet (the launcher says it is using the saved copy). Downloads are retried three times and every file is checked against Mojang's SHA-1 and size. A custom Java that is older than the version needs is refused with a message naming both versions. Fabric, NeoForge and Forge availability and loader versions come from their own official metadata. Each version is labelled Untested until it appears in `validated.json`.
- Instances keep their own Minecraft version, loader and loader version, Java setting, memory, launch arguments, and their own folder (mods, config, resource packs, saves, logs, HUD), side by side.
- Accounts: Microsoft device-code sign-in (needs your Azure app ID, below), or preview a skin by username (preview accounts cannot play).
- Home screen with a glass hero card (greeting, selected instance, Play, instance and account pickers) beside the 3D skin, stacking on narrow windows.
- Seven animated backgrounds (Sakura, Sakura Night, Aurora Borealis, Cosmic Nebula, Midnight Rain, Floating Islands, Minimal), drawn sharp at your screen's pixel density at up to 60 fps, with cross-fades between them; ambient audio (generated, off by default), cursor trails, all configurable and persistent.
- Mods: live Modrinth + CurseForge search and one-click installs with dependencies and checksum verification.
- Totem Creator (PNG and resource pack export), Skins preview, Modules list, themes.
- Signed-update checking (needs your update server and key pair, below).

## Visuals and cosmetics
- **Modules** lists every module from the game's own registry (`visuals/registry.json`, exported from the Java core), with search, categories, favorites and recently used. Each module shows whether it has in-game code and whether it is cosmetic only, shows information, or changes your controls. Modules without in-game code can't be switched on.
- Settings are saved per instance into `instances/<id>/config/auroras`, the same files the mod reads, after checking them with the game's rules. Profiles, per-server profiles and the Low / Balanced / High visual quality preset live there too.
- **Visual Studio** (sidebar: Cosmetics) previews the eight sky themes and the particle system with the same math the game uses: colors, star positions, twinkle and aurora curves are checked against values the Java side writes (`visuals/sky-golden.json`). Minecraft's fog and lighting are not simulated, and the preview says so.
- **Totem Studio**: pixel editor, 3D item preview built the way Minecraft builds item models, lighting presets, presets you can save, rename, duplicate, delete, import and export, a comparison with the vanilla totem read from your own downloaded game jar, an approximate activation animation, and PNG / resource-pack export.
- **Cape Studio**: your account's skin with a cape that moves using the same rules as the game, walk and sneak previews, generated, imported (64x32 and HD sizes, or the old 22x17) and exported designs, and favorites. Capes are local only: nobody else sees them.
- The built-in totem and cape designs are original pixel art. Nothing from Minecraft is bundled.
- Previews use a small canvas renderer (`visuals/preview3d.js`), so they work without WebGL.

## Stage 4: HUD, animated skies, emotes, all-version support
- **HUD editor** (Modules > HUD editor, and in game): drag elements, snap to the screen centre, edges and other elements (Alt places freely), resize with the corner handle, arrow keys nudge, per-element style (minimal / compact / expanded, colors, background, border, opacity), preview at common screen sizes and GUI scales, layout presets you can save, load, delete, import and export. The launcher and the in-game editor use the same placement maths (`Hud` / `HudKit` in core, checked against `visuals/hud-golden.json`).
- **HUD modules:** FPS, coordinates, keystrokes, CPS, ping, armor, potions, target, session info, Spotify now playing, Auroras branding, module list, clock. Spotify needs your own Spotify app client ID (Settings > Spotify); the launcher polls Spotify only while the game runs and passes the song to the mod through a small file.
- **Widget styling (every HUD element):** background colour and opacity, corner radius, border, shadow, accent, and text colour as solid, chroma (flowing rainbow) or gradient. **Keystrokes** also has key size, gap, labels from your own key binds, W A S D or arrows, a slim or full space bar, sneak and sprint keys, CPS under the mouse buttons, and the release fade, pressed opacity and pressed text colour.
- **Animated skies:** shooting stars, drifting nebula, clouds, falling petals, constellation lines and layered aurora, mixed per theme (Sakura has petals and clouds, Cosmic a moving nebula, Aurora three layers of aurora, Midnight and Celestial constellations). Settings for animation speed, effects opacity, shooting-star rate, nebula motion, aurora wave intensity, clouds, petals, constellations and a Low / Balanced / High sky quality. The Visual Studio preview runs the same formulas as the game (`SkyFx`), checked value by value.
- **Emotes** (sidebar: Emotes): 14 built-in emotes in four categories, search, favorites, recently played, animated thumbnails, a 3D preview with your skin, an 8-slot emote wheel, and a creator with a timeline, keyframes per body part, pitch / yaw / roll sliders, easing, duration, loop, play / pause, undo / redo, save, import and export (validated). In game: hold the wheel key (B by default), point, let go. **Emotes are local only: other players keep seeing you stand normally, because there's no emote sync between players.**
- **Compatibility matrix** (Settings > Compatibility, and `COMPATIBILITY.md`): every 1.21+ version with its type and a state per feature: Tested, Partially Supported, Experimental or Unsupported. States only go above Experimental when `validated.json` records a real in-game test.
- **Settings:** profiles moved to format 2 (old files are migrated on load); per-instance settings; profile and HUD layout import / export with strict validation.

## Player, rendering and information modules
All of these have in-game code in the 1.21.4 Fabric adapter (uncompiled, see below), with their rules in core `GameLogic` and `Calc` and tested in `ModuleTests`:
- **Player:** Zoom (hold key, smooth, lower mouse sensitivity, scroll to zoom further), Toggle Sprint and Toggle Sneak (they hold Minecraft's own keys, so the game's rules on hunger and sneaking still apply), Freelook (look around while you keep running; hold or toggle; some servers forbid it), Perspective Controls (a front-view key, and F5 can skip the front view).
- **Rendering:** Crosshair Customizer (cross, dot, circle or square, size, thickness, gap, color, opacity, outline, centre dot, widening while moving, hide in third person), Hit Color (after a restart), Low Fire, Particle Settings (amount kept, hide explosions, block breaking, rain splashes), Fullbright (your own brightness setting is untouched), Boss Bar (hide, move, scale).
- **Information on screen:** Direction (letters or a compass strip, degrees), Freelook Status, Session Statistics (play time, distance walked, blocks broken, deaths), Server Information, FPS and Frame Time with a graph, Memory Usage, Biome and dimension, and the Auroras logo. They are placed in the HUD editor like the HUD modules.
- **Cosmetics:** Custom Capes (Cape Studio > Use in game saves the design to the instance; **only you see it**, other players see your Minecraft cape or none), Player Glow (outlines only your own player in third person), Totem Effects (colored particles and a screen flash when your totem pops; scale and spin only affect the Totem Studio preview), Menu Animations (speed and reduced motion for the Auroras menus).
- **Minecraft versions for the Auroras mod:** 1.21.11 and every 26.1, 26.2 and 26.3 release (Fabric), from one Mojang-names adapter built per version by the release workflow. On those versions Custom Skies and Custom Capes aren't ported yet and show as locked. The older 1.21.4 adapter is still in the folder but no longer built. Other versions launch without the mod.
- Still not built: Damage Indicator, Cosmetic Aura, Nameplate Styling, Model Emblem, Cosmetic Trails and the Particle System. They are listed and can't be switched on.

## Quality pass (brief section 8)
See `QUALITY_REVIEW.md`.
- **One design system:** a single token file (`visuals/design-tokens.json`) feeds the launcher's CSS and the in-game GUI, with a shared set of controls and states.
- **Redesigned in-game menu:** the menu, HUD editor toolbar, emote wheel and Spotify card all use the shared tokens.
- **Home:** live server status with one-click Join (Minecraft's quick play), and real release notes instead of placeholder news.
- **Accounts:** an account manager in Settings, and skin upload to your Minecraft account.
- **Narrow windows:** the sidebar becomes an icon rail.
- **Tested:** layout, contrast, keyboard and reduced-motion checks.

## Launching
Play downloads exactly what the instance needs from Mojang (and Fabric for Fabric instances): the version file, client jar, libraries for your OS, game assets and, unless you set a custom path, Mojang's own Java runtime for that version. Every file is checked against its SHA-1 before it is saved; Fabric jars get their checksum from the `.sha1` file next to them on Fabric's Maven, and a jar without one is refused. Then it starts Java with the official arguments, tracks the process, and shows the last log lines if the game crashes on start. Shared files live in `%APPDATA%/auroras-client/game`, each instance's files in `%APPDATA%/auroras-client/instances/<id>`.

Supported: Vanilla and Fabric. NeoForge and Forge instances can be created but not launched yet (they need their installers run first), and Play says so. **This pipeline has been tested end to end against an imitation of Mojang's servers with a stand-in game, not against the real servers or real Minecraft.** See `TEST_REPORT.md`.

While the game runs, the launcher pauses its animated background and 3D preview; when its window is unfocused they drop to about 10 frames per second.

## What is NOT built yet
NeoForge and Forge launching, Auroras mod builds for versions other than 1.21.11 and 26.1 to 26.3 (other versions launch as plain Vanilla or Fabric without the Auroras mod), custom skies and capes on 1.21.11+, emote and cape sync between players, the six modules listed above as not built, launcher self-update. **None of the in-game code (HUD, skies, emotes, the modules above) has been compiled or run in Minecraft yet.** See `TEST_REPORT.md`.

## Microsoft sign-in setup
Players click **Add account > Sign in with Microsoft**. Microsoft's own sign-in page opens in a window (account picker, password, passkey and two-step checks are all Microsoft's), and the account is added when they finish, as in other launchers. The launcher never sees the password. It receives a one-time code at Microsoft's desktop redirect address, protected with PKCE and a state check, and the window uses a fresh, separate session that is wiped afterwards. "Use a code instead" keeps the old microsoft.com/link code as a fallback.

This needs one Azure app, set up once by whoever distributes the launcher:
1. Create an app registration at https://portal.azure.com for personal Microsoft accounts.
2. Under Authentication, add the platform "Mobile and desktop applications", tick `https://login.microsoftonline.com/common/oauth2/nativeclient`, and turn on "Allow public client flows".
3. Ask Mojang for Minecraft API access for the app (new apps must be approved; until then sign-in stops at the last step with a clear error).
4. Put the Application (client) ID in `auth.json` before you build or share the launcher. Then nobody using your copy sets anything up. A client ID isn't a secret. Anyone can also paste their own ID in Settings > Accounts, which takes priority.
Never use another launcher's client ID, and the launcher doesn't import sign-ins from other launchers (see below).

Refresh tokens are stored encrypted with the OS (Electron safeStorage) in your user data folder, never in this project.

**Why there's no "import from Modrinth":** Modrinth App's saved sign-in belongs to Modrinth's Azure app. Using it here would mean presenting this launcher as Modrinth to Microsoft and Mojang, which their terms don't allow and which the brief rules out ("don't bypass Microsoft authentication"). Signing in once through the window above takes about as long and gives this launcher its own sign-in.

## Updates
1. `node scripts/gen-update-keys.js` creates `update-public-key.pem` (commit it, it ships in the app) and `update-private-key.pem` (secret, git-ignored).
2. Host a `manifest.json` over https:
```json
{"schema":1,
 "launcher":{"stable":{"version":"0.2.0","url":"https://example.com/AurorasSetup-0.2.0.exe","sha256":"<hex>","notes":"..."},"preview":{}},
 "client":[{"version":"0.1.0","mc":"1.21.4","loader":"fabric","channel":"stable","url":"https://example.com/auroras-client-0.1.0.jar","sha256":"<hex>","notes":"..."}]}
```
3. `node scripts/sign-manifest.js manifest.json` writes `manifest.json.sig`. Upload both files.
4. Put the manifest URL in Settings > Updates. Client jars are installed only after the signature and SHA-256 verify; the old jar and config are backed up and restored on failure. Launcher updates are detected but installed manually for now.

## Client mod (client-mod/)
See `client-mod/README.md` for the core/adapter layout, how to add a Minecraft release, the in-game checklist and the benchmark.
- Compatibility matrix: adapters exist for Minecraft 1.21.11 and 26.1 to 26.3 (Fabric, one shared source) and the older 1.21.4; **none has been compiled against the real game or run yet**. The launcher can create and launch any 1.21+ release; the Auroras mod itself supports none yet in a verified way.

## Tests
- `npm test`: updater, version metadata, launch planning, verified installer, end-to-end launch (needs `java` on PATH for the launch cases; they are skipped otherwise).
- Building the launcher page: edit files in `renderer-src/` and `visuals/`, then run `python scripts/build-renderer.py`. It writes `renderer/index.html` (desktop) and `build/web-preview.html`.
- After changing sky, HUD or emote maths or modules in the Java core, run `java -cp out gg.auroras.core.Golden ../../visuals` from `client-mod/core` to refresh the golden files (`sky-golden.json`, `hud-golden.json`, `emote-golden.json`, `registry.json`, `adapters.json`); the tests fail until you do.
- Compatibility matrix: `node scripts/compat-matrix.js` downloads Mojang's version list and rewrites `COMPATIBILITY.md` and `visuals/compat.json`. The copy in this folder was generated from `test/fixtures/sample-manifest.json`, a hand-written sample, because the build machine had no network; it says so at the top.
- `npm run test:ui`: the launcher interface in headless Chromium against a mocked desktop bridge (one-time setup: `npm install --no-save playwright` then `npx playwright install chromium`).
- Java core: see `client-mod/README.md`.

## Before publishing on GitHub
Set `UA` in `main.js` to your repo URL or email (Modrinth asks for it). Never commit `update-private-key.pem` or a CurseForge key. Libraries: Electron (MIT), three.js (MIT), JSZip (MIT or GPLv3). Inter font loads from Google Fonts (SIL OFL). The logo is yours.
