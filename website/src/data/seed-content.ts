// Initial content written into the database by `npm run db:seed` (only where nothing exists yet; the owner edits it
// from the dashboard afterwards). Facts come from the client's README, COMPATIBILITY.md and TEST_REPORT.md.

export const DOCS: { slug: string; title: string; section: string; summary: string; sort: number; bodyMd: string }[] = [
  {
    slug: "installation", title: "Install Auroras Client", section: "Getting started", sort: 10,
    summary: "Download the Windows installer, check it, and start the launcher for the first time.",
    bodyMd: `Auroras Client is a Windows launcher. It downloads Minecraft, the right Java runtime and, on supported versions, the Auroras client mod by itself.

## Requirements
- Windows 10 or 11, 64-bit.
- A Minecraft: Java Edition account (Microsoft account) to play. You can look around the launcher without one.
- An internet connection for the first launch of each Minecraft version. After that, installed versions also start offline.

## Steps
1. Open the [download page](/download) and press **Download Auroras Client**. You get \`AurorasClientSetup-<version>.exe\`.
2. Optional but recommended: check the file's SHA-256 against the one shown on the download page (see [Verify a download](#verify-a-download)).
3. Run the installer. You can choose the install folder; it creates desktop and Start menu shortcuts.
4. The installer is not code-signed yet, so Windows SmartScreen may show "Windows protected your PC". Choose **More info**, check the publisher and file name, then **Run anyway** only if the checksum matched.
5. Start Auroras Client, then **Add account > Sign in with Microsoft**.

## Verify a download
In PowerShell, in the folder you downloaded to:

\`\`\`
Get-FileHash .\\AurorasClientSetup-<version>.exe -Algorithm SHA256
\`\`\`

The hash must match the SHA-256 listed for that file on the download page, letter for letter (case doesn't matter).

## Where files live
- Shared game files: \`%APPDATA%\\auroras-client\\game\`
- Each instance: \`%APPDATA%\\auroras-client\\instances\\<id>\` (mods, config, resource packs, worlds, logs, HUD layout)
`,
  },
  {
    slug: "updating", title: "Update Auroras Client", section: "Getting started", sort: 20,
    summary: "How the launcher and the client mod keep themselves up to date, and how updates are verified.",
    bodyMd: `## The launcher
The launcher checks for a newer release in the background. When one is out, it downloads the new installer, checks its SHA-256 against the release's published checksums, and offers **Restart to update**. A file that doesn't match is deleted and never run. Your accounts, settings, instances and worlds live in your user folder, not in the install folder, so updating keeps them.

Close Minecraft before restarting to update; the launcher won't replace itself while the game runs.

## The Auroras client mod
For Fabric instances on a supported Minecraft version, the launcher installs and updates the Auroras mod when you press **Play**. Before replacing the mod, it backs up the old jar and config, and restores them if anything fails.

## Signed update manifest
The launcher can also read a signed update manifest (Settings > Updates > update URL). This site publishes it at [\`/updates/manifest.json\`](/updates/manifest.json) with a detached Ed25519 signature at \`/updates/manifest.json.sig\`. The launcher only accepts the manifest if the signature verifies with the public key built into the launcher, and only installs files whose SHA-256 matches the signed manifest.

## Channels
- **Stable** — recommended.
- **Beta** — earlier builds for testing. In the launcher this is the "preview" channel; choosing it never changes your stable instances.
- **Experimental** — listed on the download page only; never offered automatically.

A release that is withdrawn disappears from the manifest and its downloads stop working. If a release is rolled back, the launcher does not downgrade you automatically.
`,
  },
  {
    slug: "account-sign-in", title: "Sign in with Microsoft", section: "Getting started", sort: 30,
    summary: "How sign-in works, what is stored, and what to do when it fails.",
    bodyMd: `Choose **Add account > Sign in with Microsoft**. Microsoft's own sign-in page opens in a separate window; your password, passkey and two-step checks are handled by Microsoft. The launcher never sees your password.

## What is stored
- A refresh token, encrypted by Windows for your user account. If the system can't encrypt it, the launcher keeps it in memory only and you sign in again next time.
- Nothing is sent anywhere except Microsoft, Xbox Live and Minecraft services.

## Several accounts
Add as many accounts as you like and switch from the account picker on Home or in Settings > Accounts.

## If sign-in fails
- **"Use a code instead"** opens the microsoft.com/link device-code flow as a fallback.
- Make sure the account owns Minecraft: Java Edition.
- Errors about the app not being approved mean Mojang hasn't approved the launcher's Azure app yet; there is nothing to fix on your side.

The launcher does not import sign-ins from other launchers: those belong to the other launcher's Microsoft app.
`,
  },
  {
    slug: "module-installation", title: "Modules and mods", section: "Using the client", sort: 40,
    summary: "Turn client modules on, install the Auroras mod and other mods, and import modpacks.",
    bodyMd: `## Client modules
The Auroras modules (HUD elements, skies, zoom, crosshair and more) are part of the Auroras client mod. Turn them on in the launcher's **Modules** page; settings are saved per instance into the files the mod reads. Modules marked as not built yet can't be switched on.

## The Auroras client mod
You don't install it by hand. Create a **Fabric** instance on a supported version (see [Compatibility](/docs/compatibility)); the launcher installs the mod and Fabric API when you press Play.

If you want the jar yourself, download it from the [Auroras client mod page](/modules/auroras-client-mod) and put it in the instance's \`mods\` folder together with Fabric API for the same Minecraft version.

## Other mods
**Mods** searches Modrinth and CurseForge, installs dependencies, and checks every file against its published checksum.

## Modpacks
**Instances > Import modpack** creates an instance from a Modrinth \`.mrpack\` file. Files are downloaded only from the hosts the format allows and checked against their SHA-512 / SHA-1.
`,
  },
  {
    slug: "compatibility", title: "Minecraft version compatibility", section: "Using the client", sort: 50,
    summary: "Which Minecraft versions and loaders work, and what the states mean.",
    bodyMd: `## The launcher
- Installs and launches every Minecraft: Java Edition **release from 1.21 onward**, read live from Mojang's version list. Snapshots and pre-releases are available behind a warning.
- **Vanilla** and **Fabric** instances launch.
- **NeoForge** and **Forge** instances can be created but not launched yet.
- Windows only for now. Linux and macOS builds are not available.

## The Auroras client mod
Built for **Fabric** on Minecraft **1.21.11, 26.1, 26.2 and 26.3**. On other versions the game launches without the Auroras mod.

## What the states mean
| State | Meaning |
|---|---|
| Tested | Verified in a real game |
| Partially supported | Some checks passed in a real game |
| Experimental | The code exists and builds, but hasn't been verified in a real game |
| Unsupported | No code for this version |

Today every Auroras mod feature is **Experimental**: the jars are built by CI for each version, but no in-game verification has been recorded yet. The launcher's Settings > Compatibility shows the same matrix.
`,
  },
  {
    slug: "troubleshooting", title: "Troubleshooting", section: "Help", sort: 60,
    summary: "Fixes for the most common problems.",
    bodyMd: `## Windows protected your PC
The installer isn't code-signed yet. Check the SHA-256 (see [Installation](/docs/installation#verify-a-download)), then choose More info > Run anyway.

## The game closes right after starting
The launcher shows the last log lines when the game crashes on start. Common causes:
- A custom Java path that is too old for the version. The launcher refuses Java older than the version needs and names both versions.
- An incompatible mod. Try the instance without extra mods.

## "Close Minecraft first, then restart to update"
The launcher never replaces itself while the game runs. Close the game and press Restart to update again.

## Downloads fail
Every download is retried three times and checked against its checksum. Check your connection or proxy; a file that fails its check is never used.

## NeoForge or Forge won't launch
Launching them isn't supported yet. Use Fabric or Vanilla.

## Still stuck?
See [Report a bug](/docs/reporting-bugs).
`,
  },
  {
    slug: "faq", title: "Frequently asked questions", section: "Help", sort: 70,
    summary: "Short answers about safety, cosmetics and supported systems.",
    bodyMd: `**Is it safe?** Every file the launcher downloads is checked against a published checksum, secrets are stored encrypted by the operating system, and the launcher only talks to a fixed list of services (Mojang, Microsoft, Fabric, Modrinth, CurseForge, GitHub and a few skin services). The project has an automated check that fails if that changes.

**Can other players see my capes and emotes?** No. Auroras capes and emotes are local only: other players see your normal Minecraft cape (or none) and see you standing normally.

**Does it work on macOS or Linux?** Not yet. Only Windows builds exist today.

**Which Minecraft versions?** The launcher runs any release from 1.21. The Auroras mod is built for Fabric on 1.21.11, 26.1, 26.2 and 26.3. See [Compatibility](/docs/compatibility).

**Will it get me banned?** Auroras doesn't include cheats. Some servers forbid features such as freelook or fullbright; the module descriptions say so. Check each server's rules.

**Is it affiliated with Mojang or Microsoft?** No.
`,
  },
  {
    slug: "reporting-bugs", title: "Report a bug", section: "Help", sort: 80,
    summary: "What to include so a problem can be fixed quickly.",
    bodyMd: `Open an issue on the project's issue tracker (linked in the footer) with:

1. The launcher version (Settings shows it) and Windows version.
2. The Minecraft version and loader of the instance.
3. What you did, what you expected, and what happened.
4. The last lines of the game log if the game crashed (the launcher shows them), or \`logs/latest.log\` from the instance folder.

Please remove anything personal from logs before posting. Never post your Microsoft password, codes or tokens anywhere: nobody from Auroras will ask for them.

**Security problems** (for example a way to make the launcher run something it shouldn't) — please contact the maintainer privately (see the community links) instead of opening a public issue.
`,
  },
];

export const PRIVACY_MD = `This page describes what this website collects. The Auroras launcher has its own privacy notes in its README.

## Visitors
- **No tracking cookies, no analytics scripts, no advertising.** Public pages set no cookies.
- **Downloads** are counted per file per day as a single number. No IP address, browser details or identifiers are stored with the count.
- The hosting provider and CDN may keep standard server logs (such as IP address and requested page) for security and operations, for a limited time.

## The owner area
The site owner's sign-in uses one strictly necessary, secure session cookie. Sign-in attempts are recorded for security with a keyed hash of the IP address, not the address itself.

## Contact
Questions about privacy: use the contact options in the footer.
`;
export const TERMS_MD = `## Using Auroras Client
Auroras Client is provided as is, without warranty of any kind. You use it at your own risk. Keep your own backups of worlds you care about.

## Minecraft
You need your own legitimate copy of Minecraft: Java Edition. Auroras Client is not an official Minecraft product and is not approved by or associated with Mojang or Microsoft. Use of Minecraft is subject to Mojang's and Microsoft's terms.

## Servers
Follow the rules of the servers you play on. Some servers forbid features such as freelook or fullbright.

## Downloads
Only download Auroras Client from this site or the project's official GitHub releases, and check the SHA-256 shown next to each file.

## Changes
These terms may change; the current version is always on this page.
`;

export const CLIENT_MOD = {
  slug: "auroras-client-mod", name: "Auroras client mod", category: "visuals" as const, isClientMod: true, sort: 0,
  summary: "The Fabric mod behind the Auroras HUD, skies, emotes, cosmetics and player modules. Installed automatically by the launcher.",
  descriptionMd: `The Auroras client mod adds the in-game side of Auroras Client: the radial Right Shift menu, HUD modules and the HUD editor, animated custom skies, emotes, crosshair and rendering options, player modules such as zoom and freelook, and local-only cosmetics.

It is built from one Mojang-names adapter for each supported Minecraft version. **Every in-game feature is experimental**: the code compiles for each version in CI, but none of it has been verified in a real game yet.`,
  features: ["Radial Right Shift menu with HUD, Visuals, Design, Settings and Utility sections", "HUD modules: FPS, coordinates, keystrokes, CPS, ping, armor, potions, clock and more", "HUD editor with snapping and per-element styling", "Animated custom skies with eight themes", "Emote wheel (local only)", "Zoom, toggle sprint and sneak, freelook, perspective controls", "Crosshair customiser, low fire, particle settings, fullbright", "Local-only capes and player glow"],
  installMd: `**Recommended:** let the launcher do it. Create a Fabric instance on a supported version and press Play: the launcher installs this mod and Fabric API, and keeps them updated.

**Manual:** download the jar for your exact Minecraft version below and put it in your instance's \`mods\` folder with [Fabric API](https://modrinth.com/mod/fabric-api) for the same version, using [Fabric Loader](https://fabricmc.net/use/installer/).`,
  requirementsMd: `- Minecraft: Java Edition 1.21.11, 26.1, 26.2 or 26.3
- Fabric Loader
- Fabric API for the same Minecraft version`,
  knownIssuesMd: `- None of the in-game code has been verified in a real game yet; expect issues and please report them.
- Custom skies and capes use mixins whose target names haven't been confirmed in game.
- Nether sky themes aren't drawn.
- Emotes and capes are local only: other players don't see them.`,
  author: "Auroras Client", sourceUrl: "https://github.com/wtncxld-afk/auroras-client", docsUrl: null,
};
