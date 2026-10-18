# Auroras Client — notes for Claude Code

Premium Minecraft launcher (Electron) plus a Fabric client mod. Read README.md, client-mod/README.md and TEST_REPORT.md first.

## Layout
- Launcher: `main.js` (Electron main, IPC, downloads), `preload.js`, `renderer-src/` (UI sources) built into `renderer/index.html` by `python scripts/build-renderer.py`. Pure logic modules: `versions.js`, `launcher.js`, `installer.js`, `clientmod.js`, `modconfig.js`, `msauth.js`, `spotify.js`, `serverping.js`.
- Mod: `client-mod/core` (plain Java, no Minecraft classes, fully unit-tested) and adapters:
  - `client-mod/adapters/mojmap` — Minecraft 1.21.11 and 26.1/26.2/26.3, Mojang names. `common/` shared, `gui-v1/` (1.21.11: GuiGraphics, GLFW keys), `gui-v2/` (26.x: GuiGraphicsExtractor, SDL keys). Build one target: `cd client-mod/adapters/mojmap && gradle build -Ptarget=26.3` (JDK 25, Gradle 9.7+).
  - `client-mod/adapters/fabric-1.21.4` — older Yarn adapter, not built in CI.
- `visuals/` shared data (themes, emotes, design tokens, registry, golden files, font atlas, icons). Regenerate golden files after core changes: `cd client-mod/core && java Build.java && java -cp out gg.auroras.core.Golden ../../visuals`.
- `.github/workflows/release.yml` builds the Windows installer and one mod jar per target and publishes a GitHub release on every push to main.

## Tests (run all before calling something done)
- `npm test` and `npm run test:ui` (needs `npm install --no-save playwright` + `npx playwright install chromium`).
- Java: `cd client-mod/core && java Build.java`, then `java -cp out gg.auroras.core.<Suite> ../../visuals` for Tests, PerfTests, VisualTests, HudTests, EmoteTests, UiTests, ModuleTests, RadialTests.
- Never report a test as passing unless it was actually run.

## State when this was handed over (2026-10-18)
- **The mojmap adapter has never been compiled against the real game.** It compiles against stand-in classes only. The first real `gradle build` per target will show API name mismatches; fix them in `gui-v1/`/`gui-v2/` or `common/`. All mixins are optional (defaultRequire 0).
- **In progress: the radial Right Shift menu** (five glass sections HUD / Visuals / Design / Settings / Utility around the player's face and name, Auroras badge, logo top-left). Done: core `RadialMenu`, `Raster`, `TextKit` (+ `RadialTests`, 30 passing), Inter font atlas (`scripts/bake-font.py`, OFL), icons (`scripts/draw-icons.py`), adapter `RadialScreen`, `RadialArt`, `ui/AuroraFont`, `ModuleScreen.section/settings`, launcher sends the account's 8x8 face (`gameFace` in page.html → `modconfig.writeFace` → `config/auroras/face.png`). All launcher and Java suites pass as of hand-over (npm test 116, test:ui 126, Java 349); the menu has not run inside Minecraft yet. Preview the menu without Minecraft: `java -cp out gg.auroras.core.RadialPreview ../../visuals out.png 1920 1080`.
- Not ported on 1.21.11+: custom skies (no Fabric sky hook), capes (skin API changed in 1.21.9).
- Rules from the owner: real functionality only, honest testing, no other launchers' credentials or client IDs, never commit `update-private-key.pem`, emotes and capes are local-only and must say so, only safe open-source dependencies (GitHub Actions are pinned to commits).
