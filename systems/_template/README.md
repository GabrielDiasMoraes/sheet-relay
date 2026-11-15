# Example system ("hello system")

Starting point for creating a new system plugin. **Copy this folder** to `systems/<game.system.id>/` (the folder name is the system id in
Foundry), replace `template` with your id in the files below and follow [docs/create-system.md](../../docs/create-system.md).

| File | What it is |
|---|---|
| `system.json` | Manifest: domain, instance, relay user, services, MCP port (`scripts/check-systems.mjs` checks it against the docker-compose, Caddy and `.mcp.json`) |
| `module/index.js` | Plugin descriptor (`defineSystem`) |
| `module/template.js` | System commands: `getCharacter`, `update`, `roll` |
| `module/catalog.json` | Feat roll rules (start empty: `{}`) |
| `content/fixes.mjs` | Catalog generator tweaks (optional) |
| `app/` | Expo app: `App.tsx` uses `createApp`; `Sheet.tsx` is the sheet; `ui.tsx` is the visual kit |

What the example does: lists `character` actors, opens the sheet (name and HP), allows renaming and rolls a `1d20`. It is minimal on purpose.
This folder starts with `_`, so the publish and manifest validation scripts ignore it.
