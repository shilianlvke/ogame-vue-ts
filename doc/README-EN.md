<div align="center">

<img src="../public/logo.svg" alt="OGame Vue TS Logo" width="128" height="128" />

# OGame Vue TS

**Multiplayer Rework**

An OGame-style space strategy game rewritten in Vue 3 + TypeScript

Main repository: [Gitee](https://gitee.com/shilianlvke/ogame-vue-ts) · Mirror: [GitHub](https://github.com/shilianlvke/ogame-vue-ts)

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey?style=flat-square)](https://creativecommons.org/licenses/by-nc/4.0)
[![Docker: fnOS](https://img.shields.io/badge/Deploy-fnOS%20Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](DEPLOY_DOCKER.md)

[简体中文](../README.md) | [繁體中文](README-zh-TW.md) | English | [Deutsch](README-DE.md) | [Русский](README-RU.md) | [Español](README-ES.md) | [한국어](README-KO.md) | [日本語](README-JA.md)

<sub>Other language versions may lag behind the Simplified Chinese version, which is authoritative.</sub>

</div>

> **Important Notice**
>
> This project is an **unofficial derivative** of [setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts). It is not an official branch of the upstream project, and it has not been authorized, approved, or endorsed by Gameforge AG or the official OGame team.
>
> This project is intended solely for learning, research, and personal entertainment. **Any form of commercial use is prohibited.** See [Origin, License and Legal Notices](#origin-license-and-legal-notices) for the complete statement.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Feature Highlights](#feature-highlights)
- [Single-Player and Multiplayer Architecture](#single-player-and-multiplayer-architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Multiplayer Deployment](#multiplayer-deployment)
- [Project Structure](#project-structure)
- [Common Scripts](#common-scripts)
- [Testing and Quality](#testing-and-quality)
- [Development Status](#development-status)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Origin, License and Legal Notices](#origin-license-and-legal-notices)
- [Acknowledgments](#acknowledgments)

## Project Overview

**OGame Vue TS · Multiplayer Rework** is a space strategy game developed as a derivative of [ogame-vue-ts](https://github.com/setube/ogame-vue-ts), the open-source project by the original author [setube](https://github.com/setube).

The project retains the original single-player gameplay and core game-balance values, and builds on that foundation with extensive reworking and expansion of the multiplayer architecture, UI interactions, galaxy view, base system, and deployment approach.

The current version offers two ways to play:

- **Single-player mode**: the game core runs in the browser, saves are stored locally, and you can start playing right away;
- **Multiplayer mode**: a Node.js WebSocket server acts as the single authoritative source of state, supporting accounts, multiple players on the same server, PvP, chat, leaderboards, and an NPC ecosystem.

> This project currently maintains only the **web client + fnOS Docker** deployment path. Legacy deployment targets such as Android, Electron, and the Go server have been removed; the related code can still be found in the Git history.

## Feature Highlights

### Base and Empire Management

- Buildings, research, shipyard, and defense are integrated into a single unified base;
- Building queues, research queues, fleet mission slots, and resource consumption are settled in real time;
- Moon bases, moon generation, debris fields, and debris recycling;
- Officers, resource bonuses, empire score, and multi-planet management.

### Fleets and Combat

- Ship construction, fleet composition, mission dispatch, and multi-leg flights;
- A battle simulator for validating fleet setups before committing resources;
- Combat reports, loot, debris fields, and attack/defense resolution;
- Stargate capture, tolls, blockades, and NPC caravans.

### Diplomacy and the NPC Ecosystem

- NPC relations, reputation, trade, gifts, intelligence, and diplomatic events;
- Hostile NPC scouting, attacks, and retaliation;
- NPC growth, economic output, and a shared multiplayer world;
- Diplomatic notifications, event reports, and filtering by relation status.

### Galaxy and Exploration

- A full-screen 2.5D star map with three view levels: star system, local cluster, and galaxy overview;
- Ten planets orbit their star slowly, with randomized orbits, sizes, and speeds;
- Clicking a planet or star system focuses it, with camera tracking and a context panel that fades in;
- Scanning, naming, stargates, unknown signals, wormholes, debris, and ruins to explore;
- A cyclic universe of 12 cycles × 16 regions × 64 star systems.

### Multiplayer and Long-Term Operations

- Account registration, login, sessions, and reconnection after disconnects;
- A server-authoritative world, with clients synchronized through commands and state patches;
- Player trading, PvP, espionage, missiles, fleet missions, and real-time notifications;
- Public chat, private messages, online status, leaderboards, and season/cycle mechanics;
- Server-side JSON saves, autosave, and persistence through Docker data volumes.

### Experience and Maintainability

- 8 languages: Simplified Chinese, Traditional Chinese, English, German, Russian, Spanish, Korean, and Japanese;
- Dark and light themes, responsive layout, and PWA support;
- Single-player saves persisted in IndexedDB;
- A unified command layer, a headless core, and a testable game-rules layer;
- One-click fnOS Docker deployment and image export.

## Single-Player and Multiplayer Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                      Browser client                      │
│  Vue 3 + Pinia + Vue Router + Tailwind CSS               │
│  Views dispatch commands only; never mutate world state  │
└────────────────────────────┬─────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
        Single-player                  Multiplayer
              │                             │
              ▼                             ▼
┌──────────────────────────┐            WebSocket
│  src/core                │                │
│  Headless game core      │                ▼
│  tick / commands         │         Node.js server
│  rules / state           │          server/ + ws
└─────────────┬────────────┘                │
              │                             ▼
              ▼                Server-authoritative world
          IndexedDB                  data/world.json
```

- `src/core`: headless game core that owns world state, ticks, missions, NPCs, commands, and the protocol;
- `src/logic`: pure game rules and numeric calculations, kept as free of UI dependencies as possible;
- `server/`: Node.js WebSocket server, accounts, rooms, persistence, and static asset hosting;
- `src/stores` / `src/views`: browser-side state and UI;
- `scripts/`: headless smoke tests, server tests, and build scripts.

Single-player mode reuses the headless core directly; in multiplayer mode the server runs that same core logic, and the client only sends commands and renders snapshots.

## Tech Stack

| Category | Technology |
|---|---|
| Frontend | Vue 3, TypeScript, Vite (Rolldown-Vite) |
| State and routing | Pinia, Vue Router 4 |
| UI | Tailwind CSS v4, shadcn-vue, reka-ui, Lucide |
| Animation and feedback | tw-animate-css, vue-sonner |
| Single-player persistence | IndexedDB |
| Multiplayer server | Node.js 22, WebSocket (ws) |
| Deployment | Docker, fnOS, Node static asset hosting |
| Quality assurance | vue-tsc, headless engine smoke tests, server integration tests, i18n validation |

## Quick Start

### Requirements

- Node.js **22+**
- pnpm **10+**
- A modern browser (Chrome / Edge / Firefox / Safari)

### Clone and Install

```bash
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git
cd ogame-vue-ts
pnpm install
```

GitHub mirror:

```bash
git clone https://github.com/shilianlvke/ogame-vue-ts.git
```

### Local Development

```bash
pnpm dev
```

Default development URL:

```text
http://localhost:25121
```

### Production Build

```bash
pnpm build
pnpm preview
```

`pnpm build` runs the TypeScript type check first, then builds the frontend static assets into `docs/`.

### Running the Multiplayer Server Locally

```bash
# Build the frontend and the Node server
pnpm build
pnpm run build:node-server

# Start the server (reads docs/ and data/ by default)
pnpm start:server
```

The default port is `25122` and can be overridden with environment variables:

```bash
PORT=8080 STATIC_DIR=docs DATA_DIR=data pnpm start:server
```

Once the server is running:

- Game page: `http://localhost:25122`
- Health check: `http://localhost:25122/health`
- WebSocket: `ws://localhost:25122/ws`

> In production, use HTTPS/WSS, and handle access control, backups, and security hardening yourself.

## Multiplayer Deployment

Docker deployment on fnOS is currently the recommended approach.

### Option 1: One-Click Source Deployment on fnOS (Recommended)

Prerequisites: Docker and git are installed on fnOS, and the host can pull `node:22-alpine` or already has a registry mirror configured.

```bash
cd /vol1/docker
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git ogame
cd ogame

chmod +x deploy-fnos.sh
./deploy-fnos.sh
```

To update later:

```bash
./deploy-fnos.sh --update
```

More commands:

```bash
./deploy-fnos.sh --start
./deploy-fnos.sh --stop
./deploy-fnos.sh --restart
./deploy-fnos.sh --logs
./deploy-fnos.sh --status
./deploy-fnos.sh --port 8080
./deploy-fnos.sh --china
```

### Option 2: Build the Image on a Computer, Then Import It

Windows:

```powershell
.\docker-build.ps1
```

The script builds `noskyman:latest` and exports `noskyman.tar`. After uploading `noskyman.tar` and `docker-compose.yml` to the same directory on fnOS:

```bash
docker load -i noskyman.tar
docker compose up -d
```

For full instructions, environment variables, reverse-proxy WebSocket configuration, and FAQ, see:

- [fnOS Docker deployment guide](DEPLOY_DOCKER.md)

> `docker-compose.yml` uses only the local `noskyman:latest` image and does not actively pull from the network; source builds are handled by `deploy-fnos.sh`.

## Project Structure

```text
.
├── src/
│   ├── core/          # Headless game core: world, tick, commands, missions, NPCs, protocol
│   ├── logic/         # Pure game rules and numeric calculations
│   ├── components/    # Vue components
│   ├── views/         # Page views
│   ├── stores/        # Pinia state
│   ├── locales/       # Translations for the 8 languages
│   ├── services/      # Save, update, WebDAV, and other services
│   └── workers/       # Combat worker
├── server/            # Node.js WebSocket server
├── scripts/           # Build, i18n, and headless/server smoke tests
├── doc/               # Deployment, multiplayer, galaxy design, and reference docs
├── public/            # Static assets
├── Dockerfile         # Multi-stage frontend + Node server image
├── docker-compose.yml # fnOS runtime configuration
├── deploy-fnos.sh     # One-click fnOS deployment script
└── docker-build.ps1   # Build and export the image on Windows
```

## Common Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the Vite development server |
| `pnpm build` | Type-check and build the frontend into `docs/` |
| `pnpm preview` | Preview the production build |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm check:i18n` | Validate the keys of the 8 locale bundles |
| `pnpm test` | Type-check + i18n + all headless and server smoke tests |
| `pnpm smoke` | Headless engine smoke tests |
| `pnpm smoke:server` | Integration tests against a real WebSocket server |
| `pnpm build:node-server` | Build the Node server into `server-dist/` |
| `pnpm dev:server` | Build and start the local Node server |
| `pnpm start:server` | Start the already-built Node server |

## Testing and Quality

```bash
pnpm typecheck
pnpm check:i18n
pnpm test
```

`pnpm test` covers:

- the headless game engine;
- cycle scoping;
- star map scale, determinism, layout, and connectivity;
- max-level accounts and the campaign flow;
- server login, visibility, commands, patches, ticks, saves, and reconnection;
- client synchronization and the real WebSocket pipeline.

## Development Status

The project is still under active development; the UI, game balance, network protocol, and save format may all continue to change.

Always back up before upgrading:

- Single-player saves: browser-local data;
- Multiplayer saves: the server's `data/world.json`;
- Docker deployments: the mounted `./data` directory.

Galaxy system rework progress and design records:

- [Galaxy status overview](GALAXY_STATUS.md)
- [Galaxy redesign](GALAXY_REDESIGN.md)
- [Star map design](GALAXY_MAP_DESIGN.md)
- [Cycles and loops](GALAXY_CYCLES.md)
- [Multiplayer architecture](MULTIPLAYER.md)

## Documentation

| Document | Contents |
|---|---|
| [fnOS Docker deployment](DEPLOY_DOCKER.md) | One-click fnOS deployment, image import, environment variables, and reverse proxy |
| [Multiplayer architecture](MULTIPLAYER.md) | Headless core, command layer, server, and sync protocol |
| [Game reference](ogame-reference.md) | Building, technology, ship, defense, and officer data |
| [Galaxy status](GALAXY_STATUS.md) | Galaxy rework stages and acceptance status |

## Contributing

Issues and pull requests are welcome, but please check the following first:

1. **Do not report issues with this project to the upstream repository.** The upstream author is not responsible for this derivative version.
2. By submitting code, you agree to release the contribution under this project's CC BY-NC 4.0 license.
3. Do not remove or weaken upstream attribution, license links, or the description of changes.
4. Do not submit any misleading content related to commercial licensing, paid services, or the official OGame.
5. Changes involving multiplayer, security, or the save format should also come with tests and documentation.

Please submit issues and feedback to:

- Gitee: <https://gitee.com/shilianlvke/ogame-vue-ts>
- GitHub: <https://github.com/shilianlvke/ogame-vue-ts>

## Origin, License and Legal Notices

> This section explains the project's origin, licensing, and basic position, and does not constitute legal advice. If you are considering commercial use, public operation, redistribution, or large-scale deployment, please consult a qualified legal professional.

### Upstream Project and Derivative Relationship

- **Upstream project**: [setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts)
- **Upstream author**: [setube](https://github.com/setube)
- **This project**: a derivative version maintained by [shilianlvke](https://gitee.com/shilianlvke)

This project is a modified version of the upstream project; the exact scope of changes is determined by this repository's Git history. Major changes include, but are not limited to:

- multiplayer architecture, the Node.js WebSocket server, accounts, and multiplayer synchronization;
- reworked pages such as the interface, base, fleets, diplomacy, rankings, and messages;
- a full-screen 2.5D galaxy view with focus interactions;
- gameplay extensions such as galaxies, cycles, stargates, and unknown signals;
- Docker / fnOS deployment;
- removal of legacy deployment targets such as Android, Electron, and the Go server.

There is no affiliation, partnership, sponsorship, or endorsement relationship between this version and the upstream author. The upstream author is not responsible for this version's code, deployment, operation, or any consequences thereof.

### License

This project adopts the license of the upstream project:

**[Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/)** · [License file](../LICENSE)

This project **does not grant any commercial license**. If you wish to use the code or content for commercial purposes, do not use this project.

You are free to:

- **Share**: copy and redistribute the project in any medium or format;
- **Adapt**: modify, transform, or build upon the project.

Under the following terms:

- **Attribution**: credit the upstream author and this project's author, retain the license link and a description of the changes, and do not imply that the authors endorse you or your use;
- **NonCommercial**: you may not use this project for commercial purposes;
- **No additional restrictions**: you may not restrict others from exercising the rights the license permits, whether through legal terms or technical measures.

Unless otherwise stated, the code and documentation added by this project in this repository are also released under CC BY-NC 4.0. Third-party dependencies, icons, fonts, trademarks, and other third-party content remain the property of their respective owners and are subject to their own licenses.

### Trademarks and Official Affiliation

- **OGame** and related names, trademarks, and game content belong to **Gameforge AG** or their respective rights holders.
- This project is an independent, unofficial fan-made technical project with no affiliation, authorization, sponsorship, or endorsement relationship with Gameforge AG or the official OGame team.
- The OGame name is used in this project only to describe the game genre and to credit the source of inspiration; no trademark rights are claimed.
- If a rights holder believes that content in this project infringes their lawful rights, please contact the maintainers through an issue in this repository, and we will respond promptly.

### Multiplayer Operations and Data Responsibility

- In single-player mode, saves are stored locally in the user's browser;
- In multiplayer mode, world and account data are stored in the server's `data/world.json`, and player content such as chat and battle reports may be processed;
- Deployers are responsible for server security, access control, data backups, privacy notices, data-deletion channels, and compliance with local laws and regulations;
- If you operate the service publicly, determine for yourself whether filing, licensing, a privacy policy, or other compliance documentation is required;
- Do not expose an unhardened service directly to the public internet;
- Any losses caused by deployment, operation, data loss, service interruption, or security incidents are borne by the deployer.

### Disclaimer

This project is provided **“as is”**, without any express or implied warranty, including but not limited to merchantability, fitness for a particular purpose, non-infringement, continued availability, and error-free operation.

To the maximum extent permitted by applicable law, the authors and contributors are not liable for any direct, indirect, incidental, special, or consequential damages arising from the use of, or the inability to use, this project, including but not limited to data loss, service interruption, equipment damage, loss of profits, or legal disputes.

**Commercial use of this project is prohibited.** Before public operation, commercial deployment, or redistribution, any organization or individual should independently assess and bear full legal and compliance responsibility.

## Acknowledgments

- Thanks to [setube](https://github.com/setube) for creating and open-sourcing [ogame-vue-ts](https://github.com/setube/ogame-vue-ts); all of this project's derivative work builds on that work;
- Thanks to the upstream project's past contributors and community players;
- Thanks to [OGame](https://ogame.org) for the classic space strategy experience;
- Thanks to Vue, Vite, Pinia, Tailwind CSS, shadcn-vue, reka-ui, Lucide, Node.js, ws, and the contributors behind these open-source projects.

---

<div align="center">

**OGame Vue TS · Multiplayer Rework**

Original author: [setube](https://github.com/setube)<br>
Maintainer of this version: [shilianlvke](https://gitee.com/shilianlvke)

<sub>Unofficial project · Non-commercial use only · CC BY-NC 4.0</sub>

</div>
