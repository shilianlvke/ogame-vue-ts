<div align="center">

<img src="../public/logo.svg" alt="Logotipo de OGame Vue TS" width="128" height="128" />

# OGame Vue TS

**Versión multijugador reconstruida · Multiplayer Rework**

Un juego de estrategia espacial al estilo OGame reescrito con Vue 3 + TypeScript

Repositorio principal: [Gitee](https://gitee.com/shilianlvke/ogame-vue-ts) · Espejo: [GitHub](https://github.com/shilianlvke/ogame-vue-ts)

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey?style=flat-square)](https://creativecommons.org/licenses/by-nc/4.0)
[![Docker: fnOS](https://img.shields.io/badge/Deploy-fnOS%20Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](DEPLOY_DOCKER.md)

[简体中文](../README.md) | [繁體中文](README-zh-TW.md) | [English](README-EN.md) | [Deutsch](README-DE.md) | [Русский](README-RU.md) | Español | [한국어](README-KO.md) | [日本語](README-JA.md)

<sub>Las versiones en otros idiomas pueden estar desactualizadas respecto de la versión en chino simplificado; en caso de discrepancia, prevalece esta última.</sub>

</div>

> **Aviso importante**
>
> Este proyecto es una **versión de desarrollo derivada no oficial** de [setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts). No es una rama oficial del proyecto original y no está afiliado a Gameforge AG ni al OGame oficial, ni cuenta con su autorización, aprobación o respaldo.
>
> Este proyecto se ofrece únicamente con fines de aprendizaje, investigación y entretenimiento personal, y **se prohíbe cualquier forma de uso comercial**. Consulta la declaración completa en [Origen, licencia y avisos legales](#origen-licencia-y-avisos-legales).

---

## Índice

- [Introducción al proyecto](#introducción-al-proyecto)
- [Funciones destacadas](#funciones-destacadas)
- [Arquitectura para un jugador y en línea](#arquitectura-para-un-jugador-y-en-línea)
- [Stack tecnológico](#stack-tecnológico)
- [Inicio rápido](#inicio-rápido)
- [Despliegue del modo en línea](#despliegue-del-modo-en-línea)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Scripts habituales](#scripts-habituales)
- [Pruebas y calidad](#pruebas-y-calidad)
- [Estado del desarrollo](#estado-del-desarrollo)
- [Documentación](#documentación)
- [Cómo contribuir](#cómo-contribuir)
- [Origen, licencia y avisos legales](#origen-licencia-y-avisos-legales)
- [Agradecimientos](#agradecimientos)

## Introducción al proyecto

**OGame Vue TS · Versión multijugador reconstruida** es un juego de estrategia espacial desarrollado de forma derivada a partir del proyecto de código abierto [ogame-vue-ts](https://github.com/setube/ogame-vue-ts), del autor original [setube](https://github.com/setube).

Este proyecto conserva el modo de juego para un jugador y el sistema de valores centrales del original y, sobre esa base, ha reconstruido y ampliado de forma considerable la arquitectura en línea, la interacción de la interfaz, la vista de la galaxia, el sistema de bases y las formas de despliegue, entre otros aspectos.

La versión actual ofrece dos modos de funcionamiento:

- **Modo para un jugador**: el núcleo del juego se ejecuta en el navegador, las partidas se guardan localmente y puedes empezar a jugar de inmediato;
- **Modo en línea**: un servidor Node.js con WebSocket actúa como única fuente autoritativa del estado y admite cuentas, varios jugadores en un mismo servidor, PvP, chat, clasificaciones y un ecosistema de NPC.

> Actualmente, el proyecto solo mantiene la forma de despliegue **Web + Docker en fnOS**. Las antiguas formas de despliegue, como Android, Electron y el servidor en Go, se han eliminado; el código correspondiente puede consultarse en el historial de Git.

## Funciones destacadas

### Gestión de bases e imperios

- Los módulos de edificios, investigación, astillero y defensa se integran en una única base;
- Colas de construcción y de investigación, ranuras de misiones de flota y liquidación del consumo de recursos en tiempo real;
- Base lunar, generación de lunas, campos de escombros y mecánica de reciclaje;
- Sistema de oficiales, bonificaciones de recursos, puntos de imperio y gestión de múltiples planetas.

### Flotas y combate

- Construcción de naves, composición de flotas, envío de misiones y travesías en varias etapas;
- Simulador de combate para comprobar la configuración de la flota antes de invertir recursos;
- Informes de batalla, botín, campos de escombros y resolución de ataques y defensas;
- Ocupación de puertas estelares, peajes, bloqueos y caravanas de NPC.

### Diplomacia y ecosistema de NPC

- Relaciones con los NPC, afinidad, comercio, obsequios, inteligencia y eventos diplomáticos;
- Reconocimiento, ataque y venganza por parte de NPC hostiles;
- Crecimiento de los NPC, producción económica y un mundo compartido entre varios jugadores;
- Notificaciones diplomáticas, informes de eventos y filtros por estado de las relaciones.

### Galaxia y exploración

- Mapa estelar 2.5D a pantalla completa con tres niveles de vista: sistema estelar, galaxia local y panorama galáctico;
- 10 planetas que orbitan lentamente alrededor de la estrella, con órbitas, tamaños y velocidades aleatorios;
- Enfoque al hacer clic en un planeta o sistema estelar, seguimiento de la cámara y aparición gradual de paneles contextuales;
- Escaneo, asignación de nombres, puertas estelares, señales desconocidas, agujeros de gusano, restos y exploración de ruinas;
- Universo cíclico de 12 ciclos × 16 regiones estelares × 64 sistemas estelares.

### Modo en línea y operación a largo plazo

- Registro de cuentas, inicio de sesión, sesiones y reconexión tras una desconexión;
- Mundo autoritativo en el servidor; el cliente se sincroniza mediante comandos y parches de estado;
- Comercio entre jugadores, PvP, reconocimiento, misiles, misiones de flota y notificaciones en tiempo real;
- Chat público, mensajes privados, estado en línea, clasificaciones y mecánicas de temporadas y ciclos;
- Guardado del servidor en JSON, autoguardado y persistencia mediante volúmenes de datos de Docker.

### Experiencia y mantenibilidad

- 8 idiomas: chino simplificado, chino tradicional, inglés, alemán, ruso, español, coreano y japonés;
- Temas claro y oscuro, diseño adaptable y PWA;
- Persistencia de las partidas para un jugador en IndexedDB;
- Capa de comandos unificada, núcleo sin interfaz y capa de reglas del juego comprobable;
- Despliegue con un solo comando en Docker sobre fnOS y exportación de imágenes.

## Arquitectura para un jugador y en línea

```text
┌──────────────────────────────────────────────┐
│             Cliente del navegador            │
│  Vue 3 + Pinia + Vue Router + Tailwind CSS   │
│  La vista solo envía comandos y no modifica  │
│  directamente el estado del mundo            │
└──────────────────────┬───────────────────────┘
                       │
             ┌─────────┴─────────┐
             │                   │
      Modo un jugador      Modo en línea
             │                   │
             ▼                   ▼
   ┌───────────────────┐     WebSocket
   │     src/core      │         │
   │  Núcleo de juego  │         ▼
   │   sin interfaz    │  Servidor Node.js
   │  tick / comandos  │  server/ + ws
   │  reglas / estado  │         │
   └─────────┬─────────┘         ▼
             │          Mundo autoritativo
             ▼          del servidor
         IndexedDB      data/world.json
```

- `src/core`: núcleo del juego sin interfaz; gestiona el estado del mundo, los ticks, las misiones, los NPC, los comandos y el protocolo;
- `src/logic`: reglas puras del juego y cálculos numéricos, con la menor dependencia posible de la interfaz;
- `server/`: servidor Node.js con WebSocket, cuentas, salas, persistencia y alojamiento de recursos estáticos;
- `src/stores` / `src/views`: estado e interfaz del lado del navegador;
- `scripts/`: pruebas de humo sin interfaz, pruebas del servidor y scripts de compilación.

El modo para un jugador reutiliza directamente el núcleo sin interfaz; en el modo en línea, el servidor ejecuta esa misma lógica central y el cliente solo se encarga de enviar comandos y renderizar las instantáneas.

## Stack tecnológico

| Categoría | Tecnología |
|---|---|
| Frontend | Vue 3, TypeScript, Vite (Rolldown-Vite) |
| Estado y enrutamiento | Pinia, Vue Router 4 |
| UI | Tailwind CSS v4, shadcn-vue, reka-ui, Lucide |
| Animaciones y retroalimentación | tw-animate-css, vue-sonner |
| Persistencia para un jugador | IndexedDB |
| Servidor en línea | Node.js 22, WebSocket (ws) |
| Despliegue | Docker, fnOS, alojamiento de recursos estáticos con Node |
| Aseguramiento de calidad | vue-tsc, pruebas de humo del motor sin interfaz, pruebas de integración del servidor, validación de i18n |

## Inicio rápido

### Requisitos del entorno

- Node.js **22+**
- pnpm **10+**
- Navegador moderno (Chrome / Edge / Firefox / Safari)

### Clonar e instalar

```bash
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git
cd ogame-vue-ts
pnpm install
```

Espejo en GitHub:

```bash
git clone https://github.com/shilianlvke/ogame-vue-ts.git
```

### Desarrollo local

```bash
pnpm dev
```

Dirección de desarrollo predeterminada:

```text
http://localhost:25121
```

### Compilación para producción

```bash
pnpm build
pnpm preview
```

`pnpm build` ejecuta primero la verificación de tipos de TypeScript y después compila los recursos estáticos del frontend en `docs/`.

### Ejecutar localmente el servidor del modo en línea

```bash
# Compilar el frontend y el servidor Node
pnpm build
pnpm run build:node-server

# Iniciar el servidor (por defecto lee docs/ y data/)
pnpm start:server
```

El puerto predeterminado es `25122` y puede sobrescribirse mediante variables de entorno:

```bash
PORT=8080 STATIC_DIR=docs DATA_DIR=data pnpm start:server
```

Una vez iniciado el servidor:

- Página del juego: `http://localhost:25122`
- Comprobación de estado: `http://localhost:25122/health`
- WebSocket: `ws://localhost:25122/ws`

> En producción, usa HTTPS/WSS y encárgate por tu cuenta del control de acceso, las copias de seguridad y el refuerzo de la seguridad.

## Despliegue del modo en línea

Actualmente se recomienda el despliegue con Docker en fnOS.

### Opción 1: despliegue en fnOS desde el código fuente con un solo comando (recomendado)

Requisitos previos: fnOS debe tener Docker y Git instalados y poder descargar la imagen `node:22-alpine`, o bien tener configurado un acelerador de imágenes.

```bash
cd /vol1/docker
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git ogame
cd ogame

chmod +x deploy-fnos.sh
./deploy-fnos.sh
```

Para actualizar más adelante:

```bash
./deploy-fnos.sh --update
```

Más comandos:

```bash
./deploy-fnos.sh --start
./deploy-fnos.sh --stop
./deploy-fnos.sh --restart
./deploy-fnos.sh --logs
./deploy-fnos.sh --status
./deploy-fnos.sh --port 8080
./deploy-fnos.sh --china
```

### Opción 2: compilar la imagen en tu computadora e importarla

Windows:

```powershell
.\docker-build.ps1
```

El script compila `noskyman:latest` y exporta `noskyman.tar`. Después de subir `noskyman.tar` y `docker-compose.yml` al mismo directorio en fnOS:

```bash
docker load -i noskyman.tar
docker compose up -d
```

Para consultar las instrucciones completas, las variables de entorno, la configuración del proxy inverso para WebSocket y las preguntas frecuentes:

- [Documentación de despliegue con Docker en fnOS](DEPLOY_DOCKER.md)

> `docker-compose.yml` solo utiliza la imagen local `noskyman:latest` y no descarga imágenes de Internet por sí mismo; la compilación desde el código fuente la realiza `deploy-fnos.sh`.

## Estructura del proyecto

```text
.
├── src/
│   ├── core/          # Núcleo del juego sin interfaz: mundo, tick, comandos, misiones, NPC, protocolo
│   ├── logic/         # Reglas puras del juego y cálculos numéricos
│   ├── components/    # Componentes de Vue
│   ├── views/         # Vistas de página
│   ├── stores/        # Estado de Pinia
│   ├── locales/       # Textos en 8 idiomas
│   ├── services/      # Servicios de guardado, actualización, WebDAV, etc.
│   └── workers/       # Worker de combate
├── server/            # Servidor Node.js con WebSocket
├── scripts/           # Compilación, i18n y pruebas de humo del núcleo y del servidor
├── doc/               # Documentación de despliegue, modo en línea, diseño de galaxias y referencias
├── public/            # Recursos estáticos
├── Dockerfile         # Imagen multietapa de frontend + servidor Node
├── docker-compose.yml # Configuración de ejecución en fnOS
├── deploy-fnos.sh     # Script de despliegue en fnOS con un solo comando
└── docker-build.ps1   # Compila y exporta la imagen en Windows
```

## Scripts habituales

| Comando | Descripción |
|---|---|
| `pnpm dev` | Inicia el servidor de desarrollo de Vite |
| `pnpm build` | Verifica los tipos y compila el frontend en `docs/` |
| `pnpm preview` | Previsualiza la compilación de producción |
| `pnpm typecheck` | Verifica los tipos de TypeScript |
| `pnpm check:i18n` | Valida las claves de los 8 paquetes de idioma |
| `pnpm test` | Verificación de tipos + i18n + todas las pruebas de humo del núcleo y del servidor |
| `pnpm smoke` | Prueba de humo del motor sin interfaz |
| `pnpm smoke:server` | Prueba de integración con un servidor WebSocket real |
| `pnpm build:node-server` | Compila el servidor Node en `server-dist/` |
| `pnpm dev:server` | Compila e inicia el servidor Node local |
| `pnpm start:server` | Inicia el servidor Node ya compilado |

## Pruebas y calidad

```bash
pnpm typecheck
pnpm check:i18n
pnpm test
```

`pnpm test` abarca:

- el motor de juego sin interfaz;
- el alcance de los ciclos;
- la escala, el determinismo, la disposición y la conectividad del mapa estelar;
- cuentas de nivel máximo y el flujo de la campaña;
- el inicio de sesión, la visibilidad, los comandos, los parches, el tick, el guardado y la reconexión del servidor;
- la sincronización del cliente y el enlace WebSocket real.

## Estado del desarrollo

El proyecto continúa en desarrollo, por lo que la interfaz, el equilibrio del juego, el protocolo de red y la estructura de guardado todavía pueden cambiar.

Asegúrate de hacer una copia de seguridad antes de actualizar:

- Partidas guardadas del modo para un jugador: datos locales del navegador;
- Partidas guardadas del modo en línea: `data/world.json` en el servidor;
- Despliegue con Docker: el directorio `./data` montado.

Progreso de la reconstrucción del sistema de galaxias y documentación de diseño:

- [Resumen del estado de las galaxias](GALAXY_STATUS.md)
- [Rediseño de la galaxia](GALAXY_REDESIGN.md)
- [Diseño del mapa estelar](GALAXY_MAP_DESIGN.md)
- [Ciclos y bucles](GALAXY_CYCLES.md)
- [Arquitectura en línea](MULTIPLAYER.md)

## Documentación

| Documento | Contenido |
|---|---|
| [Despliegue con Docker en fnOS](DEPLOY_DOCKER.md) | Despliegue en fnOS con un solo comando, importación de imágenes, variables de entorno y proxy inverso |
| [Arquitectura en línea](MULTIPLAYER.md) | Núcleo sin interfaz, capa de comandos, servidor y protocolo de sincronización |
| [Referencia del juego](ogame-reference.md) | Datos de edificios, tecnologías, naves, defensas y oficiales |
| [Estado de las galaxias](GALAXY_STATUS.md) | Fases de la reconstrucción de galaxias y estado de aceptación |

## Cómo contribuir

Puedes enviar issues y pull requests; antes de hacerlo, ten en cuenta lo siguiente:

1. **No reportes los problemas de este proyecto en el repositorio original.** El autor original no es responsable de esta versión de desarrollo derivada.
2. Al enviar código, aceptas que tu contribución se publique bajo la licencia CC BY-NC 4.0 de este proyecto.
3. No elimines ni debilites la atribución al proyecto original, el enlace a la licencia ni la descripción de los cambios.
4. No envíes contenido engañoso relacionado con licencias comerciales, servicios de pago o el OGame oficial.
5. Si realizas cambios en el modo en línea, la seguridad o el formato de guardado, añade también las pruebas y la documentación correspondientes.

Envía tus preguntas y comentarios a:

- Gitee: <https://gitee.com/shilianlvke/ogame-vue-ts>
- GitHub: <https://github.com/shilianlvke/ogame-vue-ts>

## Origen, licencia y avisos legales

> Esta sección explica el origen del proyecto, su licencia y su postura básica, y no constituye asesoramiento jurídico. Si vas a realizar un uso comercial, a operar el servicio públicamente, a redistribuir el proyecto o a desplegarlo a gran escala, consulta a un profesional del Derecho.

### Relación con el proyecto original y desarrollo derivado

- **Proyecto original**: [setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts)
- **Autor original**: [setube](https://github.com/setube)
- **Este proyecto**: versión de desarrollo derivada mantenida por [shilianlvke](https://gitee.com/shilianlvke)

Este proyecto se basa en el proyecto original y lo modifica. El alcance exacto de las modificaciones se determina conforme al historial de Git de este repositorio. Los principales cambios incluyen, entre otros:

- arquitectura en línea, servidor Node.js con WebSocket, cuentas y sincronización multijugador;
- reconstrucción de las páginas de la interfaz, la base, la flota, la diplomacia, las clasificaciones y los mensajes;
- vista de galaxia 2.5D a pantalla completa e interacción mediante enfoque;
- ampliaciones jugables: galaxias, ciclos, puertas estelares y señales desconocidas;
- despliegue con Docker y fnOS;
- eliminación de formas de despliegue antiguas como Android, Electron y el servidor en Go.

Esta versión no mantiene ninguna relación de subordinación, colaboración, patrocinio o respaldo con el autor original. El autor original no es responsable del código, el despliegue, la operación ni de ninguna consecuencia de esta versión.

### Licencia

Este proyecto adopta la misma licencia que el proyecto original:

**[Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/)** · [Archivo de la licencia](../LICENSE)

Este proyecto **no concede ningún tipo de autorización comercial**. Si deseas utilizar el código o el contenido con fines comerciales, no uses este proyecto.

Puedes:

- **Compartir**: copiar y redistribuir el proyecto en cualquier medio o formato;
- **Adaptar**: modificar, transformar y crear a partir del proyecto.

Pero debes cumplir las siguientes condiciones:

- **Atribución**: conserva la atribución al autor original y al autor de este proyecto, el enlace a la licencia y la indicación de los cambios, y no sugieras que los autores te respaldan a ti o a tu uso;
- **Uso no comercial**: no puedes utilizar este proyecto con fines comerciales;
- **Sin restricciones adicionales**: no puedes imponer condiciones legales ni medidas tecnológicas que impidan a otras personas ejercer los derechos que permite la licencia.

Salvo que se indique lo contrario, el código y la documentación añadidos por este proyecto a este repositorio se publican asimismo bajo CC BY-NC 4.0. Las dependencias, los iconos, las fuentes, las marcas y el resto de contenido de terceros siguen perteneciendo a sus respectivos titulares y se rigen por sus propias licencias.

### Marcas y relación con el proyecto oficial

- **OGame** y los nombres, marcas y contenidos de juego relacionados pertenecen a **Gameforge AG** o a sus titulares de derechos.
- Este es un proyecto técnico independiente, no oficial y hecho por fans, y no tiene ningún vínculo con Gameforge AG ni con el equipo oficial de OGame, ni cuenta con su autorización, patrocinio o respaldo.
- El uso del nombre OGame en este proyecto se limita a describir el género del juego y a rendir homenaje a su origen; este proyecto no reclama ningún derecho de marca.
- Si algún titular de derechos considera que el contenido de este proyecto infringe sus derechos legítimos, puede contactar a los mantenedores mediante un issue en este repositorio; atenderemos el asunto sin demora.

### Operación en línea y responsabilidad sobre los datos

- Las partidas del modo para un jugador se guardan localmente en el navegador del usuario;
- El modo en línea guarda en el servidor el mundo y los datos de las cuentas en `data/world.json`, y puede tratar contenido generado por los jugadores, como chats e informes de batalla;
- Quien despliegue el proyecto es responsable de la seguridad del servidor, el control de acceso, las copias de seguridad, el aviso de privacidad, los canales para la eliminación de datos y el cumplimiento de la legislación local;
- Si se opera públicamente, corresponde al operador confirmar si necesita registro, autorizaciones, política de privacidad u otros documentos de cumplimiento normativo;
- No expongas directamente a Internet servicios que no estén debidamente protegidos;
- Las pérdidas derivadas del despliegue, de la operación, de la pérdida de datos, de las interrupciones del servicio o de los incidentes de seguridad corren por cuenta de quien despliegue el proyecto.

### Exclusión de garantías y limitación de responsabilidad

Este proyecto se proporciona **«tal cual»**, sin garantías de ningún tipo, expresas ni implícitas, incluidas, entre otras, las de comerciabilidad, idoneidad para un fin determinado, no infracción, disponibilidad continua y funcionamiento sin errores.

En la máxima medida permitida por la legislación aplicable, los autores y colaboradores no serán responsables de ningún daño directo, indirecto, incidental, especial o consecuente que se derive del uso o de la imposibilidad de uso de este proyecto, incluidos, entre otros, la pérdida de datos, la interrupción del servicio, los daños en los equipos, la pérdida de ganancias o los litigios.

**Este proyecto prohíbe el uso comercial.** Toda organización o persona que vaya a operarlo públicamente, desplegarlo con fines comerciales o redistribuirlo debe evaluar por su cuenta y asumir toda la responsabilidad jurídica y de cumplimiento normativo.

## Agradecimientos

- Gracias a [setube](https://github.com/setube) por crear y publicar como código abierto [ogame-vue-ts](https://github.com/setube/ogame-vue-ts); todo el desarrollo derivado de este proyecto se basa en su trabajo;
- Gracias a los colaboradores históricos del proyecto original y a los jugadores de la comunidad;
- Gracias a [OGame](https://ogame.org) por la clásica experiencia de estrategia espacial;
- Gracias a los proyectos de código abierto Vue, Vite, Pinia, Tailwind CSS, shadcn-vue, reka-ui, Lucide, Node.js y ws, así como a sus colaboradores.

---

<div align="center">

**OGame Vue TS · Versión multijugador reconstruida**

Autor de la versión original: [setube](https://github.com/setube)<br>
Mantenimiento de esta versión: [shilianlvke](https://gitee.com/shilianlvke)

<sub>Proyecto no oficial · Solo para uso no comercial · CC BY-NC 4.0</sub>

</div>
