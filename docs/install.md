# Installing Sheet Relay

Summary and AI-agent checklist: [README](../README.md#for-ai-agents-installing-this). This is the full walkthrough.

## What you always need

1. Foundry VTT **v13** with your game system installed and a **world**.
2. The `sheet-relay` module enabled in the world.
3. A **relay user** (role *Assistant GM*, with a password) connected to the world all the time (an open tab, or headless).
4. The **relay** (Node) that connects the app to Foundry, with a shared secret (`RELAY_SECRET`).
5. The **app**, served over HTTP. HTTPS is only required when it is accessed from somewhere other than `localhost`.

Module settings (*Configure Settings → Sheet Relay*): **Relay URL**, **Relay secret**, **Relay user** (default `Relay`), **Players folder** (default `Players`), **Module language**.

## Option 1: Docker

Needs Docker with Compose. Files: `docker/docker-compose.yml`, `docker/.env.example`, `docker/Caddyfile`.

1. `cd docker && cp .env.example .env` and edit it:
   - `SYSTEM`: your Foundry system id (`dnd5e`, `fallout` or `legends`);
   - `RELAY_SECRET`: a long random value (for example `openssl rand -hex 32`);
   - `RELAY_USER` / `RELAY_PASSWORD`: the Foundry user the headless browser logs in as;
   - `FOUNDRY_HOST`: host name of your Foundry server as seen from the containers (`foundry` with the profile below);
   - `DOMAIN`: only for the `caddy` profile (for example `sheets.example.org`).
2. Start it:
   ```bash
   docker compose up -d                        # relay + app (service "sheet") and the headless relay user
   docker compose --profile foundry up -d      # optionally also a Foundry server (needs your Foundry account/licence variables)
   docker compose --profile caddy up -d        # optionally HTTPS in front of the relay (needs DOMAIN, ports 80/443)
   ```
3. In Foundry: install the module from the manifest URL `https://github.com/GabrielDiasMoraes/sheet-relay/releases/latest/download/module.json`, enable it in the world, and create the relay user (name = `RELAY_USER`, role **Assistant GM**, password = `RELAY_PASSWORD`). Create an Actor folder for the players' characters and put the sheets in it.
4. *Configure Settings → Sheet Relay*: **Relay URL** `ws://sheet:8787` (service name; the Foundry container must share the compose network, as it does with the `foundry` profile), **Relay secret** = `RELAY_SECRET`, **Players folder** = your folder.
5. Restart the headless service if it started before the user existed: `docker compose restart headless`.
6. Open `http://localhost:8787/ficha/`. The port is bound to `127.0.0.1` only; for other devices use the `caddy` profile (or your own HTTPS reverse proxy) and open `https://<DOMAIN>/ficha/`.
7. Check: `curl http://localhost:8787/api/status` should return `{"ok":true,"system":"dnd5e","plugin":"dnd5e","api":1}` (with your system id).

The image `ghcr.io/gabrieldiasmoraes/sheet-relay` serves one system per container (`SYSTEM`). To build it yourself from the repository root: `docker build -t sheet-relay .` (build args `SYSTEMS` to limit which apps are built, `BASE_PATH`, default `/ficha`).

## Option 2: npm, without Docker

Needs Node.js 20+.

```bash
export RELAY_SECRET='a-long-random-value'
npx @gaabrielmooraes/sheet-relay serve --system dnd5e
```

This runs the relay and serves the bundled app at `http://127.0.0.1:8787/ficha/` (`--port`, `--host`, `--base`; or `PORT`, `HOST`, `BASE_PATH`). Behind a reverse proxy also set `TRUST_PROXY=1`.

Keep the relay user connected:

- **Open tab**: log in as the relay user at `http://localhost:30000` and leave the tab open (do not let it sleep).
- **Headless**: `npm i playwright && npx playwright install chromium`, then
  `FOUNDRY_URL=http://localhost:30000 FOUNDRY_USER=Relay FOUNDRY_PASSWORD='...' npx @gaabrielmooraes/sheet-relay headless`
  (`FOUNDRY_HOST` is optional: the real host name of Foundry, if it is not `localhost`; the browser still uses `localhost` so the page is a secure context).

Install and configure the module in Foundry as in Docker steps 3 and 4, with **Relay URL** `ws://localhost:8787`.

## Option 3: from source (local development)

Needs Node.js 20+ and git.

1. **Get the code**: `git clone https://github.com/GabrielDiasMoraes/sheet-relay.git && cd sheet-relay`
2. **Install the module**. Find your Foundry **Data** folder (Foundry → *Configuration* → *User Data Path*):

   | OS | Default |
   |---|---|
   | Windows | `%localappdata%\FoundryVTT\Data` (use Git Bash or WSL for `bash`) |
   | macOS | `~/Library/Application Support/FoundryVTT/Data` |
   | Linux | `~/.local/share/FoundryVTT/Data` |

   ```bash
   bash module/deploy.sh --local "<Data folder>"
   ```
   This writes `<Data>/modules/sheet-relay/{module.json,scripts/...}` plus `scripts/systems/<id>/` for each plugin in the repository. Restart Foundry if it was open.
3. **Configure the world**: open it as Gamemaster, enable **Sheet Relay** in *Manage Modules*, create the relay user (role Assistant GM, with a password) and the players' Actor folder, then set **Relay URL** `ws://localhost:8787`, **Relay secret** (same value as `RELAY_SECRET` below), **Relay user** and **Players folder**.
4. **Start the relay**: `cd relay && npm install && RELAY_SECRET=<secret> node server.js` (port 8787, `127.0.0.1` only).
5. **Connect the relay user**: open tab or headless as in option 2 (`cd headless && npm install && npx playwright install chromium`, then `FOUNDRY_URL=... FOUNDRY_USER=... FOUNDRY_PASSWORD=... node login.mjs`).
6. **Check**: `curl http://localhost:8787/api/status`.
   - `503` / "disconnected": step 5 is not active, or Relay URL / secret do not match.
   - `plugin:null`: your system has no plugin in `systems/` (see [create-system.md](create-system.md)).
7. **Serve the app**:
   ```bash
   (cd systems/<id>/app && npm install)      # first time only
   bash scripts/publish-app.sh <app> --local "<Data folder>" --serve
   ```
   `<app>` is the `app` field of `systems/<id>/system.json` (`dnd`, `fallout`, `avatar`) or the system id. Open `http://localhost:8080/ficha/`. The script type-checks, builds, and starts a static server that proxies `/sheet-api` to the local relay.
8. **Play over the local network**: use `http://<machine IP>:8080/ficha/`. The app works over HTTP; the module only needs a secure context inside Foundry (open the relay user's Foundry on `localhost`). Open port 8080 in the firewall. For internet access use HTTPS (Docker with the `caddy` profile or your own reverse proxy).

## Common problems

| Symptom | Likely cause |
|---|---|
| App: "Foundry disconnected" | the relay user is not connected, or Relay URL / Relay secret are wrong |
| `/api/status` shows `plugin:null` | no `systems/<id>/` for your system, or the module was not redeployed after creating it |
| Module does not show up | wrong Data folder; restart Foundry |
| App login fails (401) | wrong app password; the GM can reset it with `api.setPassword(userId, "password")` in the browser console (`game.modules.get("sheet-relay").api`) |
| Nothing changes after updating the module | restart the world / the headless service (the module is loaded once) |
| Character list empty for the GM | sheets must be in the folder set in *Players folder* |

## Uninstall

Stop the relay (and `docker compose down` for Docker) and delete `<Data>/modules/sheet-relay`.
