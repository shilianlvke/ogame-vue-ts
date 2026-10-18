<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/50 p-4">
    <!-- Logo 和标题 -->
    <div class="text-center mb-6 sm:mb-8 animate-fade-in">
      <img src="@/assets/logo.svg" alt="OGame Logo" class="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4" />
      <h1 class="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        {{ pkg.title }}
      </h1>
      <p class="text-muted-foreground mt-2 text-sm sm:text-base">{{ t('home.subtitle') }}</p>
    </div>

    <!-- 模式选择 -->
    <div class="w-full max-w-3xl grid gap-4 sm:grid-cols-2">
      <!-- 单机模式 -->
      <Card class="flex flex-col">
        <CardHeader class="pb-3">
          <CardTitle class="flex items-center gap-2 text-lg">
            <Rocket class="h-5 w-5 text-primary" />
            {{ t('home.modeSingle') }}
          </CardTitle>
          <CardDescription>{{ t('home.modeSingleDesc') }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-1 flex-col justify-end gap-3">
          <p class="text-xs text-muted-foreground">
            {{ hasLocalSave ? t('home.modeSingleExisting') : t('home.modeSingleNew') }}
          </p>
          <Button size="lg" class="w-full" :disabled="netStore.enabled" @click="enterSinglePlayer">
            <Rocket class="mr-2 h-5 w-5" />
            {{ hasLocalSave ? t('home.modeContinue') : t('home.startGame') }}
          </Button>
          <p v-if="netStore.enabled" class="text-xs text-muted-foreground">
            {{ t('home.modeSingleLocked') }}
          </p>
        </CardContent>
      </Card>

      <!-- 联机模式 -->
      <Card class="flex flex-col">
        <CardHeader class="pb-3">
          <CardTitle class="flex items-center gap-2 text-lg">
            <Globe2 class="h-5 w-5 text-primary" />
            {{ t('home.modeOnline') }}
            <Badge :variant="statusVariant">{{ statusText }}</Badge>
          </CardTitle>
          <CardDescription>{{ t('home.modeOnlineDesc') }}</CardDescription>
        </CardHeader>

        <CardContent class="flex flex-1 flex-col gap-3">
          <!-- 已连接 / 连接中 -->
          <template v-if="netStore.enabled">
            <div class="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">{{ t('online.player') }}</span>
                <span class="truncate font-medium">{{ netStore.name || netStore.playerId || '-' }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">{{ t('online.server') }}</span>
                <span class="truncate font-mono text-xs">{{ netStore.serverUrl }}</span>
              </div>
            </div>

            <p v-if="errorText" class="text-xs text-destructive">{{ errorText }}</p>

            <div class="mt-auto flex gap-2">
              <Button class="flex-1" :disabled="!netStore.isOnline" @click="enterOnline">
                <Play class="mr-2 h-4 w-4" />
                {{ netStore.isOnline ? t('online.enterGame') : statusText }}
              </Button>
              <Button variant="outline" @click="handleDisconnect">
                <Power class="h-4 w-4" />
              </Button>
            </div>
          </template>

          <!-- 未连接：登录表单 -->
          <template v-else>
            <div class="grid gap-1.5">
              <Label for="home-server" class="text-xs">{{ t('online.server') }}</Label>
              <Input id="home-server" v-model="netStore.serverUrl" placeholder="ws://127.0.0.1:25122/ws" />
            </div>
            <div class="grid gap-1.5">
              <Label for="home-name" class="text-xs">{{ t('online.name') }}</Label>
              <Input id="home-name" v-model="netStore.name" maxlength="24" placeholder="Commander" />
            </div>
            <div class="grid gap-1.5">
              <Label for="home-password" class="text-xs">{{ t('online.password') }}</Label>
              <Input
                id="home-password"
                v-model="netStore.password"
                type="password"
                autocomplete="current-password"
                :placeholder="t('online.passwordHint')"
              />
            </div>

            <p v-if="errorText" class="text-xs text-destructive">{{ errorText }}</p>

            <div class="mt-auto flex flex-col gap-2">
              <Button class="w-full" :disabled="netStore.status === 'connecting'" @click="handleConnect">
                <Link2 class="mr-2 h-4 w-4" />
                {{ netStore.status === 'connecting' ? t('online.connecting') : t('online.connect') }}
              </Button>
              <p class="text-[11px] leading-snug text-muted-foreground">{{ t('online.loginHint') }}</p>
            </div>
          </template>
        </CardContent>
      </Card>
    </div>

    <!-- 底部操作按钮 -->
    <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
      <!-- 语言切换 -->
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" size="sm">
            <Languages class="mr-2 h-4 w-4" />
            {{ localeNames[gameStore.locale] }}
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-48 p-2" side="top">
          <div class="space-y-1">
            <Button
              v-for="locale in availableLocales"
              :key="locale"
              @click="gameStore.locale = locale"
              :variant="gameStore.locale === locale ? 'secondary' : 'ghost'"
              class="w-full justify-start"
              size="sm"
            >
              {{ localeNames[locale] }}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <!-- 隐私协议按钮 -->
      <Button variant="ghost" size="sm" @click="showPrivacyDialog = true">
        <Shield class="mr-2 h-4 w-4" />
        {{ t('settings.privacyPolicy') }}
      </Button>
    </div>

    <!-- 隐私协议弹窗 -->
    <PrivacyDialog v-model:open="showPrivacyDialog" />

    <!-- 隐私协议同意确认弹窗 -->
    <AlertDialog v-model:open="showAgreementDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('home.privacyAgreement') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('home.privacyAgreementDesc') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div class="my-4 max-h-48 overflow-y-auto text-sm text-muted-foreground border rounded-lg p-3">
          <p>{{ t('privacy.sections.introduction.content') }}</p>
          <p class="mt-2">{{ t('privacy.sections.dataCollection.content') }}</p>
          <p class="mt-2">{{ t('privacy.sections.thirdParty.content') }}</p>
        </div>
        <div class="flex items-center gap-2 mb-4">
          <Checkbox id="privacy-agree" v-model="privacyAgreed" />
          <label for="privacy-agree" class="text-sm cursor-pointer">
            {{ t('home.agreeToPrivacy') }}
            <Button variant="link" class="p-0 h-auto text-sm" @click.prevent="showPrivacyDialog = true">
              {{ t('home.viewFullPolicy') }}
            </Button>
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel @click="privacyAgreed = false">{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction :disabled="!privacyAgreed" @click="confirmAgreement">
            {{ t('home.agreeAndStart') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useGameStore } from '@/stores/gameStore'
  import { useNetStore } from '@/stores/netStore'
  import { useI18n } from '@/composables/useI18n'
  import { localeNames, type Locale } from '@/locales'
  import { describeNetError, describeNetStatus } from '@/net/messages'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
  } from '@/components/ui/alert-dialog'
  import { Checkbox } from '@/components/ui/checkbox'
  import { Rocket, Globe2, Languages, Shield, Link2, Play, Power } from 'lucide-vue-next'
  import PrivacyDialog from '@/components/dialogs/PrivacyDialog.vue'
  import pkg from '../../package.json'

  const router = useRouter()
  const gameStore = useGameStore()
  const netStore = useNetStore()
  const { t } = useI18n()

  const showPrivacyDialog = ref(false)
  const showAgreementDialog = ref(false)
  const privacyAgreed = ref(false)
  /** 同意协议后要执行的动作（单机进入 / 联机连接） */
  const pendingAction = ref<'single' | 'online' | null>(null)
  /** 用户在本页发起了联机，登录成功后自动进入游戏 */
  const pendingOnlineEntry = ref(false)

  const availableLocales: Locale[] = ['zh-CN', 'zh-TW', 'en', 'de', 'ru', 'ko', 'ja']

  const hasLocalSave = computed(() => !netStore.enabled && gameStore.player.planets.length > 0)
  const statusText = computed(() => describeNetStatus(netStore.status, t))
  const errorText = computed(() => describeNetError(netStore.error, t))

  const statusVariant = computed<'default' | 'secondary' | 'destructive' | 'outline'>(() => {
    if (netStore.status === 'online') return 'default'
    if (netStore.status === 'error') return 'destructive'
    if (netStore.isBusy) return 'secondary'
    return 'outline'
  })

  /** 同意隐私协议后的统一入口 */
  const requireAgreement = (action: 'single' | 'online'): boolean => {
    if (gameStore.player.privacyAgreed) return true
    pendingAction.value = action
    showAgreementDialog.value = true
    return false
  }

  const confirmAgreement = () => {
    if (!privacyAgreed.value) return
    gameStore.player.privacyAgreed = true
    showAgreementDialog.value = false
    const action = pendingAction.value
    pendingAction.value = null
    if (action === 'single') {
      router.push('/overview')
    } else if (action === 'online') {
      startOnline()
    }
    privacyAgreed.value = false
  }

  const enterSinglePlayer = () => {
    if (requireAgreement('single')) {
      router.push('/overview')
    }
  }

  const handleConnect = () => {
    if (!netStore.serverUrl.trim()) {
      netStore.error = 'invalid_url'
      return
    }
    if (!netStore.tokenUsable && netStore.password.trim().length < 4) {
      netStore.error = 'auth:password_required'
      return
    }
    if (!requireAgreement('online')) return
    startOnline()
  }

  const startOnline = () => {
    netStore.error = ''
    pendingOnlineEntry.value = true
    netStore.connect()
  }

  const enterOnline = () => {
    if (netStore.isOnline) router.push('/overview')
  }

  const handleDisconnect = () => {
    pendingOnlineEntry.value = false
    netStore.disconnect()
  }

  // 登录成功后自动进入游戏（仅限本页发起的连接）
  watch(
    () => netStore.status,
    status => {
      if (status === 'online' && pendingOnlineEntry.value) {
        pendingOnlineEntry.value = false
        router.push('/overview')
      }
      if (status === 'error' || status === 'idle') {
        pendingOnlineEntry.value = false
      }
    }
  )
</script>

<style scoped>
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translate3d(0, -10px, 0);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }
</style>
