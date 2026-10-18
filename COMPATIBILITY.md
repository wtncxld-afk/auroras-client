# Auroras Client compatibility matrix

Generated from a Minecraft version list (normally Mojang's official one), the adapter table in the client core, and `validated.json` (real in-game test results). A version listed here can be installed and launched by the launcher; the columns say what the Auroras client mod does on it.

> **Generated from a sample version list, not Mojang's.** SAMPLE manifest for offline builds and tests, written by hand in Mojang's version_manifest_v2 shape. It is not Mojang's list. Run `node scripts/compat-matrix.js` with network access to use the official one.

States: **Tested** (verified in a real game), **Partially Supported** (some checks passed), **Experimental** (code exists, never verified), **Unsupported** (no code for this version).

| Minecraft | Type | Loader | Build | Launch test | Module menu | HUD | HUD editor | Custom skies | Emotes | Known issues |
|---|---|---|---|---|---|---|---|---|---|---|
| 26.1 | Release | fabric | not built | untested | Experimental | Experimental | Experimental | Unsupported | Experimental | Adapter code exists but has never been built. |
| 26.1-rc-1 | Release candidate | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Auroras builds are only made for releases; the client mod stays disabled on development builds. |
| 26.1-pre-1 | Pre-release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Auroras builds are only made for releases; the client mod stays disabled on development builds. |
| 26.1-snapshot-1 | Snapshot | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Auroras builds are only made for releases; the client mod stays disabled on development builds. |
| 1.21.11 | Release | fabric | not built | untested | Experimental | Experimental | Experimental | Unsupported | Experimental | Adapter code exists but has never been built. |
| 1.21.11-rc1 | Release candidate | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Auroras builds are only made for releases; the client mod stays disabled on development builds. |
| 1.21.10 | Release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | No Auroras adapter for this version yet; the client mod stays disabled. |
| 1.21.9 | Release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | No Auroras adapter for this version yet; the client mod stays disabled. |
| 1.21.8 | Release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | No Auroras adapter for this version yet; the client mod stays disabled. |
| 1.21.7 | Release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | No Auroras adapter for this version yet; the client mod stays disabled. |
| 1.21.6 | Release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | No Auroras adapter for this version yet; the client mod stays disabled. |
| 25w20a | Snapshot | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Auroras builds are only made for releases; the client mod stays disabled on development builds. |
| 1.21.5 | Release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | No Auroras adapter for this version yet; the client mod stays disabled. |
| 1.21.5-rc1 | Release candidate | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Auroras builds are only made for releases; the client mod stays disabled on development builds. |
| 1.21.5-pre1 | Pre-release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Auroras builds are only made for releases; the client mod stays disabled on development builds. |
| 25w02a | Snapshot | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Auroras builds are only made for releases; the client mod stays disabled on development builds. |
| 1.21.4 | Release | fabric | not built | untested | Experimental | Experimental | Experimental | Experimental | Experimental | Adapter code exists but has never been built. |
| 1.21.3 | Release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | No Auroras adapter for this version yet; the client mod stays disabled. |
| 1.21.2 | Release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | No Auroras adapter for this version yet; the client mod stays disabled. |
| 1.21.1 | Release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | No Auroras adapter for this version yet; the client mod stays disabled. |
| 1.21 | Release | fabric | no adapter | untested | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | No Auroras adapter for this version yet; the client mod stays disabled. |
