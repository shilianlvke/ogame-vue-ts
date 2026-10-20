<div align="center">

<img src="../public/logo.svg" alt="Logo von OGame Vue TS" width="128" height="128" />

# OGame Vue TS

**Mehrspieler-Neuentwicklung · Multiplayer Rework**

Ein Weltraum-Strategiespiel im OGame-Stil, neu umgesetzt mit Vue 3 + TypeScript

Hauptrepository: [Gitee](https://gitee.com/shilianlvke/ogame-vue-ts) · Mirror: [GitHub](https://github.com/shilianlvke/ogame-vue-ts)

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey?style=flat-square)](https://creativecommons.org/licenses/by-nc/4.0)
[![Docker: fnOS](https://img.shields.io/badge/Deploy-fnOS%20Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](DEPLOY_DOCKER.md)

[简体中文](../README.md) | [繁體中文](README-zh-TW.md) | [English](README-EN.md) | Deutsch | [Русский](README-RU.md) | [Español](README-ES.md) | [한국어](README-KO.md) | [日本語](README-JA.md)

<sub>Andere Sprachfassungen können hinter der vereinfachten chinesischen Fassung zurückliegen; maßgeblich ist die vereinfachte chinesische Fassung.</sub>

</div>

> **Wichtiger Hinweis**
>
> Dieses Projekt ist eine **inoffizielle Weiterentwicklung** von [setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts) und kein offizieller Branch des Upstream-Projekts. Es wurde weder von der Gameforge AG noch von den offiziellen OGame-Verantwortlichen autorisiert, anerkannt oder gebilligt.
>
> Dieses Projekt dient ausschließlich Lern- und Forschungszwecken sowie der privaten Unterhaltung. **Jede Form kommerzieller Nutzung ist untersagt.** Die vollständige Erklärung findest du unter [Herkunft, Lizenz und rechtliche Hinweise](#herkunft-lizenz-und-rechtliche-hinweise).

---

## Inhaltsverzeichnis

- [Projektvorstellung](#projektvorstellung)
- [Funktionshighlights](#funktionshighlights)
- [Architektur: Einzelspieler und Mehrspieler](#architektur-einzelspieler-und-mehrspieler)
- [Technologie-Stack](#technologie-stack)
- [Schnellstart](#schnellstart)
- [Online-Deployment](#online-deployment)
- [Projektstruktur](#projektstruktur)
- [Wichtige Skripte](#wichtige-skripte)
- [Tests und Qualitätssicherung](#tests-und-qualitätssicherung)
- [Entwicklungsstand](#entwicklungsstand)
- [Dokumentation](#dokumentation)
- [Mitwirken](#mitwirken)
- [Herkunft, Lizenz und rechtliche Hinweise](#herkunft-lizenz-und-rechtliche-hinweise)
- [Danksagung](#danksagung)

## Projektvorstellung

**OGame Vue TS · Mehrspieler-Neuentwicklung** ist ein Weltraum-Strategiespiel, das durch Weiterentwicklung aus dem Open-Source-Projekt [ogame-vue-ts](https://github.com/setube/ogame-vue-ts) des ursprünglichen Autors [setube](https://github.com/setube) hervorgegangen ist.

Dieses Projekt bewahrt das Einzelspieler-Gameplay und das zentrale Zahlen- und Balancesystem des Originals. Darauf aufbauend wurden die Mehrspielerarchitektur, die Benutzeroberfläche und die Interaktion, die Galaxieansicht, das Basissystem sowie die Bereitstellungswege umfassend umgebaut und erweitert.

Die aktuelle Version bietet zwei Betriebsmodi:

- **Einzelspielermodus**: Der Spielkern läuft im Browser, der Spielstand wird lokal gespeichert, und das Spiel ist sofort spielbar;
- **Mehrspielermodus**: Ein Node.js-WebSocket-Server fungiert als einzige autoritative Zustandsquelle und unterstützt Konten, mehrere Spieler auf einem Server, PvP, Chat, Ranglisten sowie eine NPC-Ökologie.

> Dieses Projekt pflegt derzeit ausschließlich die Bereitstellung über **Web-Client + fnOS-Docker**. Ältere Bereitstellungsformen wie Android, Electron und Go-Server wurden entfernt; der entsprechende Code ist in der Git-Historie einsehbar.

## Funktionshighlights

### Basis und Imperium

- Gebäude, Forschung, Werft und Verteidigung sind in einer gemeinsamen Basis zusammengeführt;
- Bau- und Forschungswarteschlangen, Slots für Flottenmissionen und Ressourcenverbrauch werden in Echtzeit abgerechnet;
- Mondbasen, Mondentstehung, Trümmerfelder und Recyclingmechanismen;
- Offizierssystem, Ressourcenboni, Imperiumspunkte und Verwaltung mehrerer Planeten.

### Flotten und Kampf

- Schiffsbau, Flottenzusammenstellung, Missionsentsendung und mehrstufige Flüge;
- Kampfsimulator, mit dem sich Flottenkonfigurationen prüfen lassen, bevor Ressourcen investiert werden;
- Kampfberichte, Beute, Trümmerfelder sowie die Abrechnung von Angriffen und Verteidigung;
- Eroberung von Sternentoren, Mautgebühren, Blockaden und NPC-Handelskarawanen.

### Diplomatie und NPC-Ökologie

- NPC-Beziehungen, Sympathiewerte, Handel, Geschenke, Geheimdienstinformationen und diplomatische Ereignisse;
- Spionage, Angriffe und Vergeltungsaktionen feindlicher NPCs;
- NPC-Wachstum, Wirtschaftsleistung und eine von mehreren Spielern gemeinsam genutzte Welt;
- Diplomatiebenachrichtigungen, Ereignisberichte und Filter nach Beziehungsstatus.

### Galaxie und Erkundung

- 2,5D-Sternenkarte im Vollbild mit drei Ansichtsebenen: Sternsystem, lokale Galaxie und galaktische Gesamtansicht;
- Zehn Planeten umkreisen langsam ihren Stern; Umlaufbahnen, Größen und Geschwindigkeiten sind zufällig;
- Ein Klick auf einen Planeten oder ein Sternsystem fokussiert das Objekt, die Kamera folgt und das Kontextpanel wird allmählich eingeblendet;
- Scans, Namensvergabe, Sternentore, unbekannte Signale, Wurmlöcher, Trümmerfelder und die Erkundung von Ruinenstätten;
- Ein zyklisches Universum mit 12 Durchläufen × 16 Sektoren × 64 Sternsystemen.

### Mehrspieler und langfristiger Betrieb

- Kontoregistrierung, Anmeldung, Sitzungen und Wiederverbindung nach Verbindungsabbrüchen;
- Eine serverseitig autoritative Welt; Clients synchronisieren sich über Befehle und Status-Patches;
- Spielerhandel, PvP, Spionage, Raketen, Flottenmissionen und Echtzeitbenachrichtigungen;
- Öffentlicher Chat, private Nachrichten, Online-Status, Ranglisten und Mechaniken für Saisons und Durchläufe;
- JSON-Spielstände auf dem Server, automatisches Speichern und Persistenz über Docker-Datenvolumes.

### Benutzererlebnis und Wartbarkeit

- 8 Sprachen: 简体中文, 繁體中文, English, Deutsch, Русский, Español, 한국어, 日本語;
- Dunkles und helles Design, responsives Layout und PWA;
- Persistenz des Einzelspieler-Spielstands in IndexedDB;
- Einheitliche Befehlsschicht, Headless-Kern und testbare Spielregelschicht;
- Ein-Klick-Bereitstellung mit fnOS-Docker und Image-Export.

## Architektur: Einzelspieler und Mehrspieler

```text
┌────────────────────────────────────────────────────┐
│                   Browser-Client                   │
│   Vue 3 + Pinia + Vue Router + Tailwind CSS        │
│   Die Ansichtsschicht sendet nur Befehle und       │
│   ändert den Weltzustand nicht direkt              │
└───────────────────────┬────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
  Einzelspielermodus         Mehrspielermodus
          │                           │
          ▼                           ▼
┌─────────────────────┐          WebSocket
│      src/core       │              │
│    Headless-Kern    │              ▼
│    tick/Befehle     │       Node.js-Server
│    Regeln/Status    │       server/ + ws
└──────────┬──────────┘              │
           │                         ▼
           ▼               Autoritative Serverwelt
      IndexedDB            data/world.json
```

- `src/core`: Headless-Spielkern, verantwortlich für Weltzustand, Ticks, Missionen, NPCs, Befehle und Protokoll;
- `src/logic`: reine Spielregeln und Zahlenberechnungen, weitgehend ohne UI-Abhängigkeiten;
- `server/`: Node.js-WebSocket-Server, Konten, Räume, Persistenz und Auslieferung statischer Dateien;
- `src/stores` / `src/views`: browserseitiger Zustand und Benutzeroberfläche;
- `scripts/`: Headless-Smoke-Tests, Server-Tests und Build-Skripte.

Der Einzelspielermodus verwendet den Headless-Kern direkt; im Mehrspielermodus führt der Server dieselbe Kernlogik aus, während der Client ausschließlich Befehle sendet und Snapshots rendert.

## Technologie-Stack

| Kategorie | Technologie |
|---|---|
| Frontend | Vue 3, TypeScript, Vite (Rolldown-Vite) |
| Zustandsverwaltung und Routing | Pinia, Vue Router 4 |
| UI | Tailwind CSS v4, shadcn-vue, reka-ui, Lucide |
| Animationen und Feedback | tw-animate-css, vue-sonner |
| Einzelspieler-Persistenz | IndexedDB |
| Mehrspieler-Server | Node.js 22, WebSocket (ws) |
| Bereitstellung | Docker, fnOS, statische Auslieferung mit Node |
| Qualitätssicherung | vue-tsc, Smoke-Tests der Headless-Engine, Server-Integrationstests, i18n-Prüfung |

## Schnellstart

### Voraussetzungen

- Node.js **22+**
- pnpm **10+**
- Moderner Browser (Chrome / Edge / Firefox / Safari)

### Klonen und Installation

```bash
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git
cd ogame-vue-ts
pnpm install
```

GitHub-Mirror:

```bash
git clone https://github.com/shilianlvke/ogame-vue-ts.git
```

### Lokale Entwicklung

```bash
pnpm dev
```

Standardmäßige Entwicklungsadresse:

```text
http://localhost:25121
```

### Produktions-Build

```bash
pnpm build
pnpm preview
```

`pnpm build` führt zuerst die TypeScript-Typprüfung aus und baut anschließend die statischen Frontend-Ressourcen nach `docs/`.

### Mehrspieler-Server lokal starten

```bash
# Frontend und Node-Server bauen
pnpm build
pnpm run build:node-server

# Server starten (liest standardmäßig docs/ und data/)
pnpm start:server
```

Der Standardport ist `25122` und kann über Umgebungsvariablen überschrieben werden:

```bash
PORT=8080 STATIC_DIR=docs DATA_DIR=data pnpm start:server
```

Nach dem Start des Servers:

- Spielseite: `http://localhost:25122`
- Health-Check: `http://localhost:25122/health`
- WebSocket: `ws://localhost:25122/ws`

> In Produktionsumgebungen sind HTTPS/WSS zu verwenden; Zugriffskontrolle, Datensicherung und Sicherheitshärtung sind selbst umzusetzen.

## Online-Deployment

Derzeit wird die Docker-Bereitstellung auf fnOS empfohlen.

### Variante 1: Ein-Klick-Bereitstellung aus dem Quellcode auf fnOS (empfohlen)

Voraussetzungen: Docker und Git sind auf fnOS installiert, und `node:22-alpine` kann abgerufen werden; alternativ ist ein Registry-Mirror konfiguriert.

```bash
cd /vol1/docker
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git ogame
cd ogame

chmod +x deploy-fnos.sh
./deploy-fnos.sh
```

Für spätere Aktualisierungen:

```bash
./deploy-fnos.sh --update
```

Weitere Befehle:

```bash
./deploy-fnos.sh --start
./deploy-fnos.sh --stop
./deploy-fnos.sh --restart
./deploy-fnos.sh --logs
./deploy-fnos.sh --status
./deploy-fnos.sh --port 8080
./deploy-fnos.sh --china
```

### Variante 2: Image auf dem Computer erstellen und importieren

Windows:

```powershell
.\docker-build.ps1
```

Das Skript erstellt `noskyman:latest` und exportiert `noskyman.tar`. Lade `noskyman.tar` und `docker-compose.yml` in dasselbe Verzeichnis auf fnOS hoch und führe dort aus:

```bash
docker load -i noskyman.tar
docker compose up -d
```

Hier findest du die vollständige Anleitung, die Umgebungsvariablen, die WebSocket-Konfiguration für den Reverse-Proxy und Antworten auf häufig gestellte Fragen:

- [fnOS-Docker-Bereitstellungsdokumentation](DEPLOY_DOCKER.md)

> `docker-compose.yml` verwendet ausschließlich das lokale Image `noskyman:latest` und lädt es nicht aktiv aus dem Internet; der Build aus dem Quellcode erfolgt durch `deploy-fnos.sh`.

## Projektstruktur

```text
.
├── src/
│   ├── core/          # Headless-Spielkern: Welt, Ticks, Befehle, Missionen, NPCs, Protokoll
│   ├── logic/         # reine Spielregeln und Zahlenberechnungen
│   ├── components/    # Vue-Komponenten
│   ├── views/         # Seitenansichten
│   ├── stores/        # Pinia-Zustand
│   ├── locales/       # Texte in 8 Sprachen
│   ├── services/      # Dienste für Spielstände, Updates, WebDAV und mehr
│   └── workers/       # Kampf-Worker
├── server/            # Node.js-WebSocket-Server
├── scripts/           # Build, i18n, Headless-/Server-Smoke-Tests
├── doc/               # Dokumentation zu Deployment, Mehrspieler, Galaxiedesign und Referenzen
├── public/            # statische Ressourcen
├── Dockerfile         # mehrstufiges Image für Frontend und Node-Server
├── docker-compose.yml # fnOS-Laufzeitkonfiguration
├── deploy-fnos.sh     # Ein-Klick-Bereitstellungsskript für fnOS
└── docker-build.ps1   # Build und Image-Export unter Windows
```

## Wichtige Skripte

| Befehl | Beschreibung |
|---|---|
| `pnpm dev` | Startet den Vite-Entwicklungsserver |
| `pnpm build` | Typprüfung und Build des Frontends nach `docs/` |
| `pnpm preview` | Zeigt den Produktions-Build als Vorschau an |
| `pnpm typecheck` | TypeScript-Typprüfung |
| `pnpm check:i18n` | Prüft die Schlüssel der 8 Sprachpakete |
| `pnpm test` | Typprüfung + i18n + alle Headless-/Server-Smoke-Tests |
| `pnpm smoke` | Smoke-Tests der Headless-Engine |
| `pnpm smoke:server` | Integrationstests gegen einen echten WebSocket-Server |
| `pnpm build:node-server` | Baut den Node-Server nach `server-dist/` |
| `pnpm dev:server` | Baut den lokalen Node-Server und startet ihn |
| `pnpm start:server` | Startet den bereits gebauten Node-Server |

## Tests und Qualitätssicherung

```bash
pnpm typecheck
pnpm check:i18n
pnpm test
```

`pnpm test` deckt ab:

- die Headless-Spielengine;
- die Geltungsbereiche der Durchläufe;
- Umfang, Determinismus, Layout und Konnektivität der Sternenkarte;
- Konten mit maximaler Stufe und Kampagnenabläufe;
- serverseitige Anmeldung, Sichtbarkeit, Befehle, Patches, Ticks, Spielstände und Wiederverbindung;
- Client-Synchronisierung und echte WebSocket-Verbindungen.

## Entwicklungsstand

Das Projekt wird fortlaufend weiterentwickelt; Benutzeroberfläche, Spielbalance, Netzwerkprotokoll und Spielstandstruktur können sich weiterhin ändern.

Vor einem Upgrade unbedingt eine Sicherung anlegen:

- Einzelspieler-Spielstand: lokale Browserdaten;
- Mehrspieler-Spielstand: `data/world.json` auf dem Server;
- Docker-Bereitstellung: das eingebundene Verzeichnis `./data`.

Fortschritt und Designnotizen zum Umbau des Galaxiesystems:

- [Galaxiestatus – Übersicht](GALAXY_STATUS.md)
- [Neugestaltung der Galaxie](GALAXY_REDESIGN.md)
- [Design der Sternenkarte](GALAXY_MAP_DESIGN.md)
- [Durchläufe und Zyklen](GALAXY_CYCLES.md)
- [Mehrspieler-Architektur](MULTIPLAYER.md)

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [Docker-Bereitstellung auf fnOS](DEPLOY_DOCKER.md) | Ein-Klick-Bereitstellung, Image-Import, Umgebungsvariablen und Reverse-Proxy für fnOS |
| [Mehrspieler-Architektur](MULTIPLAYER.md) | Headless-Kern, Befehlsschicht, Server und Synchronisierungsprotokoll |
| [Spielreferenz](ogame-reference.md) | Daten zu Gebäuden, Technologien, Schiffen, Verteidigung und Offizieren |
| [Galaxiestatus](GALAXY_STATUS.md) | Phasen des Galaxieumbaus und Abnahmestatus |

## Mitwirken

Issues und Pull Requests sind willkommen. Bitte beachte jedoch vorab:

1. **Melde Probleme mit diesem Projekt nicht im Upstream-Repository.** Der Upstream-Autor ist für diese Weiterentwicklung nicht verantwortlich.
2. Mit dem Einreichen von Code stimmst du zu, dass dein Beitrag unter der CC BY-NC 4.0-Lizenz dieses Projekts veröffentlicht wird.
3. Entferne oder schwäche weder die Hinweise auf die Urheberschaft des Upstream-Projekts noch den Lizenzlink oder die Änderungshinweise.
4. Reiche weder kommerzielle Lizenzangebote noch kostenpflichtige Dienste noch irreführende Inhalte mit Bezug zum offiziellen OGame ein.
5. Ergänze bei Änderungen an Mehrspielerfunktionen, Sicherheit oder Spielstandformaten bitte auch Tests und Dokumentation.

Probleme und Feedback bitte an:

- Gitee: <https://gitee.com/shilianlvke/ogame-vue-ts>
- GitHub: <https://github.com/shilianlvke/ogame-vue-ts>

## Herkunft, Lizenz und rechtliche Hinweise

> Dieser Abschnitt erläutert die Herkunft des Projekts, die Lizenzierung und die grundlegende Position. Er stellt keine Rechtsberatung dar. Bei kommerzieller Nutzung, öffentlichem Betrieb, Weitergabe oder umfangreicher Bereitstellung solltest du fachkundigen Rechtsrat einholen.

### Upstream-Projekt und Weiterentwicklung

- **Upstream-Projekt**: [setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts)
- **Upstream-Autor**: [setube](https://github.com/setube)
- **Dieses Projekt**: eine von [shilianlvke](https://gitee.com/shilianlvke) gepflegte Weiterentwicklung

Dieses Projekt basiert auf dem Upstream-Projekt und nimmt daran Änderungen vor; der konkrete Umfang der Änderungen ergibt sich aus der Git-Historie dieses Repositories. Zu den wesentlichen Änderungen gehören unter anderem:

- Mehrspielerarchitektur, Node.js-WebSocket-Server, Konten und Synchronisierung zwischen mehreren Spielern;
- Neugestaltung der Benutzeroberfläche sowie der Seiten für Basis, Flotte, Diplomatie, Rangliste, Nachrichten und weitere Bereiche;
- Vollbild-2,5D-Galaxieansicht mit Fokusinteraktion;
- Gameplay-Erweiterungen wie Galaxie, Durchläufe, Sternentore und unbekannte Signale;
- Docker-/fnOS-Bereitstellung;
- Entfernung älterer Bereitstellungsformen wie Android, Electron und Go-Server.

Diese Version ist dem Upstream-Autor nicht unterstellt; es besteht keine Zusammenarbeit, kein Sponsoring und keine Billigung. Der Upstream-Autor ist nicht verantwortlich für den Code, die Bereitstellung, den Betrieb oder jegliche Folgen dieser Version.

### Lizenz

Dieses Projekt steht unter derselben Lizenz wie das Upstream-Projekt:

**[Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/)** · [Lizenzdatei](../LICENSE)

Für dieses Projekt wird **keine kommerzielle Lizenzierung** angeboten. Wer den betreffenden Code oder die Inhalte für kommerzielle Zwecke nutzen möchte, darf dieses Projekt nicht verwenden.

Du darfst:

- **Teilen**: das Werk in jedem Medium oder Format vervielfältigen und weiterverbreiten;
- **Bearbeiten**: das Werk remixen, verändern und darauf aufbauen.

Unter folgenden Bedingungen:

- **Namensnennung**: Du musst den Upstream-Autor und den Autor dieses Projekts nennen, den Link zur Lizenz beibehalten und vorgenommene Änderungen kennzeichnen; es darf nicht der Eindruck erweckt werden, die Autoren würden dich oder deine Nutzung unterstützen;
- **Nicht kommerziell**: Du darfst das Projekt nicht für kommerzielle Zwecke nutzen;
- **Keine zusätzlichen Beschränkungen**: Du darfst keine rechtlichen Bedingungen oder technischen Maßnahmen einsetzen, um anderen die Ausübung der durch die Lizenz erlaubten Rechte einzuschränken.

Der in diesem Repository von diesem Projekt neu hinzugefügte Code und die neu hinzugefügten Dokumente werden, sofern nicht anders angegeben, ebenfalls unter CC BY-NC 4.0 veröffentlicht. Abhängigkeiten, Icons, Schriften, Marken und sonstige Inhalte Dritter verbleiben im Eigentum der jeweiligen Rechteinhaber und unterliegen deren jeweiligen Lizenzen.

### Marken und offizieller Bezug

- **OGame** sowie die zugehörigen Namen, Marken und Spielinhalte sind Eigentum der **Gameforge AG** oder der jeweiligen Rechteinhaber.
- Dieses Projekt ist ein unabhängiges, inoffizielles Fanprojekt mit technischem Schwerpunkt. Es steht in keiner Verbindung zur Gameforge AG oder zum offiziellen OGame-Team. Weder die Gameforge AG noch das offizielle OGame-Team haben dieses Projekt autorisiert, gesponsert oder gebilligt.
- Die Verwendung des Namens OGame in diesem Projekt dient ausschließlich der Beschreibung des Spielgenres und der Würdigung der Inspirationsquelle; es werden keine Markenrechte geltend gemacht.
- Sollten Rechteinhaber der Auffassung sein, dass Inhalte dieses Projekts ihre Rechte verletzen, können sie sich über ein Issue in diesem Repository an die Projektverantwortlichen wenden; wir werden uns zeitnah darum kümmern.

### Online-Betrieb und Datenverantwortung

- Im Einzelspielermodus wird der Spielstand lokal im Browser der Nutzenden gespeichert;
- Im Mehrspielermodus werden Welt- und Kontodaten in `data/world.json` auf dem Server gespeichert; außerdem können Spielerinhalte wie Chats und Kampfberichte verarbeitet werden;
- Betreiber sind selbst für die Serversicherheit, die Zugriffskontrolle, die Datensicherung, Datenschutzhinweise, Wege zur Datenlöschung sowie die Einhaltung der geltenden lokalen Rechtsvorschriften verantwortlich;
- Wer das Spiel öffentlich betreibt, muss selbst prüfen, ob eine behördliche Registrierung, eine Genehmigung, eine Datenschutzerklärung oder weitere Compliance-Unterlagen erforderlich sind;
- Ein nicht ausreichend gehärteter Dienst darf nicht unmittelbar öffentlich zugänglich gemacht werden;
- Verluste, die durch Bereitstellung, Betrieb, Datenverlust, Dienstunterbrechungen oder Sicherheitsvorfälle entstehen, trägt der Betreiber.

### Haftungsausschluss

Dieses Projekt wird **„wie besehen“** („as is“) bereitgestellt. Es wird keine ausdrückliche oder stillschweigende Gewährleistung übernommen, einschließlich, aber nicht beschränkt auf Marktgängigkeit, Eignung für einen bestimmten Zweck, Nichtverletzung von Rechten Dritter, ununterbrochene Verfügbarkeit und fehlerfreien Betrieb.

Im größtmöglichen nach geltendem Recht zulässigen Umfang haften die Autoren und Mitwirkenden nicht für direkte, indirekte, beiläufige, besondere oder Folgeschäden, die aus der Nutzung oder Nichtnutzbarkeit dieses Projekts entstehen, einschließlich, aber nicht beschränkt auf Datenverlust, Dienstunterbrechungen, Geräteschäden, entgangenen Gewinn oder Rechtsstreitigkeiten.

**Dieses Projekt darf nicht kommerziell genutzt werden.** Jede Organisation und jede Person hat vor einem öffentlichen Betrieb, einer kommerziellen Bereitstellung oder einer Weitergabe die rechtlichen und Compliance-Anforderungen eigenständig zu bewerten und die volle Verantwortung dafür zu tragen.

## Danksagung

- Dank an [setube](https://github.com/setube) für die Entwicklung und Open-Source-Veröffentlichung von [ogame-vue-ts](https://github.com/setube/ogame-vue-ts); sämtliche Weiterentwicklungen in diesem Projekt bauen auf dieser Arbeit auf;
- Dank an die früheren Mitwirkenden des Upstream-Projekts und an die Spielerinnen und Spieler der Community;
- Dank an [OGame](https://ogame.org) für das klassische Weltraum-Strategieerlebnis;
- Dank an die Open-Source-Projekte Vue, Vite, Pinia, Tailwind CSS, shadcn-vue, reka-ui, Lucide, Node.js und ws sowie an ihre Mitwirkenden.

---

<div align="center">

**OGame Vue TS · Mehrspieler-Neuentwicklung**

Originalautor: [setube](https://github.com/setube)<br>
Wartung dieser Version: [shilianlvke](https://gitee.com/shilianlvke)

<sub>Inoffizielles Projekt · Nur für nichtkommerzielle Nutzung · CC BY-NC 4.0</sub>

</div>
