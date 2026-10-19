# Auroras friends server

Friends, online status and invites for Auroras Client. One Node program (`server.js`, Node 18 or newer) with no
dependencies. Data is one JSON file.

## Run it

```
node server.js            # port 8787, data in ./data/friends.json
PORT=9000 DATA=/var/lib/auroras/friends.json node server.js
```

Put it behind HTTPS (for example Caddy: `friends.example.net { reverse_proxy localhost:8787 }`). The launcher only talks
to `https://` addresses (plain `http://` only for `localhost`, for testing).

Then either type the address in the launcher (Friends page, or Settings), or build it into every installer: set the
repository variable `FRIENDS_URL` (Settings > Secrets and variables > Actions > Variables) and the release workflow puts
it in `auth.json`.

## How sign-in works

The same way a Minecraft server checks a joining player, so no password or Microsoft token ever reaches this server:

1. The launcher asks for a one-time server id (`POST /auth/challenge`).
2. The launcher tells Mojang's session server the player is joining with that id, using the player's own Minecraft token.
3. This server asks Mojang (`hasJoined`) whether that player joined with that id. If Mojang says yes, it gives the
   launcher a session token (kept 30 days; only its SHA-256 is stored).

## What it stores

Minecraft UUIDs and names of players who signed in, friendships, pending requests, and hashed session tokens.
Online status and invites are kept in memory only. Only friends see each other's status. Friend requests go by
Minecraft name to players who have opened Friends at least once.

## API

All JSON. Authenticated calls send `Authorization: Bearer <token>`.

| Call | Body | Answer |
| --- | --- | --- |
| `GET /health` | | `{ ok }` |
| `POST /auth/challenge` | `{ name }` | `{ serverId }` |
| `POST /auth/verify` | `{ name, serverId }` | `{ token, uuid, name }` |
| `POST /auth/signout` | | `{ ok }` |
| `GET /friends` | | `{ me, friends[], incoming[], outgoing[], invites[] }` |
| `POST /presence` | `{ state: online / playing / away / offline, server?, instance? }` | `{ ok }` |
| `POST /friends/request` | `{ name }` | `{ ok, sent }`, or `{ ok, friend }` if they had already asked you |
| `POST /friends/accept`, `/decline`, `/cancel`, `/remove`, `/invite` | `{ uuid }` | `{ ok }` |

Limits: 120 requests a minute per address, 8 KB bodies, 300 friends, 100 pending requests. Status goes offline after
90 seconds without a heartbeat (the launcher sends one every minute). Invites last 10 minutes.

Tests: `node --test test/friends.test.js` from the project root. They run this server and the launcher's client against
each other, with a stand-in for Mojang's session server.
