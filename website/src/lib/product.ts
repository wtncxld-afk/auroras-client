// Product facts for the marketing pages, written from the client's README, registry and compatibility data.
// Nothing here is a statistic. "Experimental" means the code exists but has not been verified in a real game yet;
// "Planned" means it is not built. Owners can override titles and descriptions from the dashboard (featureCopy).
import registry from "@/data/registry.json";
import adapters from "@/data/adapters.json";

export type Availability = "available" | "experimental" | "planned";
export type Feature = {
  id: string; title: string; kicker: string; body: string; bullets: string[]; shot?: { src: string; alt: string };
  status: { where: string; level: Availability; note?: string }[]; icon: string;
};

export const FEATURES: Feature[] = [
  {
    id: "skies", icon: "sparkles", kicker: "Visual Studio", title: "Custom animated skies",
    body: "Eight sky themes — Aurora, Sakura, Cosmic, Midnight, Endless Void, Sunset, Celestial and Vanilla Enhanced — with shooting stars, drifting nebulae, clouds, falling petals, constellations and layered aurora curtains.",
    bullets: ["Preview every theme in the launcher's Visual Studio before you play", "Animation speed, effect opacity, aurora wave intensity and per-effect toggles", "Low, Balanced and High sky quality", "The preview runs the same formulas as the game, checked value by value against the Java core"],
    shot: { src: "/product/launcher-cosmetics.webp", alt: "Visual Studio in the launcher, previewing the Aurora sky theme with colour, light and animation settings." },
    status: [{ where: "Launcher preview", level: "available" }, { where: "In game", level: "experimental", note: "Written for 1.21.11 and 26.x, not yet verified in a real game" }],
  },
  {
    id: "hud", icon: "layout", kicker: "HUD editor", title: "A premium in-game HUD",
    body: "Lay out FPS, coordinates, keystrokes, CPS, ping, armor, potion effects, target info, clock, Spotify and more by dragging them where you want them, with snapping, resizing and per-element styling.",
    bullets: ["Snap to the screen centre, edges and other elements; Alt places freely", "Minimal, compact or expanded styles, colours, backgrounds, borders, chroma and gradient text", "Preview at common screen sizes and GUI scales", "Save, import and export layout presets"],
    shot: { src: "/product/launcher-hud.webp", alt: "The HUD editor showing client branding, FPS, coordinates, direction, clock, potion effects, keystrokes and armor status on a preview screen." },
    status: [{ where: "Launcher editor", level: "available" }, { where: "In game", level: "experimental", note: "Placement maths shared with the game and unit-tested; not yet verified in a real game" }],
  },
  {
    id: "totem", icon: "box", kicker: "Totem Studio", title: "Totem Studio",
    body: "Paint your own Totem of Undying in a pixel editor with a live 3D item preview built the way Minecraft builds item models, then export it as a PNG or a ready-to-use resource pack.",
    bullets: ["Lighting presets and an approximate activation animation", "Compare with the vanilla totem from your own game files", "Save, rename, duplicate, import and export presets", "Resource pack export with the right pack format for your version"],
    shot: { src: "/product/launcher-totem.webp", alt: "Totem Studio with a pixel editor, colour palette and a 3D preview of a custom totem." },
    status: [{ where: "Launcher", level: "available" }, { where: "Totem effects in game", level: "experimental" }],
  },
  {
    id: "emotes", icon: "smile", kicker: "Emotes", title: "Emotes and animations",
    body: "Fourteen built-in emotes in four categories, an eight-slot emote wheel and a creator with a timeline, per-body-part keyframes, easing and loops.",
    bullets: ["Animated thumbnails and a 3D preview with your own skin", "Search, favourites and recently played", "Import and export emotes (validated)", "Hold the wheel key in game, point and release"],
    shot: { src: "/product/launcher-emotes.webp", alt: "The Emotes page with a 3D player waving, the emote wheel and a grid of emotes." },
    status: [{ where: "Launcher", level: "available" }, { where: "In game", level: "experimental", note: "Local only: other players see you standing normally" }],
  },
  {
    id: "cosmetics", icon: "shirt", kicker: "Cape Studio & skins", title: "Cosmetic previews",
    body: "Preview your account's skin in 3D, and design capes — including HD capes — in a pixel editor with a cape that moves using the same rules as the game.",
    bullets: ["Walk and sneak previews", "Generated, imported (64×32, HD or the classic 22×17) and exported designs", "Favourites and a personal cape library", "Skin upload to your Minecraft account"],
    shot: { src: "/product/launcher-capes.webp", alt: "Cape Studio with a cape library and a 3D player preview." },
    status: [{ where: "Launcher", level: "available" }, { where: "Capes in game", level: "experimental", note: "Only you see Auroras capes; other players don't" }],
  },
  {
    id: "performance", icon: "gauge", kicker: "Performance", title: "Performance-conscious visuals",
    body: "One Low / Balanced / High visual quality preset scales particles, stars and sky detail for every visual module. The launcher pauses its own animated background and 3D preview while Minecraft runs.",
    bullets: ["Optional, well-known open-source performance mods for Fabric instances: Sodium, Lithium, FerriteCore, EntityCulling and ImmediatelyFast (from Modrinth)", "Conflicts such as OptiFine are detected before installing", "The launcher drops to about 10 fps when its window is in the background", "No frame-rate claims: results depend on your hardware"],
    status: [{ where: "Launcher", level: "available" }, { where: "In-game quality preset", level: "experimental" }],
  },
  {
    id: "accounts", icon: "user", kicker: "Accounts", title: "Account management",
    body: "Sign in with Microsoft in Microsoft's own window — passwords, passkeys and two-step checks stay with Microsoft — and switch between several accounts.",
    bullets: ["PKCE-protected sign-in with a fresh, wiped browser session", "Refresh tokens are stored only encrypted by your operating system", "An account manager and quick switcher", "Never imports sign-ins from other launchers"],
    status: [{ where: "Launcher", level: "available" }],
  },
  {
    id: "instances", icon: "layers", kicker: "Versions & instances", title: "Version and instance management",
    body: "Every Minecraft Java release from 1.21 onward, read live from Mojang's official version list, with separate instances that each keep their own version, loader, Java, memory and folder.",
    bullets: ["Latest releases, all releases, or snapshots and pre-releases with clear warnings", "Change an instance's version and keep its worlds, mods and settings", "Import Modrinth modpacks (.mrpack) with checksum-verified downloads", "Modrinth and CurseForge mod search with one-click installs"],
    shot: { src: "/product/launcher-instances.webp", alt: "The Instances page of the launcher." },
    status: [{ where: "Launcher", level: "available" }],
  },
  {
    id: "versions", icon: "check", kicker: "Compatibility", title: "Supported versions and loaders",
    body: "The launcher installs and launches Vanilla and Fabric for any release from 1.21. The Auroras client mod is built for Fabric on Minecraft 1.21.11, 26.1, 26.2 and 26.3.",
    bullets: ["Fabric: launches, and gets the Auroras mod on supported versions", "Vanilla: launches", "NeoForge and Forge: instances can be created, launching is planned", "Other versions launch without the Auroras mod"],
    status: [{ where: "Vanilla & Fabric", level: "available" }, { where: "NeoForge & Forge launching", level: "planned" }],
  },
];

type RegModule = { id: string; name: string; category: string; available: boolean; impactLabel?: string; note?: string };
const reg = (registry as { modules: RegModule[] }).modules;
/** Every module in the client's registry, grouped by category, with an honest state. */
export function registryCatalog() {
  const groups = new Map<string, { id: string; name: string; state: Availability; note: string; impact: string }[]>();
  for (const m of reg) {
    const state: Availability = m.available ? "experimental" : "planned";
    const note = (m.note || "").replace(/^Experimental: written but not yet tested in a real game\.?\s*/i, "").replace(/^Not implemented yet\.?\s*/i, "");
    const list = groups.get(m.category) ?? []; list.push({ id: m.id, name: m.name, state, note, impact: m.impactLabel || "" }); groups.set(m.category, list);
  }
  return [...groups.entries()].map(([category, modules]) => ({ category, modules }));
}
export const registryCounts = () => ({ total: reg.length, withCode: reg.filter((m) => m.available).length, planned: reg.filter((m) => !m.available).length });
export const modVersions = () => (adapters as { adapters: { id: string; loader: string; min: string; max: string }[] }).adapters.filter((a) => a.id.startsWith("m")).map((a) => ({ loader: a.loader, mc: a.min.replace(/\.0$/, "") }));
