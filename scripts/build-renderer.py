"""Builds the launcher pages from renderer-src/page.html.

  python scripts/build-renderer.py

Replaces  /*@include path*/  with that file's contents and  /*@json NAME path*/  with  window.NAME = <json>;
(paths relative to the project folder), then writes:
  renderer/index.html      desktop app page, with a strict Content-Security-Policy
  build/web-preview.html   the same page without the CSP, for the hosted preview
"""
import json, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
CSP = ("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src file: 'unsafe-inline'; "
       "style-src file: 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
       "img-src file: data: blob: https://cdn.modrinth.com https://*.forgecdn.net; media-src 'none'; connect-src 'none'\">")
def safe(rel):
    p = (ROOT / rel).resolve()
    if ROOT not in p.parents: raise SystemExit("include outside the project: " + rel)
    return p
src = (ROOT / "renderer-src" / "page.html").read_text(encoding="utf-8")
for _ in range(5):  # includes may include other files
    src = re.sub(r"/\*@include ([\w./-]+)\*/", lambda m: safe(m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script"), src)
src = re.sub(r"/\*@json (\w+) ([\w./-]+)\*/", lambda m: "window." + m.group(1) + "=" + json.dumps(json.loads(safe(m.group(2)).read_text(encoding="utf-8")), separators=(",", ":")).replace("</", "<\\/") + ";", src)
def kebab(k): return re.sub(r"([A-Z])", lambda m: "-" + m.group(1).lower(), k)
def tokens_css():
    t = json.loads(safe("visuals/design-tokens.json").read_text(encoding="utf-8"))
    v = ["--" + kebab(k) + ":" + c for k, c in t["color"].items()]
    v += ["--sp-%s:%dpx" % (k, n) for k, n in t["space"].items()]
    v += ["--r-%s:%dpx" % (k, n) for k, n in t["radius"].items()]
    v += ["--fs-%s:%dpx" % (k, n) for k, n in t["font"].items()]
    m = t["motion"]; v += ["--t-fast:%dms" % m["fast"], "--t:%dms" % m["base"], "--t-slow:%dms" % m["slow"], "--ease:cubic-bezier(%s)" % ",".join(str(x) for x in m["ease"])]
    v += ["--" + kebab(k) + ":%dpx" % n for k, n in t["size"].items()]
    v += ["--sh-" + k + ":" + c for k, c in t.get("shadow", {}).items()]
    return ":root{" + ";".join(v) + "}"
src = src.replace("/*@tokens*/", tokens_css())
if "/*@" in src: raise SystemExit("unresolved include marker")
marker = '<meta charset="utf-8">'
if src.count(marker) != 1: raise SystemExit("Could not find the charset meta tag.")
(ROOT / "renderer").mkdir(exist_ok=True); (ROOT / "build").mkdir(exist_ok=True)
(ROOT / "renderer" / "index.html").write_text(src.replace(marker, marker + "\n" + CSP, 1), encoding="utf-8")
(ROOT / "build" / "web-preview.html").write_text(src, encoding="utf-8")
print("wrote renderer/index.html and build/web-preview.html")
