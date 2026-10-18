# Auroras Client: quality review (design brief section 8)

Date: 2026-10-18. Reviewed with screenshots of the real launcher page (the same HTML the desktop app loads) in headless Chromium at 960x640, 1280x800, 1920x1080 and 2560x1080, plus automated checks in `test/ui/quality.test.js`. **The in-game screens were not seen**: Minecraft can't run in this environment, so the in-game GUI was reviewed by reading the code and by unit tests of its layout rules (`UiTests`), not by screenshots.

## Design system

One token file, `visuals/design-tokens.json`, defines colors, spacing (a 4-pixel scale), type sizes, radii, shadows, motion timing and easing, and control sizes.
- The launcher's CSS variables are generated from it at build time (`scripts/build-renderer.py`). Other themes override colors only.
- The in-game GUI reads the same file, bundled into the mod (`UiTokens` in core, `AUi` in the adapter).

Contrast is tested, not assumed:
- **Aurora Dark tokens** (in `UiTests`): body text 7:1 or better; secondary text, and text on the accent, 4.5:1 or better.
- **All seven themes** (in `quality.test.js`): body text, secondary text and primary buttons are 4.5:1 or better in every theme. This check caught the Light theme's primary button at 4.26:1, and its accent was darkened to fix it.

Shared components (launcher, `renderer-src/ui-kit.js` and the component CSS in `page.html`):
- **Controls:** buttons and icon buttons; switches; sliders with an editable number; segmented controls for up to 4 choices; dropdowns for longer lists; color pickers (swatch plus hex).
- **Help and navigation:** tooltips, search fields, tabs.
- **Overlays:** modals, confirmation dialogs, toasts.
- **Structure and states:** module headers, preview containers, collapsible setting sections, setting rows with per-row reset, and loading, empty, error, success and unavailable states.

The control for each setting comes from its type with the same rule in both places (`UiKit.controlFor` in Java, `ctrlHtml` in the launcher).

The in-game kit (`AUi`) reproduces the same language with pixel-based drawing: cut-corner panels, a switch, slider, segmented control, dropdown, swatch, button, tooltip, scrollbar, focus ring and one set of 8x8 icons. Minecraft has no CSS, so the shapes follow the same tokens rather than sharing code.

## What changed in this pass
| Area | Before | After |
|---|---|---|
| In-game module menu | A list of vanilla Minecraft buttons reading "Name: ON" | Designed panel: category rail with icons, search, module cards with switches, a settings page per module with the right control per setting, reset, scrolling, keyboard focus, open and content transitions, reduced motion. All layout and editing rules in core `ModuleMenu`, 25 checks in `UiTests` |
| In-game HUD editor and emote wheel | Vanilla buttons, hard-coded colors | Toolbar, hint and wheel drawn with the shared tokens; the editing state is labelled on screen |
| Spotify HUD | One text line | Card with cover art, title, artist and progress, in compact and expanded layouts. Long titles scroll or end in "…". Tracks fade in. A note glyph shows when there's no cover. The launcher now downloads the cover (Spotify's image host only), shrinks it to 64x64 PNG and hands it to the mod. The layout maths is shared and golden-tested |
| Home | Fake "news" items, a server card that promised status it never loaded, a stage that overlapped the welcome text, a bottom row that scrolled sideways on small windows | "What's new" lists this version's real changes. The server card shows live status through Minecraft's server list ping (player count, version, latency, MOTD, icon) with checking, offline and retry states. Join launches the instance straight into the server (Minecraft's quick play). Responsive cards, no overlap |
| Sidebar | Always showed "Player · Not signed in" | Shows the real selected account or "No account · Add account", and opens the account manager. Turns into an icon rail below 1100 px |
| Accounts | Only an Azure ID field | Account manager: face, name, type, whether the sign-in is still saved on this computer, an Active badge, Use, Refresh skin and Remove (with confirmation), plus empty and busy states |
| Skins | Said equipping a skin "is handled by the desktop app" (it wasn't) | "Use on my account" uploads the skin through Minecraft's official API, with a choice of arm style, a busy state and errors; preview-only and web views say why they can't |
| Friends | "Isn't built yet · This prototype covers…" debug text | Designed unavailable state that says what it needs; marked Unavailable in the sidebar |
| Visual Studio | Theme strip cut off at the window edge | Grid of large theme cards; the selected and hovered themes animate live; the theme change cross-fades; settings grouped into sections |
| Emotes | Buttons arranged in a circle | A real radial wheel matching the in-game layout, with keyboard support and a live preview in the centre |
| HUD editor (launcher) | Squeezed labels ("S…", "Background opa…"), unavailable elements wrapped onto two lines | Settings grouped into Content, Appearance and Size and stacked to fit the panel; unavailable elements dimmed with a lock and a tooltip; an "Editing layout" badge that hides in preview |
| Modules | "Profile" label crowding the heading | Labelled profile field; the header wraps cleanly |

## Review against the ten criteria
Pass means it was checked as described; "not verified" means it couldn't be checked here.

| Module | Consistency | Craft | Fits its feature | Works and saves | Sizes | Interaction | Performance | States | Accessibility | No placeholders |
|---|---|---|---|---|---|---|---|---|---|---|
| Home | Pass | Pass | Pass | Pass (server status tested against a stand-in server) | Pass (4 sizes) | Pass | Pass (stage pauses when hidden) | Pass | Pass | Pass |
| Accounts / Skins | Pass | Pass | Pass | Pass (with a mocked desktop bridge; real Mojang upload not verified) | Pass | Pass | Pass | Pass | Pass | Pass |
| Modules (launcher) | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| Visual Studio (skies) | Pass | Pass | Pass | Pass | Pass | Pass | Pass (8 ms Aurora at High; stops when closed) | Pass | Pass | Pass |
| Emotes | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass, and labelled local-only |
| HUD editor (launcher) | Pass | Pass | Pass | Pass | Pass (preview sizes and GUI scales) | Pass | Pass | Pass | Pass | Pass |
| Totem Studio / Capes | Pass | Pass | Pass | Pass (earlier stages' tests) | Pass | Pass | Pass | Pass | Pass | Pass |
| Friends | Pass | Pass | n/a | n/a (honestly unavailable) | Pass | n/a | n/a | Pass | Pass | Pass |
| In-game menu, HUD editor, emote wheel, Spotify HUD | Follows the tokens (code review) | Not verified visually | Pass (code review) | Layout and editing rules unit-tested; drawing not verified | Layout tested at 320x240 to 960x540 GUI sizes | Not verified | Allocation-free maths tested; drawing not measured | Designed (code review) | Keyboard focus order tested; not verified in game | Pass (no placeholders in code) |

## Automated checks added (test/ui/quality.test.js, UiTests)
- Every page at all four sizes: no sideways scrolling, no text cut off without an ellipsis, nothing outside the window, no script errors. The sidebar collapses to icons on narrow windows.
- Keyboard: Tab reaches labelled controls with a visible focus ring. The emote wheel, segmented controls and the in-game menu have arrow-key handling.
- Contrast in all seven themes; reduced motion stops page transitions and the sky preview; no emoji used as icons.
- Long account names don't overflow. There's no made-up identity, news or server status.
- Previews stop drawing once their page is closed.

## Known gaps
- The in-game GUI has never been compiled or seen. Its layout rules are tested and it follows the tokens, but how it looks in Minecraft is unknown until the first build.
- Minecraft's GUI has no anti-aliased shapes, so in-game panels use cut corners rather than smooth radii, by design.
- The launcher's font falls back to the system font in this test environment (Google Fonts was blocked), so the screenshots show a slightly different typeface from the desktop app.
