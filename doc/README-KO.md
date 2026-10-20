<div align="center">

<img src="../public/logo.svg" alt="OGame Vue TS 로고" width="128" height="128" />

# OGame Vue TS

**멀티플레이 리워크 · Multiplayer Rework**

Vue 3 + TypeScript로 재작성한 OGame 스타일 우주 전략 게임

메인 저장소: [Gitee](https://gitee.com/shilianlvke/ogame-vue-ts) · 미러: [GitHub](https://github.com/shilianlvke/ogame-vue-ts)

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey?style=flat-square)](https://creativecommons.org/licenses/by-nc/4.0)
[![Docker: fnOS](https://img.shields.io/badge/Deploy-fnOS%20Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](DEPLOY_DOCKER.md)

[简体中文](../README.md) | [繁體中文](README-zh-TW.md) | [English](README-EN.md) | [Deutsch](README-DE.md) | [Русский](README-RU.md) | [Español](README-ES.md) | 한국어 | [日本語](README-JA.md)

<sub>다른 언어 버전은 중국어 간체 버전보다 늦을 수 있으며, 내용은 이 페이지를 기준으로 합니다.</sub>

</div>

> **중요 고지**
>
> 이 프로젝트는 [setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts)의 **비공식 2차 개발 버전**으로, 업스트림 프로젝트의 공식 브랜치가 아니며, Gameforge AG 또는 OGame 공식 팀과 제휴하거나 이들로부터 허가, 승인 또는 보증을 받지 않았습니다.
>
> 이 프로젝트는 학습, 연구 및 개인적 오락 목적으로만 사용되며, **어떤 형태의 상업적 사용도 금지됩니다**. 전체 고지는 [출처, 라이선스 및 법적 고지](#출처-라이선스-및-법적-고지)를 참조하십시오.

---

## 목차

- [프로젝트 소개](#프로젝트-소개)
- [주요 기능](#주요-기능)
- [싱글 플레이 및 멀티플레이 아키텍처](#싱글-플레이-및-멀티플레이-아키텍처)
- [기술 스택](#기술-스택)
- [빠른 시작](#빠른-시작)
- [멀티플레이 배포](#멀티플레이-배포)
- [프로젝트 구조](#프로젝트-구조)
- [주요 스크립트](#주요-스크립트)
- [테스트와 품질](#테스트와-품질)
- [개발 상태](#개발-상태)
- [문서](#문서)
- [기여하기](#기여하기)
- [출처, 라이선스 및 법적 고지](#출처-라이선스-및-법적-고지)
- [감사의 말](#감사의-말)

## 프로젝트 소개

**OGame Vue TS · 멀티플레이 리워크**는 원작자 [setube](https://github.com/setube)의 오픈 소스 프로젝트 [ogame-vue-ts](https://github.com/setube/ogame-vue-ts)를 기반으로 2차 개발한 우주 전략 게임입니다.

이 프로젝트는 원작의 싱글 플레이 방식과 핵심 수치 체계를 유지하면서, 멀티플레이 아키텍처, 인터페이스 상호작용, 은하계 뷰, 기지 시스템, 배포 방식 등을 대폭 재구성하고 확장했습니다.

현재 버전은 두 가지 실행 방식을 제공합니다:

- **싱글 플레이 모드**: 게임 코어가 브라우저에서 실행되고 세이브가 로컬에 저장되어 바로 플레이할 수 있습니다.
- **멀티플레이 모드**: Node.js WebSocket 서버가 상태의 유일한 권위 소스로 동작하며, 계정, 한 서버에서의 다중 플레이어 동시 접속, PvP, 채팅, 랭킹 및 NPC 생태계를 지원합니다.

> 이 프로젝트는 현재 **웹 클라이언트 + 페이니우 fnOS Docker** 배포 방식만 유지합니다. Android, Electron, Go 서버 등 기존 배포 형태는 제거되었으며, 관련 코드는 Git 기록에서 확인할 수 있습니다.

## 주요 기능

### 기지와 제국 운영

- 건물, 연구, 조선소, 방어의 네 가지 모듈을 하나의 기지로 통합했습니다.
- 건물 대기열, 연구 대기열, 함대 임무 슬롯 및 자원 소비를 실시간으로 정산합니다.
- 달 기지, 달 생성, 잔해장 및 회수 메커니즘을 제공합니다.
- 장교 시스템, 자원 보너스, 제국 점수 및 다중 행성 관리를 지원합니다.

### 함대와 전투

- 함선 건조, 함대 편성, 임무 파견 및 다구간 항행을 지원합니다.
- 전투 시뮬레이터를 통해 자원을 투입하기 전에 함대 구성을 검증할 수 있습니다.
- 전투 보고서, 전리품, 잔해장 및 공격·방어 정산을 제공합니다.
- 성문 점령, 통행료, 봉쇄 및 NPC 캐러밴을 구현했습니다.

### 외교와 NPC 생태계

- NPC 관계, 호감도, 무역, 선물, 정보 및 외교 이벤트를 제공합니다.
- 적대 NPC의 정찰, 공격 및 복수 행동을 구현했습니다.
- NPC 성장, 경제 생산 및 여러 플레이어가 공유하는 세계를 지원합니다.
- 외교 알림, 이벤트 보고서 및 관계 상태 필터를 제공합니다.

### 은하계와 탐험

- 전체 화면 2.5D 성도와 항성계, 지역 성단, 은하 전체로 이어지는 3단계 뷰를 제공합니다.
- 10개 행성이 항성을 중심으로 천천히 공전하며, 궤도, 크기 및 속도가 무작위로 결정됩니다.
- 행성이나 항성계를 클릭하면 포커스가 이동하고 카메라가 따라가며 컨텍스트 패널이 서서히 나타납니다.
- 스캔, 이름 지정, 성문, 알 수 없는 신호, 웜홀, 잔해 및 유적 탐사를 지원합니다.
- 12개 주기 × 16개 지역 × 64개 항성계로 구성된 순환하는 우주를 구현했습니다.

### 멀티플레이와 장기 운영

- 계정 등록, 로그인, 세션 및 연결 끊김 후 재접속을 지원합니다.
- 서버 권위 세계를 사용하며, 클라이언트는 명령과 상태 패치를 통해 동기화됩니다.
- 플레이어 거래, PvP, 정찰, 미사일, 함대 임무 및 실시간 알림을 제공합니다.
- 공개 채팅, 귓속말, 접속 상태, 랭킹 및 시즌/주기 메커니즘을 지원합니다.
- 서버 JSON 세이브, 자동 저장 및 Docker 데이터 볼륨 영속화를 제공합니다.

### 사용성과 유지보수성

- 8개 언어: 중국어 간체, 중국어 번체, 영어, 독일어, 러시아어, 스페인어, 한국어, 일본어
- 다크 / 라이트 테마, 반응형 레이아웃 및 PWA 지원
- 싱글 플레이 세이브의 IndexedDB 영속화
- 통합 명령 계층, 헤드리스 코어 및 테스트 가능한 게임 규칙 계층
- 페이니우 fnOS Docker 원클릭 배포 및 이미지 내보내기

## 싱글 플레이 및 멀티플레이 아키텍처

```text
┌────────────────────────────────────────────────────────────┐
│                    브라우저 클라이언트                     │
│  Vue 3 + Pinia + Vue Router + Tailwind CSS                 │
│  뷰 계층은 명령만 전달하며 세계 상태를 직접 수정하지 않음  │
└──────────────────────────────┬─────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               │                               │
       싱글 플레이 모드                 멀티플레이 모드
               │                               │
               ▼                               ▼
   ┌────────────────────────┐              WebSocket
   │        src/core        │                  │
   │   헤드리스 게임 코어   │                  ▼
   │      tick / 명령       │            Node.js 서버
   │      규칙 / 상태       │            server/ + ws
   └───────────┬────────────┘                  │
               │                               ▼
               ▼                         서버 권위 세계
           IndexedDB                    data/world.json
```

- `src/core`: 세계 상태, tick, 임무, NPC, 명령 및 프로토콜을 담당하는 헤드리스 게임 코어입니다.
- `src/logic`: 순수 게임 규칙과 수치 계산을 담당하며, 가능한 한 UI에 의존하지 않습니다.
- `server/`: Node.js WebSocket 서버, 계정, 방, 영속화 및 정적 자산 호스팅을 담당합니다.
- `src/stores` / `src/views`: 브라우저 측 상태와 인터페이스입니다.
- `scripts/`: 헤드리스 스모크 테스트, 서버 테스트, 빌드 스크립트입니다.

싱글 플레이 모드는 헤드리스 코어를 그대로 재사용하며, 멀티플레이 모드에서는 서버가 동일한 코어 로직을 실행하고 클라이언트는 명령 전송과 스냅샷 렌더링만 담당합니다.

## 기술 스택

| 구분 | 기술 |
|---|---|
| 프론트엔드 | Vue 3, TypeScript, Vite (Rolldown-Vite) |
| 상태 및 라우팅 | Pinia, Vue Router 4 |
| UI | Tailwind CSS v4, shadcn-vue, reka-ui, Lucide |
| 애니메이션 및 피드백 | tw-animate-css, vue-sonner |
| 싱글 플레이 영속화 | IndexedDB |
| 멀티플레이 서버 | Node.js 22, WebSocket (ws) |
| 배포 | Docker, 페이니우 fnOS, Node 정적 자산 호스팅 |
| 품질 보증 | vue-tsc, 헤드리스 엔진 스모크 테스트, 서버 통합 테스트, i18n 검증 |

## 빠른 시작

### 환경 요구 사항

- Node.js **22+**
- pnpm **10+**
- 최신 브라우저(Chrome / Edge / Firefox / Safari)

### 클론 및 설치

```bash
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git
cd ogame-vue-ts
pnpm install
```

GitHub 미러:

```bash
git clone https://github.com/shilianlvke/ogame-vue-ts.git
```

### 로컬 개발

```bash
pnpm dev
```

기본 개발 주소:

```text
http://localhost:25121
```

### 프로덕션 빌드

```bash
pnpm build
pnpm preview
```

`pnpm build`는 먼저 TypeScript 타입 검사를 실행한 다음 프론트엔드 정적 자산을 `docs/`로 빌드합니다.

### 로컬에서 멀티플레이 서버 실행

```bash
# 프론트엔드와 Node 서버 빌드
pnpm build
pnpm run build:node-server

# 서버 시작 (기본적으로 docs/와 data/를 읽음)
pnpm start:server
```

기본 포트는 `25122`이며 환경 변수로 재정의할 수 있습니다:

```bash
PORT=8080 STATIC_DIR=docs DATA_DIR=data pnpm start:server
```

서버가 시작되면:

- 게임 페이지: `http://localhost:25122`
- 상태 확인: `http://localhost:25122/health`
- WebSocket: `ws://localhost:25122/ws`

> 프로덕션 환경에서는 HTTPS/WSS를 사용하고, 접근 제어, 백업 및 보안 강화를 직접 수행하십시오.

## 멀티플레이 배포

현재는 페이니우 fnOS의 Docker 배포 방식을 권장합니다.

### 방식 1: 페이니우 소스 원클릭 배포(권장)

사전 조건: 페이니우에 Docker와 git이 설치되어 있고 `node:22-alpine`을 가져올 수 있거나 이미지 미러가 구성되어 있어야 합니다.

```bash
cd /vol1/docker
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git ogame
cd ogame

chmod +x deploy-fnos.sh
./deploy-fnos.sh
```

이후 업데이트:

```bash
./deploy-fnos.sh --update
```

추가 명령:

```bash
./deploy-fnos.sh --start
./deploy-fnos.sh --stop
./deploy-fnos.sh --restart
./deploy-fnos.sh --logs
./deploy-fnos.sh --status
./deploy-fnos.sh --port 8080
./deploy-fnos.sh --china
```

### 방식 2: PC에서 이미지 빌드 후 가져오기

Windows:

```powershell
.\docker-build.ps1
```

이 스크립트는 `noskyman:latest`를 빌드하고 `noskyman.tar`를 내보냅니다. `noskyman.tar`와 `docker-compose.yml`을 페이니우의 같은 디렉터리에 업로드한 후:

```bash
docker load -i noskyman.tar
docker compose up -d
```

전체 설명, 환경 변수, 리버스 프록시 WebSocket 구성 및 자주 묻는 질문은 다음을 참조하십시오:

- [페이니우 fnOS Docker 배포 문서](DEPLOY_DOCKER.md)

> `docker-compose.yml`은 로컬 `noskyman:latest` 이미지만 사용하며 네트워크에서 이미지를 가져오지 않습니다. 소스 빌드는 `deploy-fnos.sh`가 수행합니다.

## 프로젝트 구조

```text
.
├── src/
│   ├── core/          # 헤드리스 게임 코어: 세계, tick, 명령, 임무, NPC, 프로토콜
│   ├── logic/         # 순수 게임 규칙과 수치 계산
│   ├── components/    # Vue 컴포넌트
│   ├── views/         # 페이지 뷰
│   ├── stores/        # Pinia 상태
│   ├── locales/       # 8개 언어 번역
│   ├── services/      # 세이브, 업데이트, WebDAV 등 서비스
│   └── workers/       # 전투 Worker
├── server/            # Node.js WebSocket 서버
├── scripts/           # 빌드, i18n, 헤드리스/서버 스모크 테스트
├── doc/               # 배포, 멀티플레이, 은하계 설계 및 참고 문서
├── public/            # 정적 자산
├── Dockerfile         # 프론트엔드 + Node 서버 멀티스테이지 이미지
├── docker-compose.yml # 페이니우 실행 구성
├── deploy-fnos.sh     # 페이니우 원클릭 배포 스크립트
└── docker-build.ps1   # Windows 이미지 빌드 및 내보내기
```

## 주요 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm dev` | Vite 개발 서버 시작 |
| `pnpm build` | 타입 검사 후 프론트엔드를 `docs/`로 빌드 |
| `pnpm preview` | 프로덕션 빌드 미리보기 |
| `pnpm typecheck` | TypeScript 타입 검사 |
| `pnpm check:i18n` | 8개 언어 팩의 키 검증 |
| `pnpm test` | 타입 검사 + i18n + 모든 헤드리스/서버 스모크 테스트 |
| `pnpm smoke` | 헤드리스 엔진 스모크 테스트 |
| `pnpm smoke:server` | 실제 WebSocket 서버 통합 테스트 |
| `pnpm build:node-server` | Node 서버를 `server-dist/`로 빌드 |
| `pnpm dev:server` | 로컬 Node 서버 빌드 및 시작 |
| `pnpm start:server` | 빌드된 Node 서버 시작 |

## 테스트와 품질

```bash
pnpm typecheck
pnpm check:i18n
pnpm test
```

`pnpm test`가 다루는 범위:

- 헤드리스 게임 엔진
- 주기 범위
- 성도 규모, 결정성, 레이아웃 및 연결성
- 최고 레벨 계정과 캠페인 흐름
- 서버 로그인, 가시성, 명령, 패치, tick, 세이브 및 재접속
- 클라이언트 동기화와 실제 WebSocket 파이프라인

## 개발 상태

이 프로젝트는 여전히 지속적으로 개발 중이며, 인터페이스, 게임 밸런스, 네트워크 프로토콜 및 세이브 구조는 계속 조정될 수 있습니다.

업그레이드 전에 반드시 백업하십시오:

- 싱글 플레이 세이브: 브라우저 로컬 데이터
- 멀티플레이 세이브: 서버의 `data/world.json`
- Docker 배포: 마운트된 `./data` 디렉터리

은하계 시스템 재구성 진행 상황과 설계 기록:

- [은하계 상태 개요](GALAXY_STATUS.md)
- [은하 재설계](GALAXY_REDESIGN.md)
- [성도 설계](GALAXY_MAP_DESIGN.md)
- [주기와 순환](GALAXY_CYCLES.md)
- [멀티플레이 아키텍처](MULTIPLAYER.md)

## 문서

| 문서 | 내용 |
|---|---|
| [페이니우 Docker 배포](DEPLOY_DOCKER.md) | fnOS 원클릭 배포, 이미지 가져오기, 환경 변수 및 리버스 프록시 |
| [멀티플레이 아키텍처](MULTIPLAYER.md) | 헤드리스 코어, 명령 계층, 서버 및 동기화 프로토콜 |
| [게임 레퍼런스](ogame-reference.md) | 건물, 기술, 함선, 방어, 장교 데이터 |
| [은하계 상태](GALAXY_STATUS.md) | 은하계 재구성 단계 및 검수 상태 |

## 기여하기

이슈와 풀 리퀘스트를 환영합니다. 다만 다음 사항을 먼저 확인해 주십시오:

1. **이 프로젝트의 문제를 업스트림 저장소에 제출하지 마십시오.** 업스트림 저자는 이 2차 개발 버전에 대해 책임지지 않습니다.
2. 코드를 제출하면 해당 기여를 이 프로젝트의 CC BY-NC 4.0 라이선스로 배포하는 데 동의하는 것으로 간주됩니다.
3. 업스트림 저작자 표시, 라이선스 링크 및 변경 설명을 제거하거나 약화해서는 안 됩니다.
4. 상업적 라이선스, 유료 서비스 또는 공식 OGame과 관련된 오해의 소지가 있는 내용을 제출하지 마십시오.
5. 멀티플레이, 보안, 세이브 형식과 관련된 변경 사항은 테스트와 문서를 함께 보완해 주십시오.

문제와 피드백은 다음으로 제출해 주십시오:

- Gitee: <https://gitee.com/shilianlvke/ogame-vue-ts>
- GitHub: <https://github.com/shilianlvke/ogame-vue-ts>

## 출처, 라이선스 및 법적 고지

> 이 섹션은 프로젝트의 출처, 라이선스 및 기본 입장을 설명하기 위한 것이며 법률 자문이 아닙니다. 상업적 사용, 공개 운영, 재배포 또는 대규모 배포와 관련된 경우에는 전문 법률가의 조언을 직접 받으십시오.

### 업스트림 프로젝트와 2차 개발 관계

- **업스트림 프로젝트**: [setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts)
- **업스트림 저자**: [setube](https://github.com/setube)
- **이 프로젝트**: [shilianlvke](https://gitee.com/shilianlvke)가 유지 관리하는 2차 개발 버전

이 프로젝트는 업스트림 프로젝트를 수정한 2차 개발(파생) 버전이며, 구체적인 수정 범위는 이 저장소의 Git 기록을 기준으로 합니다. 주요 변경 사항은 다음을 포함하되 이에 국한되지 않습니다:

- 멀티플레이 아키텍처, Node.js WebSocket 서버, 계정 및 다중 플레이어 동기화
- 인터페이스, 기지, 함대, 외교, 랭킹, 메시지 등 페이지 재구성
- 전체 화면 2.5D 은하계 뷰와 포커스 상호작용
- 은하계, 주기, 성문, 알 수 없는 신호 등 게임플레이 확장
- Docker / 페이니우 fnOS 배포
- Android, Electron, Go 서버 등 기존 배포 형태 제거

이 버전과 업스트림 저자 사이에는 종속, 협력, 후원 또는 보증 관계가 존재하지 않습니다. 업스트림 저자는 이 버전의 코드, 배포, 운영 또는 그 어떤 결과에 대해서도 책임지지 않습니다.

### 라이선스

이 프로젝트는 업스트림 프로젝트의 라이선스를 그대로 따릅니다:

**[Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/)** · [라이선스 파일](../LICENSE)

이 프로젝트는 **어떤 상업적 라이선스도 제공하지 않습니다**. 관련 코드나 콘텐츠를 상업적 목적으로 사용하려는 경우 이 프로젝트를 사용하지 마십시오.

다음과 같은 권리가 있습니다:

- **공유**: 어떤 매체나 형식으로든 이 프로젝트를 복제하고 배포할 수 있습니다.
- **변경**: 이 프로젝트를 수정, 변환하거나 이를 기반으로 창작할 수 있습니다.

다만 다음 조건을 준수해야 합니다:

- **저작자 표시**: 업스트림 저자와 이 프로젝트의 저자를 적절히 표시하고, 라이선스 링크와 변경 설명을 유지해야 하며, 저자가 여러분이나 여러분의 사용을 보증하는 것으로 암시해서는 안 됩니다.
- **비영리**: 이 프로젝트를 상업적 목적으로 사용할 수 없습니다.
- **추가 제한 금지**: 법적 조항이나 기술적 수단을 통해 타인이 라이선스에서 허용하는 권리를 행사하지 못하도록 제한할 수 없습니다.

이 저장소에서 이 프로젝트가 새로 추가한 코드와 문서도 별도로 명시하지 않는 한 동일하게 CC BY-NC 4.0으로 배포됩니다. 제3자 의존성, 아이콘, 글꼴, 상표 및 기타 제3자 콘텐츠는 각각의 권리자에게 귀속되며, 각자의 라이선스가 적용됩니다.

### 상표 및 공식 관계

- **OGame** 및 관련 명칭, 상표, 게임 콘텐츠는 **Gameforge AG** 또는 해당 권리자에게 귀속됩니다.
- 이 프로젝트는 독립적이고 비공식적인 팬 제작 기술 프로젝트이며, Gameforge AG 및 공식 OGame 팀과 어떠한 제휴, 허가, 후원 또는 보증 관계도 없습니다.
- 이 프로젝트에서 OGame 명칭을 사용하는 것은 게임 유형을 설명하고 원작에 경의를 표하기 위한 것일 뿐이며, 어떠한 상표권도 주장하지 않습니다.
- 권리자가 이 프로젝트의 내용이 자신의 정당한 권리와 이익을 침해한다고 판단하는 경우, 이 저장소의 이슈를 통해 유지 관리자에게 연락해 주시면 신속히 처리하겠습니다.

### 멀티플레이 운영과 데이터 책임

- 싱글 플레이 모드의 세이브는 사용자 브라우저의 로컬 저장소에 저장됩니다.
- 멀티플레이 모드에서는 서버의 `data/world.json`에 세계 및 계정 데이터를 저장하며, 채팅, 전투 보고서 등 플레이어 콘텐츠를 처리할 수 있습니다.
- 배포자는 서버 보안, 접근 제어, 데이터 백업, 개인정보 고지, 데이터 삭제 경로 및 현지 법률과 규정 준수에 대해 스스로 책임을 져야 합니다.
- 공개적으로 운영할 경우 등록·신고, 허가, 개인정보 처리방침 또는 기타 규정 준수 문서가 필요한지 스스로 확인하십시오.
- 보안이 강화되지 않은 서비스를 인터넷에 직접 노출하지 마십시오.
- 배포, 운영, 데이터 손실, 서비스 중단 또는 보안 사고로 인한 손실은 배포자가 직접 부담합니다.

### 면책 고지

이 프로젝트는 **“있는 그대로(as-is)”** 제공되며, 상품성, 특정 목적에의 적합성, 비침해성, 지속적인 가용성 및 오류 없는 작동을 포함하되 이에 국한되지 않는 어떠한 명시적 또는 묵시적 보증도 제공하지 않습니다.

관련 법률이 허용하는 최대 범위 내에서, 저자와 기여자는 이 프로젝트의 사용 또는 사용 불능으로 인해 발생하는 직접적, 간접적, 부수적, 특별 또는 결과적 손실에 대해 어떠한 책임도 지지 않으며, 여기에는 데이터 손실, 서비스 중단, 장비 손상, 이익 손실 또는 법적 분쟁이 포함되나 이에 국한되지 않습니다.

**이 프로젝트는 상업적 사용을 금지합니다.** 모든 조직이나 개인은 공개 운영, 상업적 배포 또는 재배포 전에 법률 및 규정 준수 책임을 스스로 평가하고 전적으로 부담해야 합니다.

## 감사의 말

- [setube](https://github.com/setube) 님이 [ogame-vue-ts](https://github.com/setube/ogame-vue-ts)를 창작하고 오픈 소스로 공개해 주신 데 감사드립니다. 이 프로젝트의 모든 2차 개발은 그분의 작업을 기반으로 이루어졌습니다.
- 업스트림 프로젝트의 역대 기여자와 커뮤니티 플레이어 여러분께 감사드립니다.
- [OGame](https://ogame.org)이 선사한 고전적인 우주 전략 경험에 감사드립니다.
- Vue, Vite, Pinia, Tailwind CSS, shadcn-vue, reka-ui, Lucide, Node.js, ws 등 오픈 소스 프로젝트와 기여자 여러분께 감사드립니다.

---

<div align="center">

**OGame Vue TS · 멀티플레이 리워크**

원작자: [setube](https://github.com/setube)<br>
이 버전 관리자: [shilianlvke](https://gitee.com/shilianlvke)

<sub>비공식 프로젝트 · 비영리 사용 전용 · CC BY-NC 4.0</sub>

</div>
