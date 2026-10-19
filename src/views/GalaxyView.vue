<template>
  <div class="container mx-auto space-y-3 p-3 sm:p-6">
    <!-- 顶部：视图切换 -->
    <div>
      <h1 class="text-2xl font-bold sm:text-3xl">{{ t('galaxyView.title') }}</h1>
      <p class="mt-0.5 text-xs text-muted-foreground sm:text-sm">
        {{ generateGalaxyName(currentCycle) }} · {{ t('galaxyMap.subtitle') }}
      </p>
    </div>

    <!-- 视图切换放在左侧，避免被右上角引导提示遮挡 -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-for="view in viewTabs"
          :key="view.key"
          size="sm"
          :variant="mapView === view.key ? 'default' : 'outline'"
          @click="setView(view.key)"
        >
          <component :is="view.icon" class="mr-1.5 h-4 w-4" />
          {{ t(view.labelKey) }}
        </Button>
      </div>
      <div class="hidden text-[11px] text-muted-foreground sm:block">{{ t('galaxyMap.dragHint') }}</div>
    </div>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <!-- 2.5D 星图 -->
      <Card class="relative h-[58vh] min-h-[380px] overflow-hidden p-0 lg:h-[calc(100vh-9rem)]">
        <Galaxy25DMap
          ref="mapRef"
          :view="mapView"
          :galaxy="currentGalaxy"
          :system="currentSystem"
          :slots="systemSlots"
          :selected-planet-id="selectedSlot?.planet?.id ?? null"
          :selected-system-id="selectedSystemId"
          :selected-region="selectedRegion"
          @select-slot="onSelectSlot"
          @select-system="onSelectSystem"
          @select-region="onSelectRegion"
        />

        <!-- 当前坐标 -->
        <div class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div class="pointer-events-auto rounded-lg border border-border bg-background/80 px-3 py-2 text-xs text-foreground shadow-sm backdrop-blur">
            <div class="font-medium">{{ currentSystemLabel }}</div>
            <div class="mt-0.5 text-[10px] text-muted-foreground">[{{ currentGalaxy }}:{{ currentSystem }}] · {{ currentRegionName }}</div>
          </div>
          <div class="pointer-events-auto flex gap-1.5">
            <Button size="icon" variant="outline" class="h-8 w-8 bg-background/80" @click="mapRef?.zoomIn()">
              <Plus class="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" class="h-8 w-8 bg-background/80" @click="mapRef?.zoomOut()">
              <Minus class="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" class="h-8 w-8 bg-background/80" @click="mapRef?.resetView()">
              <Maximize2 class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <!-- 图例 -->
        <div class="pointer-events-none absolute bottom-3 right-3 hidden rounded-lg border border-border bg-background/80 px-2.5 py-2 text-[10px] text-muted-foreground shadow-sm backdrop-blur sm:block">
          <div class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />{{ t('galaxyMap.legendOwn') }}</div>
          <div class="mt-1 flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-400" />{{ t('galaxyMap.legendNpc') }}</div>
          <div class="mt-1 flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-cyan-700 dark:bg-cyan-300" />{{ t('galaxyMap.legendScanned') }}</div>
        </div>
      </Card>

      <!-- 右侧上下文操作面板：留出右下角固定通知按钮的空间 -->
      <div class="space-y-3 pr-[10%] lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
        <!-- 恒星系视图：选中轨道/星球 -->
        <Card v-if="mapView === 'system'">
          <CardHeader class="pb-2">
            <CardTitle class="flex items-center justify-between gap-2 text-base">
              <span class="flex items-center gap-2">
                <Orbit class="h-4 w-4 text-primary" />
                {{ t('galaxyMap.systemView') }}
              </span>
              <Badge variant="secondary" class="text-[10px]">{{ currentSystemLabel }}</Badge>
            </CardTitle>
            <CardDescription class="text-xs">
              {{ systemScan ? t('galaxyMap.scanned') : t('galaxyMap.unscanned') }} · {{ t('galaxyView.totalPositions') }}
            </CardDescription>
          </CardHeader>
          <CardContent v-if="selectedSlot" class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold">
                  {{ slotDisplayName }}
                </div>
                <div class="text-[11px] text-muted-foreground">
                  {{ t('galaxyMap.orbit') }} {{ selectedSlot.position }} · {{ formatCoords({ galaxy: currentGalaxy, system: currentSystem, position: selectedSlot.position }) }}
                </div>
              </div>
              <Badge v-if="selectedSlot.planet" :variant="slotOwnerBadgeVariant" class="shrink-0 text-[10px]">
                {{ slotOwnerLabel }}
              </Badge>
            </div>

            <div v-if="selectedSlot.planet" class="grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-lg bg-muted/50 p-2">
                <div class="text-muted-foreground">{{ t('galaxyMap.planet') }}</div>
                <div class="truncate font-medium">{{ slotDisplayName }}</div>
              </div>
              <div class="rounded-lg bg-muted/50 p-2">
                <div class="text-muted-foreground">{{ t('galaxyMap.scanStatus') }}</div>
                <div class="font-medium">{{ systemScan ? t('galaxyMap.scanned') : t('galaxyMap.unscanned') }}</div>
              </div>
              <div v-if="slotNpc && !slotIsUnknown" class="col-span-2 rounded-lg bg-muted/50 p-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-muted-foreground">{{ slotNpc.name }}</span>
                  <span class="font-medium">{{ slotRelationLabel }}</span>
                </div>
                <div v-if="slotNpc.difficultyLevel" class="mt-1 text-[10px] text-muted-foreground">
                  {{ t('galaxyMap.difficulty') }} {{ slotNpc.difficultyLevel }}
                </div>
              </div>
              <div v-if="slotDebris" class="col-span-2 rounded-lg bg-muted/50 p-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-muted-foreground">{{ t('galaxyView.debrisField') }}</span>
                  <span class="font-medium">
                    {{ formatNumber(slotDebris.resources.metal) }} / {{ formatNumber(slotDebris.resources.crystal) }}
                  </span>
                </div>
              </div>
              <div v-if="slotOreDeposits" class="col-span-2 rounded-lg bg-muted/50 p-2">
                <div class="mb-1 text-muted-foreground">{{ t('galaxyView.oreDeposits') }}</div>
                <div class="flex flex-wrap gap-x-3 gap-y-0.5 font-medium">
                  <span>M {{ formatDepositShort(slotOreDeposits.metal) }}</span>
                  <span>C {{ formatDepositShort(slotOreDeposits.crystal) }}</span>
                  <span>D {{ formatDepositShort(slotOreDeposits.deuterium) }}</span>
                </div>
              </div>
            </div>

            <Button
              v-if="!systemScan"
              variant="outline"
              class="w-full"
              :disabled="scanInFlight"
              @click="scanSelectedSystem"
            >
              <Radar class="mr-2 h-4 w-4" />{{ t('galaxyMap.scan') }} {{ t('galaxyMap.system') }}
            </Button>

            <div class="grid grid-cols-2 gap-2">
              <Button v-if="isOwnPlanet(selectedSlot.planet)" class="col-span-2" @click="switchToPlanet(selectedSlot.planet!.id)">
                <Home class="mr-2 h-4 w-4" />
                {{ t('galaxyMap.goToPlanet') }}
              </Button>
              <Button
                v-if="selectedSlot.planet && !isOwnPlanet(selectedSlot.planet) && systemScan"
                variant="outline"
                @click="showPlanetActions(selectedSlot.planet, 'spy')"
              >
                <Eye class="mr-2 h-4 w-4" />{{ t('galaxyView.scout') }}
              </Button>
              <Button
                v-if="selectedSlot.planet && !isOwnPlanet(selectedSlot.planet) && systemScan"
                variant="outline"
                @click="showPlanetActions(selectedSlot.planet, 'attack')"
              >
                <Sword class="mr-2 h-4 w-4" />{{ t('galaxyView.attack') }}
              </Button>
              <Button
                v-if="selectedSlot.planet && !isOwnPlanet(selectedSlot.planet) && slotNpc && systemScan"
                variant="outline"
                @click="showPlanetActions(selectedSlot.planet, 'gift')"
              >
                <Gift class="mr-2 h-4 w-4" />{{ t('galaxyView.sendGift') }}
              </Button>
              <Button
                v-if="selectedSlot.planet && !isOwnPlanet(selectedSlot.planet) && hasInterplanetaryMissiles && systemScan"
                variant="outline"
                @click="showMissileAttackDialog(selectedSlot.planet)"
              >
                <Bomb class="mr-2 h-4 w-4" />{{ t('galaxyView.missileAttack') }}
              </Button>
              <Button
                v-if="selectedSlot.planet && !isOwnPlanet(selectedSlot.planet) && canScanPlanet(selectedSlot.planet) && systemScan"
                variant="outline"
                class="col-span-2"
                @click="showPhalanxScanDialog(selectedSlot.planet)"
              >
                <Radar class="mr-2 h-4 w-4" />{{ t('galaxyView.phalanxScan') }}
              </Button>
              <Button v-if="!selectedSlot.planet" class="col-span-2" @click="showPlanetActions(null, 'colonize', selectedSlot.position)">
                <Rocket class="mr-2 h-4 w-4" />{{ t('galaxyView.colonize') }}
              </Button>
              <Button v-if="slotDebris" variant="outline" class="col-span-2" @click="showPlanetActions(selectedSlot.planet, 'recycle', selectedSlot.position)">
                <Recycle class="mr-2 h-4 w-4" />{{ t('galaxyView.recycle') }}
              </Button>
              <Button v-if="selectedSlot.moon" variant="outline" class="col-span-2" @click="switchToPlanet(selectedSlot.moon.id)">
                <Moon class="mr-2 h-4 w-4" />{{ t('galaxyMap.goToMoon') }}
              </Button>
            </div>
          </CardContent>
          <CardContent v-else class="py-6 text-center text-xs text-muted-foreground">
            {{ t('galaxyMap.selectHint') }}
          </CardContent>
        </Card>

        <!-- 星系级视图：选中恒星系 -->
        <Card v-else-if="mapView === 'region'">
          <CardHeader class="pb-2">
            <CardTitle class="flex items-center justify-between gap-2 text-base">
              <span class="flex items-center gap-2"><Orbit class="h-4 w-4 text-primary" />{{ t('galaxyMap.regionView') }}</span>
              <Badge variant="secondary" class="text-[10px]">{{ currentRegionName }}</Badge>
            </CardTitle>
            <CardDescription class="text-xs">{{ t('galaxyMap.regionHint') }}</CardDescription>
          </CardHeader>
          <CardContent v-if="selectedSystem" class="space-y-3">
            <div>
              <div class="text-sm font-semibold">{{ selectedSystemName }}</div>
              <div class="text-[11px] text-muted-foreground">
                [{{ selectedSystem.galaxy }}:{{ selectedSystem.index }}] · {{ t(`galaxy.economy.${selectedSystem.economy}`) }}
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <Badge variant="outline" class="text-[10px]">{{ t('galaxyMap.danger') }} {{ selectedSystem.danger }}</Badge>
              <Badge variant="outline" class="text-[10px]">{{ t('galaxyMap.wealth') }} {{ selectedSystem.wealth }}</Badge>
              <Badge v-if="selectedSystem.hasStation" variant="secondary" class="text-[10px]">{{ t('galaxyMap.station') }}</Badge>
              <Badge :variant="selectedSystemScan ? 'default' : 'outline'" class="text-[10px]">
                {{ selectedSystemScan ? t('galaxyMap.scanned') : t('galaxyMap.unscanned') }}
              </Badge>
            </div>

            <div class="space-y-1 rounded-lg bg-muted/50 p-2 text-xs">
              <div v-if="selectedGate" class="flex justify-between gap-2">
                <span class="text-muted-foreground">{{ t('galaxyMap.gate') }}</span>
                <span>{{ selectedGate.owner === 'neutral' ? t('galaxyMap.neutral') : selectedGate.owner }} · {{ selectedGate.toll }}</span>
              </div>
              <div v-if="selectedSignal" class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">{{ t('galaxyMap.signal') }}</span>
                <Button size="sm" variant="outline" class="h-6 px-2 text-[10px]" @click="handleSignal">
                  {{ selectedSignal.kind === 'wormhole' ? t('galaxyMap.warp') : t('galaxyMap.collect') }}
                </Button>
              </div>
              <div v-if="selectedSystemScan" class="flex justify-between gap-2">
                <span class="text-muted-foreground">{{ t('galaxyMap.scanCount') }}</span>
                <span>{{ selectedSystemScan.scans }}</span>
              </div>
            </div>

            <div class="flex gap-2">
              <Button class="flex-1" @click="enterSelectedSystem">
                <Navigation class="mr-2 h-4 w-4" />{{ t('galaxyMap.enterSystem') }}
              </Button>
              <Button variant="outline" :disabled="scanInFlight" @click="scanSelectedSystem">
                <Radar class="mr-2 h-4 w-4" />{{ t('galaxyMap.scan') }}
              </Button>
            </div>

            <div class="flex gap-2">
              <Input v-model="renameDraft" :maxlength="24" :placeholder="t('galaxyMap.renamePlaceholder')" class="h-8" />
              <Button size="sm" variant="outline" @click="renameSelectedSystem">{{ t('galaxyMap.rename') }}</Button>
            </div>

            <div class="border-t pt-3">
              <div class="mb-1 text-xs font-medium">{{ t('galaxyMap.orbits') }}</div>
              <div class="max-h-40 space-y-1 overflow-y-auto pr-1 text-[11px]">
                <div v-for="orbit in selectedOrbits" :key="orbit.position" class="flex items-center justify-between gap-2 rounded px-1.5 py-1" :class="orbit.own ? 'bg-primary/10' : 'bg-muted/40'">
                  <span class="text-muted-foreground">{{ t('galaxyMap.orbit') }} {{ orbit.position }}</span>
                  <span class="truncate">{{ orbit.label }}</span>
                </div>
              </div>
            </div>
          </CardContent>
          <CardContent v-else class="py-6 text-center text-xs text-muted-foreground">{{ t('galaxyMap.selectSystemHint') }}</CardContent>
        </Card>

        <!-- 银河全景：选中星区 -->
        <Card v-else>
          <CardHeader class="pb-2">
            <CardTitle class="flex items-center gap-2 text-base"><Globe class="h-4 w-4 text-primary" />{{ t('galaxyMap.galaxyView') }}</CardTitle>
            <CardDescription class="text-xs">{{ t('galaxyMap.galaxyHint') }}</CardDescription>
          </CardHeader>
          <CardContent v-if="selectedRegionInfo" class="space-y-3">
            <div>
              <div class="text-sm font-semibold">{{ regionName(selectedRegionInfo) }}</div>
              <div class="text-[11px] text-muted-foreground">
                {{ t('galaxyMap.region') }} {{ selectedRegionInfo.region }} / {{ GALAXY_CONFIG.REGIONS_PER_CYCLE }}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-lg bg-muted/50 p-2">
                <div class="text-muted-foreground">{{ t('galaxyMap.systems') }}</div>
                <div class="font-medium">{{ selectedRegionInfo.systems.length }}</div>
              </div>
              <div class="rounded-lg bg-muted/50 p-2">
                <div class="text-muted-foreground">{{ t('galaxyMap.scannedSystems') }}</div>
                <div class="font-medium">{{ selectedRegionScanned }}</div>
              </div>
            </div>
            <div class="max-h-48 space-y-1 overflow-y-auto text-[11px]">
              <button
                v-for="system in selectedRegionInfo.systems.slice(0, 12)"
                :key="system.id"
                type="button"
                class="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-muted"
                @click="focusRegionSystem(system)"
              >
                <span class="truncate">{{ systemName(system) }}</span>
                <span class="text-muted-foreground">{{ system.index }}</span>
              </button>
            </div>
            <Button class="w-full" @click="enterSelectedRegion">
              <Navigation class="mr-2 h-4 w-4" />{{ t('galaxyMap.enterRegion') }}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="flex flex-wrap gap-2 p-3 text-[11px] text-muted-foreground">
            <span class="sm:hidden"><MousePointer2 class="mr-1 inline h-3.5 w-3.5" />{{ t('galaxyMap.dragHint') }}</span>
            <span class="hidden sm:inline"><Eye class="mr-1 inline h-3.5 w-3.5" />{{ t('galaxyMap.hoverHint') }}</span>
            <span class="hidden sm:inline"><MousePointer2 class="mr-1 inline h-3.5 w-3.5" />{{ t('galaxyMap.dragHint') }}</span>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- 快速派遣确认 -->
    <AlertDialog :open="alertDialogOpen" @update:open="alertDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ alertDialogTitle }}</AlertDialogTitle>
          <AlertDialogDescription class="whitespace-pre-line">{{ alertDialogMessage }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="handleAlertDialogConfirm">{{ t('common.confirm') }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- 导弹攻击 -->
    <Dialog :open="missileDialogOpen" @update:open="missileDialogOpen = $event">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Bomb class="h-5 w-5 text-destructive" />
            {{ t('galaxyView.missileAttackTitle') }}
          </DialogTitle>
          <DialogDescription v-if="missileTargetPlanet">
            {{ t('galaxyView.missileAttackMessage').replace('{coordinates}', formatCoords(missileTargetPlanet.position)) }}
          </DialogDescription>
        </DialogHeader>
        <div v-if="gameStore.currentPlanet && missileTargetPlanet" class="space-y-4">
          <div class="flex items-center gap-3">
            <Input v-model.number="missileCount" type="number" min="1" :max="gameStore.currentPlanet.defense['interplanetaryMissile'] || 0" />
            <Button variant="outline" size="sm" @click="missileCount = gameStore.currentPlanet?.defense['interplanetaryMissile'] || 0">
              {{ t('fleetView.all') }}
            </Button>
          </div>
          <div class="space-y-1 rounded-lg bg-muted/50 p-3 text-xs">
            <div class="flex justify-between"><span>{{ t('galaxyView.availableMissiles') }}</span><span>{{ gameStore.currentPlanet.defense['interplanetaryMissile'] || 0 }}</span></div>
            <div class="flex justify-between"><span>{{ t('galaxyView.distance') }}</span><span>{{ formatDistance(calculateDistance(missileTargetPlanet)) }}</span></div>
            <div class="flex justify-between"><span>{{ t('galaxyView.flightTime') }}</span><span>{{ formatFlightTime(calculateDistance(missileTargetPlanet)) }}</span></div>
          </div>
          <div v-if="calculateDistance(missileTargetPlanet) > calculateMissileRange()" class="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle class="h-4 w-4" />{{ t('galaxyView.outOfRange') }}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="missileDialogOpen = false">{{ t('common.cancel') }}</Button>
          <Button variant="destructive" :disabled="!missileCount || calculateDistance(missileTargetPlanet!) > calculateMissileRange()" @click="launchMissileAttack">
            <Bomb class="mr-2 h-4 w-4" />{{ t('galaxyView.launchMissile') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 传感器阵列 -->
    <Dialog :open="phalanxDialogOpen" @update:open="phalanxDialogOpen = $event">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2"><Radar class="h-5 w-5" />{{ t('galaxyView.phalanxScanTitle') }}</DialogTitle>
          <DialogDescription v-if="phalanxTargetPlanet">
            {{ t('galaxyView.phalanxScanDescription').replace('{coordinates}', formatCoords(phalanxTargetPlanet.position)) }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">{{ t('galaxyView.phalanxCost') }}</span>
            <span class="flex items-center gap-1"><ResourceIcon type="deuterium" size="sm" />{{ formatNumber(PHALANX_SCAN_COST) }}</span>
          </div>
          <Button v-if="phalanxScanResults.length === 0 && !phalanxScanning" class="w-full" @click="executePhalanxScan">
            <Radar class="mr-2 h-4 w-4" />{{ t('galaxyView.phalanxScan') }}
          </Button>
          <div v-if="phalanxScanning" class="flex justify-center py-6">
            <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
          <div v-if="!phalanxScanning && phalanxScanResults.length > 0" class="max-h-64 space-y-2 overflow-y-auto">
            <div class="text-sm font-medium">{{ t('galaxyView.phalanxFleetDetected').replace('{count}', String(phalanxScanResults.length)) }}</div>
            <div v-for="fleet in phalanxScanResults" :key="fleet.id" class="space-y-1 rounded-lg border p-2 text-xs">
              <div class="flex justify-between"><Badge>{{ getMissionTypeText(fleet.missionType) }}</Badge><Badge variant="secondary">{{ fleet.status }}</Badge></div>
              <div>{{ formatCoords(getPlanetPositionById(fleet.originPlanetId) || { galaxy: 0, system: 0, position: 0 }) }} → {{ formatCoords(fleet.targetPosition) }}</div>
            </div>
          </div>
          <div v-if="!phalanxScanning && phalanxScanResults.length === 0 && phalanxDialogOpen" class="py-3 text-center text-xs text-muted-foreground">
            {{ t('galaxyView.phalanxNoFleets') }}
          </div>
        </div>
        <DialogFooter><Button variant="outline" @click="phalanxDialogOpen = false">{{ t('common.close') }}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useGameStore } from '@/stores/gameStore'
  import { useUniverseStore } from '@/stores/universeStore'
  import { useNPCStore } from '@/stores/npcStore'
  import { useNetStore } from '@/stores/netStore'
  import { useI18n } from '@/composables/useI18n'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Input } from '@/components/ui/input'
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
  import ResourceIcon from '@/components/common/ResourceIcon.vue'
  import Galaxy25DMap from '@/components/galaxy/Galaxy25DMap.vue'
  import type { GalaxyMapSlot, GalaxyMapView } from '@/components/galaxy/types'
  import { DEFAULT_LAYOUT_SEED, GALAXY_CONFIG, regionOfGalaxy } from '@/config/galaxyConfig'
  import { buildCycleLayout } from '@/logic/galaxyGen'
  import { generateGalaxyName, generateRegionName, generateStellarName } from '@/logic/nameGenerator'
  import { buildGateInfos } from '@/logic/gateLogic'
  import { signalOf } from '@/logic/signalLogic'
  import * as gameLogic from '@/logic/gameLogic'
  import * as moonLogic from '@/logic/moonLogic'
  import { formatNumber } from '@/utils/format'
  import { BuildingType, RelationStatus, type DebrisField, type FleetMission, type Planet } from '@/types/game'
  import type { StarSystem } from '@/types/galaxy'
  import { dispatchCommand } from '@/core/runtime'
  import { PHALANX_SCAN_COST } from '@/core/commands'
  import { toast } from 'vue-sonner'
  import {
    AlertTriangle,
    Bomb,
    Eye,
    Gift,
    Globe,
    Home,
    Maximize2,
    Minus,
    Moon,
    MousePointer2,
    Navigation,
    Orbit,
    Plus,
    Radar,
    Recycle,
    Rocket,
    Sword
  } from 'lucide-vue-next'

  const gameStore = useGameStore()
  const universeStore = useUniverseStore()
  const npcStore = useNPCStore()
  const netStore = useNetStore()
  const router = useRouter()
  const route = useRoute()
  const { t } = useI18n()

  const mapRef = ref<InstanceType<typeof Galaxy25DMap> | null>(null)
  const mapView = ref<GalaxyMapView>('system')
  const currentGalaxy = ref(1)
  const currentSystem = ref(1)
  const selectedSlotPosition = ref<number | null>(null)
  const selectedSystemId = ref<string | null>(null)
  const selectedRegion = ref<number | null>(null)
  const renameDraft = ref('')
  const highlightNpcId = ref<string | undefined>(undefined)

  const alertDialogOpen = ref(false)
  const alertDialogTitle = ref('')
  const alertDialogMessage = ref('')
  const alertDialogConfirmAction = ref<(() => void) | null>(null)
  const missileDialogOpen = ref(false)
  const missileTargetPlanet = ref<Planet | null>(null)
  const missileCount = ref(1)
  const phalanxDialogOpen = ref(false)
  const phalanxTargetPlanet = ref<Planet | null>(null)
  const phalanxScanResults = ref<FleetMission[]>([])
  const phalanxScanning = ref(false)
  const scanInFlight = ref(false)
  let scanInFlightTimer: number | undefined

  const currentCycle = computed(() => gameStore.player.cycle ?? 1)
  const layout = computed(() => buildCycleLayout(DEFAULT_LAYOUT_SEED, currentCycle.value))
  const currentRegion = computed(() => regionOfGalaxy(currentGalaxy.value))
  const currentRegionLayout = computed(() => layout.value.regions.find(region => region.region === currentRegion.value))
  const currentSystemId = computed(() => `${currentCycle.value}:${currentRegion.value}:${currentSystem.value}`)
  const currentStar = computed(() => currentRegionLayout.value?.systems.find(system => system.index === currentSystem.value))
  const currentSystemLabel = computed(() => (currentStar.value ? systemName(currentStar.value) : `${currentGalaxy.value}:${currentSystem.value}`))
  const currentRegionName = computed(() => (currentRegionLayout.value ? regionName(currentRegionLayout.value) : ''))

  const systemSlots = computed<GalaxyMapSlot[]>(() => getSystemPlanets(currentGalaxy.value, currentSystem.value))
  const selectedSlot = computed(() => systemSlots.value.find(slot => slot.position === selectedSlotPosition.value) ?? null)
  const slotNpc = computed(() => getPlanetNPC(selectedSlot.value?.planet ?? null))
  const slotIsUnknown = computed(
    () => !!selectedSlot.value?.planet && !isOwnPlanet(selectedSlot.value.planet) && !systemScan.value
  )
  const slotDisplayName = computed(() => {
    if (!selectedSlot.value?.planet) return t('galaxyMap.unknownOrbit')
    if (isOwnPlanet(selectedSlot.value.planet) || systemScan.value) return selectedSlot.value.planet.name
    return `${t('galaxyMap.orbit')} ${selectedSlot.value.position} · ${t('galaxyMap.unscanned')}`
  })
  const slotRelation = computed(() => getRelation(selectedSlot.value?.planet ?? null))
  const slotRelationLabel = computed(() => {
    if (!slotRelation.value) return t('galaxyMap.neutral')
    const key = `diplomacy.status.${slotRelation.value.status}`
    const translated = t(key)
    return translated === key ? slotRelation.value.status : translated
  })
  const slotOwnerLabel = computed(() => {
    if (!selectedSlot.value?.planet) return t('galaxyView.emptySlot')
    if (isOwnPlanet(selectedSlot.value.planet)) return t('galaxyView.mine')
    if (slotIsUnknown.value) return t('galaxyMap.unscanned')
    return slotNpc.value?.name ?? selectedSlot.value.planet.ownerId ?? t('galaxyMap.other')
  })
  const slotOwnerBadgeVariant = computed<'default' | 'secondary' | 'destructive' | 'outline'>(() => {
    if (!selectedSlot.value?.planet || slotIsUnknown.value) return 'outline'
    if (isOwnPlanet(selectedSlot.value.planet)) return 'default'
    if (slotRelation.value?.status === RelationStatus.Hostile) return 'destructive'
    return 'secondary'
  })
  const slotDebris = computed(() =>
    selectedSlot.value ? getDebrisFieldAt(currentGalaxy.value, currentSystem.value, selectedSlot.value.position) : null
  )
  const slotOreDeposits = computed(() =>
    selectedSlot.value?.planet && (!slotIsUnknown.value || isOwnPlanet(selectedSlot.value.planet))
      ? selectedSlot.value.planet.oreDeposits ?? null
      : null
  )
  const systemScan = computed(() => gameStore.player.discoveredSystems?.[currentSystemId.value])

  const selectedSystem = computed<StarSystem | null>(() => {
    if (selectedSystemId.value) return layout.value.systemIndex.get(selectedSystemId.value) ?? null
    return currentStar.value ?? null
  })
  const selectedSystemName = computed(() => (selectedSystem.value ? systemName(selectedSystem.value) : ''))
  const selectedSystemScan = computed(() =>
    selectedSystem.value ? gameStore.player.discoveredSystems?.[selectedSystem.value.id] : undefined
  )
  const selectedGate = computed(() =>
    selectedSystem.value ? buildGateInfos(layout.value)[selectedSystem.value.id] : undefined
  )
  const allSystemIds = computed(() => layout.value.regions.flatMap(region => region.systems.map(system => system.id)))
  const selectedSignal = computed(() =>
    selectedSystem.value ? signalOf(layout.value.seed, selectedSystem.value.id, allSystemIds.value) : undefined
  )
  const selectedOrbits = computed(() => {
    if (!selectedSystem.value) return []
    return getSystemPlanets(selectedSystem.value.galaxy, selectedSystem.value.index).map(slot => {
      const scanned = !!selectedSystemScan.value
      return {
        position: slot.position,
        own: isOwnPlanet(slot.planet),
        label: slot.planet ? (isOwnPlanet(slot.planet) || scanned ? slot.planet.name : t('galaxyMap.unknown')) : t('galaxyMap.empty')
      }
    })
  })

  const selectedRegionInfo = computed(() => {
    const regionNumber = selectedRegion.value ?? currentRegion.value
    return layout.value.regions.find(region => region.region === regionNumber) ?? null
  })
  const selectedRegionScanned = computed(() =>
    selectedRegionInfo.value
      ? selectedRegionInfo.value.systems.filter(system => !!gameStore.player.discoveredSystems?.[system.id]).length
      : 0
  )

  const homePlanet = computed(() => gameStore.player.planets.find(planet => !planet.isMoon))
  const hasInterplanetaryMissiles = computed(
    () => (gameStore.currentPlanet?.defense['interplanetaryMissile'] || 0) > 0
  )

  const viewTabs: Array<{ key: GalaxyMapView; labelKey: string; icon: typeof Orbit }> = [
    { key: 'system', labelKey: 'galaxyMap.systemView', icon: Orbit },
    { key: 'region', labelKey: 'galaxyMap.regionView', icon: Globe },
    { key: 'galaxy', labelKey: 'galaxyMap.galaxyView', icon: Navigation }
  ]

  const regionOf = (galaxy: number): number => regionOfGalaxy(galaxy)

  const systemName = (system: StarSystem): string => {
    const custom = gameStore.player.discoveredSystems?.[system.id]?.name
    return custom ?? system.name ?? generateStellarName(system.galaxy, system.index)
  }

  const regionName = (region: { region: number }): string => generateRegionName(region.region)

  const getSystemPlanets = (galaxy: number, system: number): GalaxyMapSlot[] => {
    const positions = gameLogic.generateSystemPositions(galaxy, system)
    return positions.map(pos => {
      const key = gameLogic.generatePositionKey(galaxy, system, pos.position)
      const planet =
        gameStore.player.planets.find(
          item => !item.isMoon && item.position.galaxy === galaxy && item.position.system === system && item.position.position === pos.position
        ) ||
        universeStore.planets[key] ||
        null
      const moon =
        gameStore.player.planets.find(item => item.isMoon && item.parentPlanetId === planet?.id) ||
        npcStore.npcs
          .flatMap(npc => npc.planets)
          .find(item => item.isMoon && item.parentPlanetId === planet?.id) ||
        null
      return { position: pos.position, planet, moon }
    })
  }

  const getDebrisFieldAt = (galaxy: number, system: number, position: number): DebrisField | null =>
    universeStore.debrisFields[`debris_${galaxy}_${system}_${position}`] || null

  const isOwnPlanet = (planet: Planet | null): boolean => !!planet && planet.ownerId === gameStore.player.id

  const getPlanetNPC = (planet: Planet | null) => {
    if (!planet || isOwnPlanet(planet)) return null
    return npcStore.npcs.find(npc =>
      npc.planets.some(
        item =>
          item.position.galaxy === planet.position.galaxy &&
          item.position.system === planet.position.system &&
          item.position.position === planet.position.position
      )
    )
  }

  const getRelation = (planet: Planet | null) => {
    const npc = getPlanetNPC(planet)
    return npc?.relations?.[gameStore.player.id] ?? null
  }

  const formatCoords = (position: { galaxy: number; system: number; position: number }): string =>
    `[${position.galaxy}:${position.system}:${position.position}]`

  const formatDepositShort = (value: number): string => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
    return String(Math.floor(value))
  }

  const setView = (view: GalaxyMapView): void => {
    if (view === 'galaxy') {
      selectedRegion.value = currentRegion.value
    }
    if (view === 'region') {
      selectedSystemId.value = currentSystemId.value
    }
    if (view === 'system' && selectedSlotPosition.value === null) {
      selectedSlotPosition.value = systemSlots.value.find(slot => slot.planet)?.position ?? 1
    }
    mapView.value = view
  }

  const onSelectSlot = (slot: GalaxyMapSlot): void => {
    selectedSlotPosition.value = slot.position
    selectedSystemId.value = currentSystemId.value
  }

  const onSelectSystem = (system: StarSystem): void => {
    selectedSystemId.value = system.id
    currentGalaxy.value = system.galaxy
    currentSystem.value = system.index
    selectedSlotPosition.value = null
  }

  const onSelectRegion = (region: { region: number }): void => {
    const regionLayout = layout.value.regions.find(item => item.region === region.region)
    const preserveCurrent = currentRegion.value === region.region ? currentSystem.value : null
    selectedRegion.value = region.region
    currentGalaxy.value = (currentCycle.value - 1) * GALAXY_CONFIG.REGIONS_PER_CYCLE + region.region
    const nextSystem = preserveCurrent ?? regionLayout?.systems[0]?.index ?? 1
    currentSystem.value = nextSystem
    selectedSystemId.value =
      regionLayout?.systems.find(system => system.index === nextSystem)?.id ?? regionLayout?.systems[0]?.id ?? null
    selectedSlotPosition.value = null
    mapView.value = 'region'
  }

  const enterSelectedSystem = (): void => {
    const system = selectedSystem.value
    if (!system) return
    currentGalaxy.value = system.galaxy
    currentSystem.value = system.index
    selectedSystemId.value = system.id
    selectedSlotPosition.value = systemSlots.value.find(slot => slot.planet)?.position ?? 1
    mapView.value = 'system'
  }

  const enterSelectedRegion = (): void => {
    if (!selectedRegionInfo.value) return
    onSelectRegion(selectedRegionInfo.value)
  }

  const focusRegionSystem = (system: StarSystem): void => {
    onSelectSystem(system)
    mapView.value = 'region'
  }

  const switchToPlanet = (planetId: string): void => {
    gameStore.currentPlanetId = planetId
    router.push('/overview')
  }

  const scanSelectedSystem = (): void => {
    const system = selectedSystem.value
    const planet = homePlanet.value
    if (!system || !planet || scanInFlight.value) return
    scanInFlight.value = true
    if (scanInFlightTimer) window.clearTimeout(scanInFlightTimer)
    scanInFlightTimer = window.setTimeout(() => (scanInFlight.value = false), 800)
    const result = dispatchCommand({ type: 'galaxy.scan', planetId: planet.id, targetSystemId: system.id })
    if (!result.ok) toast.error(t(result.reason ?? 'errors.unknown'))
    else if (!netStore.isOnline) toast.success(t('galaxyMap.scanSuccess'))
  }

  const renameSelectedSystem = (): void => {
    const system = selectedSystem.value
    const name = renameDraft.value.trim()
    if (!system) return
    if (name.length < 2) {
      toast.error(t('errors.renameTooShort'))
      return
    }
    const result = dispatchCommand({ type: 'galaxy.rename', systemId: system.id, name })
    if (!result.ok) toast.error(t(result.reason ?? 'errors.unknown'))
    else {
      toast.success(t('galaxyMap.renameSuccess', { name }))
      renameDraft.value = ''
    }
  }

  const handleSignal = (): void => {
    const signal = selectedSignal.value
    if (!signal || !selectedSystem.value) return
    const result = dispatchCommand({
      type: signal.kind === 'wormhole' ? 'signal.warp' : 'signal.collect',
      systemId: selectedSystem.value.id
    })
    if (!result.ok) toast.error(t(result.reason ?? 'errors.unknown'))
    else toast.success(t('galaxyMap.signalSuccess'))
  }

  const handleAlertDialogConfirm = (): void => {
    alertDialogConfirmAction.value?.()
    alertDialogOpen.value = false
  }

  const showPlanetActions = (
    planet: Planet | null,
    action: 'spy' | 'attack' | 'colonize' | 'recycle' | 'gift',
    position?: number
  ): void => {
    const targetPos = planet ? planet.position : { galaxy: currentGalaxy.value, system: currentSystem.value, position: position! }
    const coordinates = formatCoords(targetPos)
    const titleMap = {
      spy: 'galaxyView.scoutPlanetTitle',
      attack: 'galaxyView.attackPlanetTitle',
      colonize: 'galaxyView.colonizePlanetTitle',
      recycle: 'galaxyView.recyclePlanetTitle',
      gift: 'galaxyView.giftPlanetTitle'
    } as const
    const messageMap = {
      spy: 'galaxyView.scoutPlanetMessage',
      attack: 'galaxyView.attackPlanetMessage',
      colonize: 'galaxyView.colonizePlanetMessage',
      recycle: 'galaxyView.recyclePlanetMessage',
      gift: 'galaxyView.giftPlanetMessage'
    } as const
    alertDialogTitle.value = t(titleMap[action])
    alertDialogMessage.value = t(messageMap[action]).replace('{coordinates}', coordinates)
    alertDialogConfirmAction.value = () => {
      router.push({
        path: '/fleet',
        query: {
          galaxy: targetPos.galaxy,
          system: targetPos.system,
          position: targetPos.position,
          mission: action === 'gift' ? undefined : action,
          gift: action === 'gift' ? '1' : undefined
        }
      })
    }
    alertDialogOpen.value = true
  }

  const showMissileAttackDialog = (planet: Planet): void => {
    missileTargetPlanet.value = planet
    missileCount.value = 1
    missileDialogOpen.value = true
  }

  const launchMissileAttack = (): void => {
    const target = missileTargetPlanet.value
    if (!target || !gameStore.currentPlanet) return
    const result = dispatchCommand({
      type: 'missile.launch',
      planetId: gameStore.currentPlanet.id,
      targetPosition: target.position,
      targetPlanetId: target.id,
      missileCount: missileCount.value
    })
    if (!result.ok) {
      alertDialogTitle.value = t('errors.launchFailed')
      alertDialogMessage.value = t(result.reason ?? 'errors.unknown')
      alertDialogOpen.value = true
      return
    }
    missileDialogOpen.value = false
    toast.success(t('galaxyView.missileLaunched'))
  }

  const calculateMissileRange = (): number => {
    const level = gameStore.player.technologies['impulseDrive'] || 0
    return level === 0 ? 0 : 5 * level - 1
  }

  const calculateDistance = (target: Planet | null): number => {
    if (!gameStore.currentPlanet || !target) return 0
    const from = gameStore.currentPlanet.position
    if (from.galaxy !== target.position.galaxy) return Infinity
    return Math.abs(from.system - target.position.system)
  }

  const formatDistance = (distance: number): string =>
    isFinite(distance) ? `${distance} ${t('galaxyView.systems')}` : t('galaxyView.outOfRange')

  const formatFlightTime = (distance: number): string => {
    if (!isFinite(distance)) return t('galaxyView.outOfRange')
    const seconds = 30 + distance * 60
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  }

  const moonsWithPhalanx = computed(() =>
    gameStore.player.planets.filter(planet => {
      if (!planet.isMoon) return false
      return (planet.buildings[BuildingType.SensorPhalanx] || 0) > 0
    })
  )

  const canScanPlanet = (target: Planet | null): boolean => {
    if (!target || isOwnPlanet(target)) return false
    return moonsWithPhalanx.value.some(moon => {
      const level = moon.buildings[BuildingType.SensorPhalanx] || 0
      return moonLogic.isInSensorPhalanxRange(moon.position, target.position, level)
    })
  }

  const getMoonForScan = (target: Planet): Planet | null =>
    moonsWithPhalanx.value.find(moon => {
      const level = moon.buildings[BuildingType.SensorPhalanx] || 0
      return moonLogic.isInSensorPhalanxRange(moon.position, target.position, level)
    }) || null

  const showPhalanxScanDialog = (planet: Planet): void => {
    phalanxTargetPlanet.value = planet
    phalanxScanResults.value = []
    phalanxScanning.value = false
    phalanxDialogOpen.value = true
  }

  const getPlanetPositionById = (planetId: string): { galaxy: number; system: number; position: number } | null => {
    const playerPlanet = gameStore.player.planets.find(planet => planet.id === planetId)
    if (playerPlanet) return playerPlanet.position
    for (const npc of npcStore.npcs) {
      const npcPlanet = npc.planets.find(planet => planet.id === planetId)
      if (npcPlanet) return npcPlanet.position
    }
    for (const planet of Object.values(universeStore.planets)) {
      if (planet?.id === planetId) return planet.position
    }
    return null
  }

  const executePhalanxScan = async (): Promise<void> => {
    const target = phalanxTargetPlanet.value
    if (!target) return
    const targetPosition = { ...target.position }
    const scanMoon = getMoonForScan(target)
    if (!scanMoon) {
      alertDialogTitle.value = t('errors.scanFailed')
      alertDialogMessage.value = t('galaxyView.phalanxNoMoon')
      alertDialogOpen.value = true
      return
    }
    const tokenBefore = netStore.scanToken
    const result = dispatchCommand({ type: 'phalanx.scan', moonId: scanMoon.id, targetPosition })
    if (!result.ok) {
      alertDialogTitle.value = t('errors.scanFailed')
      alertDialogMessage.value = t(result.reason ?? 'galaxyView.phalanxInsufficientDeuterium')
      alertDialogOpen.value = true
      return
    }
    phalanxScanning.value = true
    if (netStore.enabled) {
      const fleets = await netStore.waitForScan(tokenBefore)
      phalanxScanning.value = false
      if (!fleets) {
        alertDialogTitle.value = t('errors.scanFailed')
        alertDialogMessage.value = t('galaxyMap.scanTimeout')
        alertDialogOpen.value = true
        return
      }
      phalanxScanResults.value = fleets
      return
    }
    window.setTimeout(() => {
      const detected: FleetMission[] = []
      const npc = getPlanetNPC(phalanxTargetPlanet.value)
      npc?.fleetMissions?.forEach(mission => {
        const origin = getPlanetPositionById(mission.originPlanetId)
        const from = origin && origin.galaxy === targetPosition.galaxy && origin.system === targetPosition.system && origin.position === targetPosition.position
        const to =
          mission.targetPosition.galaxy === targetPosition.galaxy &&
          mission.targetPosition.system === targetPosition.system &&
          mission.targetPosition.position === targetPosition.position
        if (from || to) detected.push(mission)
      })
      phalanxScanResults.value = detected
      phalanxScanning.value = false
    }, 800)
  }

  const getMissionTypeText = (missionType: string): string => t(`fleetView.${missionType}`)

  const loadQueryOrHome = (): void => {
    const queryGalaxy = Number(route.query.galaxy)
    const querySystem = Number(route.query.system)
    if (Number.isFinite(queryGalaxy) && queryGalaxy > 0 && Number.isFinite(querySystem) && querySystem > 0) {
      currentGalaxy.value = queryGalaxy
      currentSystem.value = querySystem
    } else if (gameStore.currentPlanet) {
      currentGalaxy.value = gameStore.currentPlanet.position.galaxy
      currentSystem.value = gameStore.currentPlanet.position.system
    }
    if (route.query.highlightNpc) highlightNpcId.value = String(route.query.highlightNpc)
    const highlighted = highlightNpcId.value ? npcStore.npcs.find(npc => npc.id === highlightNpcId.value) : null
    const highlightedPlanet = highlighted?.planets.find(planet => !planet.isMoon)
    if (highlightedPlanet) {
      currentGalaxy.value = highlightedPlanet.position.galaxy
      currentSystem.value = highlightedPlanet.position.system
      selectedSlotPosition.value = highlightedPlanet.position.position
    }
    selectedRegion.value = regionOf(currentGalaxy.value)
    selectedSystemId.value = `${currentCycle.value}:${regionOf(currentGalaxy.value)}:${currentSystem.value}`
    if (!highlightedPlanet) selectedSlotPosition.value = gameStore.currentPlanet?.position.position ?? 1
  }

  onMounted(() => {
    loadQueryOrHome()
    const first = systemSlots.value.find(slot => slot.planet)
    if (!selectedSlotPosition.value) selectedSlotPosition.value = first?.position ?? 1
  })

  watch([currentGalaxy, currentSystem], () => {
    selectedSystemId.value = `${currentCycle.value}:${regionOf(currentGalaxy.value)}:${currentSystem.value}`
    selectedRegion.value = regionOf(currentGalaxy.value)
    if (mapView.value === 'system') {
      selectedSlotPosition.value = systemSlots.value.find(slot => slot.planet)?.position ?? selectedSlotPosition.value ?? 1
    }
  })

  onBeforeUnmount(() => {
    if (scanInFlightTimer) window.clearTimeout(scanInFlightTimer)
  })


</script>
