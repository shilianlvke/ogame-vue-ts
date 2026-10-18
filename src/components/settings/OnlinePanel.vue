<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Globe2 class="h-4 w-4 text-primary" />
        {{ t('home.modeOnline') }}
        <Badge :variant="statusVariant">{{ statusText }}</Badge>
      </CardTitle>
      <CardDescription>{{ t('home.modeOnlineDesc') }}</CardDescription>
    </CardHeader>

    <CardContent class="space-y-4">
      <!-- 未启用联机：填写连接参数 -->
      <template v-if="!net.enabled">
        <div class="grid gap-2">
          <Label for="online-server">{{ t('online.server') }}</Label>
          <Input id="online-server" v-model="net.serverUrl" placeholder="ws://127.0.0.1:25122/ws" />
        </div>

        <div class="grid gap-2">
          <Label for="online-name">{{ t('online.name') }}</Label>
          <Input id="online-name" v-model="net.name" maxlength="24" placeholder="Commander" />
        </div>

        <div class="grid gap-2">
          <Label for="online-password">{{ t('online.password') }}</Label>
          <Input
            id="online-password"
            v-model="net.password"
            type="password"
            autocomplete="current-password"
            :placeholder="t('online.passwordHint')"
          />
          <p class="text-xs text-muted-foreground">{{ net.tokenUsable ? t('online.passwordKeep') : t('online.passwordNew') }}</p>
        </div>

        <p class="text-xs text-muted-foreground">{{ t('online.backupHint') }}</p>

        <p v-if="errorText" class="text-xs text-destructive">{{ errorText }}</p>

        <Button class="w-full" :disabled="net.status === 'connecting'" @click="handleConnect">
          <Link2 class="mr-2 h-4 w-4" />
          {{ net.status === 'connecting' ? t('online.connecting') : t('online.connect') }}
        </Button>

        <p class="text-xs text-muted-foreground">{{ t('online.multiWindowHint') }}</p>
      </template>

      <!-- 已启用联机：显示状态与断开操作 -->
      <template v-else>
        <div class="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">{{ t('online.server') }}</span>
            <span class="font-mono text-xs">{{ net.serverUrl }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">{{ t('online.player') }}</span>
            <span class="font-medium">{{ net.name || net.playerId || '-' }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">{{ t('online.players') }}</span>
            <span class="font-medium">{{ net.playerCount }}</span>
          </div>
          <div v-if="net.players.length > 1" class="flex flex-wrap gap-1 pt-1">
            <Badge v-for="player in net.players" :key="player.id" variant="secondary" class="text-xs">
              {{ player.name }} · {{ player.points }}
            </Badge>
          </div>
        </div>

        <p v-if="errorText" class="text-xs text-destructive">{{ errorText }}</p>
        <p v-if="net.status === 'online'" class="text-xs text-muted-foreground">{{ t('online.onlineHint') }}</p>
        <p v-else-if="net.isBusy" class="text-xs text-muted-foreground">{{ t('online.reconnectHint') }}</p>

        <div class="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" class="flex-1" @click="confirmRestore = true">
            <RotateCcw class="mr-2 h-4 w-4" />
            {{ t('online.restoreLocal') }}
          </Button>
        </div>

        <div v-if="confirmRestore" class="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p class="text-sm">{{ t('online.restoreConfirm') }}</p>
          <div class="flex gap-2">
            <Button variant="destructive" size="sm" class="flex-1" @click="doRestoreLocal">
              {{ t('online.confirm') }}
            </Button>
            <Button variant="outline" size="sm" class="flex-1" @click="confirmRestore = false">
              {{ t('online.cancel') }}
            </Button>
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { Globe2, Link2, RotateCcw } from 'lucide-vue-next'
  import { useNetStore } from '@/stores/netStore'
  import { useI18n } from '@/composables/useI18n'
  import { describeNetError, describeNetStatus } from '@/net/messages'
  import { toast } from 'vue-sonner'

  const net = useNetStore()
  const { t } = useI18n()
  const confirmRestore = ref(false)

  const statusText = computed(() => describeNetStatus(net.status, t))
  const errorText = computed(() => describeNetError(net.error, t))

  const statusVariant = computed<'default' | 'secondary' | 'destructive' | 'outline'>(() => {
    if (net.status === 'online') return 'default'
    if (net.status === 'error') return 'destructive'
    if (net.isBusy) return 'secondary'
    return 'outline'
  })

  const handleConnect = () => {
    if (!net.serverUrl.trim()) {
      toast.error(t('online.error.invalidUrl'))
      return
    }
    // 没有可用令牌时需要密码：新账号注册或换设备登录
    if (!net.tokenUsable && net.password.trim().length < 4) {
      toast.error(t('online.error.passwordRequired'))
      return
    }
    net.connect()
  }

  const doRestoreLocal = () => {
    confirmRestore.value = false
    net.disconnect({ restoreLocal: true })
  }
</script>
