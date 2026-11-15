English: [README.md](README.md) (full details)

# Sheet Relay

Fichas de personagem para o [Foundry VTT](https://foundryvtt.com) v13, num app web para celular (instalável como PWA). Jogadores e mestre veem e editam fichas, rolam dados e usam habilidades, e tudo é lido e gravado no seu mundo real do Foundry.

Três partes: o **módulo Foundry** `sheet-relay` (`module/`), o **relay** (`relay/`, servidor Node: HTTP/SSE para o app e WebSocket para o módulo) e o **app web** (`systems/<id>/app`, em inglês e português). Cada sistema de jogo é um plugin em `systems/<id>/`. Os diagramas estão em `docs/diagrams/`.

## Sistemas

- `dnd5e`: plugin completo, com regras de rolagem do SRD 5.2 (em inglês).
- `fallout` (2d20) e `legends` (Avatar Legends): só o código de integração. Não incluímos texto de regras nem catálogo; você precisa ter os jogos e traz o seu catálogo (`catalog.private.json`).

## Início rápido

**Docker**: `cd docker && cp .env.example .env` (defina `SYSTEM`, `RELAY_SECRET`, `RELAY_USER`, `RELAY_PASSWORD`), `docker compose up -d`. No Foundry, instale o módulo pelo manifesto
`https://github.com/GabrielDiasMoraes/sheet-relay/releases/latest/download/module.json`, ative no mundo, crie o usuário do relay (função *Assistant GM*), e em *Configure Settings → Sheet Relay* ponha **URL do relay** `ws://sheet:8787`, **Segredo do relay** = `RELAY_SECRET` e a **pasta dos jogadores**. O app abre em `http://localhost:8787/ficha/`.

**npm**: `RELAY_SECRET=... npx @gaabrielmooraes/sheet-relay serve --system dnd5e`; para manter o usuário do relay conectado sem navegador, `npx @gaabrielmooraes/sheet-relay headless` (precisa de `playwright`).

**Do código-fonte**: `bash module/deploy.sh --local <pasta Data>`, `cd relay && node server.js`, `bash scripts/publish-app.sh <app> --local <pasta Data> --serve`.

Passo a passo completo (em inglês): [docs/install.md](docs/install.md).

## Idioma

O app tem o seletor **EN / PT**; o módulo tem a opção **Module language** (automático por padrão).

## Segurança

Defina um `RELAY_SECRET` longo no relay e no módulo; use um proxy reverso com HTTPS e `TRUST_PROXY=1` ao expor o relay; dê uma senha forte ao usuário do relay (conta de mestre); não versione o `.env`.

## Outro sistema, licenças, contribuir

Criar um plugin: [docs/create-system.md](docs/create-system.md). Código sob MIT; o catálogo do D&D parafraseia o SRD 5.2 (CC-BY-4.0), veja [NOTICE](NOTICE). Marcas pertencem aos donos; projeto não oficial. Antes de contribuir, rode `bash scripts/check.sh`.
