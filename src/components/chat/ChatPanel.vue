<template>
  <!-- 右下角入口 -->
  <Button variant="outline" size="icon" class="relative" :title="t('chat.stationTitle')" @click="open = !open">
    <MessageCircle class="h-4 w-4" />
    <Badge
      v-if="triggerUnread > 0"
      variant="destructive"
      class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center p-0 text-xs animate-pulse"
    >
      {{ triggerUnread > 9 ? '9+' : triggerUnread }}
    </Badge>
  </Button>

  <!-- 星际通讯站：仿 QQ 的通讯录 + 聊天浮框 -->
  <Teleport to="body">
    <Transition name="chat-dock">
      <div
        v-if="open"
        class="fixed bottom-4 right-4 z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
        :style="panelStyle"
      >
        <!-- 顶部标题栏 -->
        <div class="flex h-9 shrink-0 items-center justify-between bg-muted/60 px-3">
          <div class="flex min-w-0 items-center gap-2">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
              <Gamepad2 class="h-3 w-3" />
            </span>
            <span class="truncate text-xs font-semibold text-foreground">{{ t('chat.stationTitle') }}</span>
            <span class="hidden shrink-0 items-center gap-1 text-[10px] text-muted-foreground sm:flex">
              <span class="h-1.5 w-1.5 rounded-full" :class="netStore.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/50'" />
              {{ gameStore.player.name }}
            </span>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <button type="button" class="qq-titlebar-btn" :title="t('common.close')" @click="open = false">
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div class="flex min-h-0 flex-1">
          <!-- 左侧功能栏（桌面） -->
          <nav class="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/60 py-2 sm:flex">
            <button
              type="button"
              class="rail-btn relative"
              :class="{ 'rail-btn-active': stationView === 'chats' }"
              :title="t('chat.chats')"
              @click="showChats"
            >
              <MessageCircle class="h-5 w-5" />
              <span v-if="totalUnread > 0" class="rail-badge">{{ totalUnread > 9 ? '9+' : totalUnread }}</span>
            </button>
            <button
              type="button"
              class="rail-btn"
              :class="{ 'rail-btn-active': stationView === 'contacts' }"
              :title="t('chat.contacts')"
              @click="showContacts"
            >
              <Users class="h-5 w-5" />
            </button>
            <div class="mt-auto">
              <button type="button" class="rail-btn" disabled :title="t('chat.tradeDisabled')">
                <ArrowLeftRight class="h-5 w-5" />
              </button>
            </div>
          </nav>

          <!-- 会话列表 / 通讯录 -->
          <aside
            class="w-full shrink-0 flex-col border-r border-border bg-muted/30 sm:flex sm:w-64"
            :class="mobilePane === 'list' ? 'flex' : 'hidden'"
          >
            <!-- 移动端：聊天 / 通讯录 -->
            <div class="grid shrink-0 grid-cols-2 gap-1 border-b border-border p-2 sm:hidden">
              <button
                type="button"
                class="rounded px-2 py-1 text-xs transition-colors"
                :class="stationView === 'chats' ? 'bg-accent text-foreground' : 'text-muted-foreground'"
                @click="showChatsList"
              >
                {{ t('chat.chats') }}
              </button>
              <button
                type="button"
                class="rounded px-2 py-1 text-xs transition-colors"
                :class="stationView === 'contacts' ? 'bg-accent text-foreground' : 'text-muted-foreground'"
                @click="showContactsList"
              >
                {{ t('chat.contacts') }}
              </button>
            </div>

            <!-- 搜索 -->
            <div class="shrink-0 p-2">
              <div class="relative">
                <Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  v-model="search"
                  class="h-8 border-border bg-background pl-8 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/60"
                  :placeholder="t('chat.search')"
                />
                <button
                  type="button"
                  class="absolute right-1.5 top-1.5 flex h-5 w-5 cursor-not-allowed items-center justify-center rounded text-muted-foreground/70"
                  disabled
                  :title="t('common.soon')"
                >
                  <Plus class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <!-- 聊天列表 -->
            <template v-if="stationView === 'chats'">
              <ScrollArea class="min-h-0 flex-1">
                <div class="space-y-0.5 p-1">
                  <button
                    v-for="conversation in filteredConversations"
                    :key="conversation.id"
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                    :class="activeConversationId === conversation.id && mainView === 'chat' ? 'bg-accent' : ''"
                    :title="conversation.name"
                    @click="openConversation(conversation.id)"
                  >
                    <span
                      class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                      :class="conversation.kind === 'group' ? 'bg-primary/10 text-primary' : 'text-primary-foreground'"
                      :style="conversation.kind === 'private' ? avatarStyle(conversation.peerId || '') : undefined"
                    >
                      <UsersRound v-if="conversation.kind === 'group'" class="h-5 w-5" />
                      <template v-else>{{ initials(conversation.name) }}</template>
                      <span
                        v-if="conversation.kind === 'private' && conversation.online"
                        class="absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500"
                      />
                      <span v-if="conversation.unread > 0" class="rail-badge">{{ conversation.unread > 9 ? '9+' : conversation.unread }}</span>
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center justify-between gap-2">
                        <span
                          class="truncate text-[13px] font-medium"
                          :class="activeConversationId === conversation.id && mainView === 'chat' ? 'text-primary' : 'text-foreground'"
                        >
                          {{ conversation.name }}
                        </span>
                        <span class="shrink-0 text-[10px] text-muted-foreground">{{ conversation.timeLabel }}</span>
                      </span>
                      <span class="mt-0.5 flex text-[10px] text-muted-foreground">
                        <span class="truncate">{{ conversation.preview }}</span>
                      </span>
                    </span>
                  </button>
                  <p v-if="filteredConversations.length === 0" class="px-2 py-8 text-center text-[11px] text-muted-foreground">
                    {{ t('chat.noConversations') }}
                  </p>
                </div>
              </ScrollArea>
            </template>

            <!-- 通讯录 -->
            <template v-else>
              <div class="mx-2 mb-1 grid shrink-0 grid-cols-2 gap-1 rounded-md bg-card p-0.5 text-[11px]">
                <button
                  type="button"
                  class="rounded px-2 py-1 transition-colors"
                  :class="contactSection === 'friends' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'"
                  @click="selectContactSection('friends')"
                >
                  {{ t('nav.players') }}
                  <span class="ml-0.5 text-[9px] text-muted-foreground">{{ players.length }}</span>
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1 transition-colors"
                  :class="contactSection === 'groups' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'"
                  @click="selectContactSection('groups')"
                >
                  {{ t('chat.groups') }}
                  <span class="ml-0.5 text-[9px] text-muted-foreground">1</span>
                </button>
              </div>

              <PlayerRoster
                v-if="contactSection === 'friends'"
                :players="filteredPlayers"
                :my-id="myId"
                :selected-id="selectedContactId"
                :empty-key="rosterEmptyKey"
                class="min-h-0 flex-1"
                @select="openPlayerDetail"
              />

              <ScrollArea v-else class="min-h-0 flex-1">
                <div class="space-y-0.5 p-1">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                    @click="openGroupDetail()"
                  >
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UsersRound class="h-5 w-5 text-primary" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center justify-between gap-2">
                        <span class="truncate text-[13px] font-medium text-foreground">{{ t('chat.title') }}</span>
                        <span class="shrink-0 text-[10px] text-muted-foreground">
                          {{ players.length }} {{ t('chat.members') }}
                        </span>
                      </span>
                      <span class="mt-0.5 flex text-[10px] text-muted-foreground">
                        <span class="truncate">{{ onlineCount }} {{ t('players.online') }} · {{ t('chat.groupHint') }}</span>
                      </span>
                    </span>
                  </button>
                </div>
              </ScrollArea>
            </template>
          </aside>

          <!-- 主区域 -->
          <section
            class="min-w-0 flex-1 flex-col bg-card sm:flex"
            :class="mobilePane === 'main' ? 'flex' : 'hidden'"
          >
            <!-- 联系人 / 群聊资料 -->
            <template v-if="mainView === 'detail' && detail">
              <!-- 玩家资料卡 -->
              <template v-if="detail.type === 'player' && detailPlayer">
                <div class="flex h-11 shrink-0 items-center border-b border-border px-2">
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    :title="t('common.back')"
                    @click="backFromDetail"
                  >
                    <ChevronLeft class="h-4 w-4" />
                    {{ t('common.back') }}
                  </button>
                </div>

                <div class="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-10">
                  <div class="flex flex-col items-center">
                    <div class="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/50 via-primary/15 to-transparent p-1">
                      <div
                        class="flex h-full w-full items-center justify-center rounded-full text-2xl font-semibold text-primary-foreground"
                        :style="avatarStyle(detailPlayer.id)"
                      >
                        {{ initials(detailPlayer.name) }}
                      </div>
                    </div>
                    <div class="mt-3 flex items-center gap-2">
                      <h2 class="max-w-[220px] truncate text-lg font-semibold text-foreground">{{ detailPlayer.name }}</h2>
                      <span
                        class="rounded px-1.5 py-0.5 text-[10px]"
                        :class="detailPlayer.online ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
                      >
                        {{ detailPlayer.online ? t('players.online') : t('players.offline') }}
                      </span>
                    </div>
                    <p class="mt-1 max-w-full truncate text-[11px] text-muted-foreground">ID: {{ detailPlayer.id }}</p>

                    <div class="mt-8 w-full max-w-sm space-y-1 text-sm">
                      <div class="flex items-center gap-3 border-b border-border py-3">
                        <Info class="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span class="w-14 shrink-0 text-muted-foreground">{{ t('players.profileIntro') }}</span>
                        <span class="min-w-0 flex-1 truncate text-foreground">
                          {{ t('players.commander') }} · {{ detailPlayer.online ? t('players.online') : t('players.offline') }}
                        </span>
                      </div>
                      <div class="flex items-center gap-3 border-b border-border py-3">
                        <Coins class="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span class="w-14 shrink-0 text-muted-foreground">{{ t('players.points') }}</span>
                        <span class="min-w-0 flex-1 truncate text-foreground">{{ formatNumber(detailPlayer.points) }}</span>
                      </div>
                      <div class="flex items-center gap-3 border-b border-border py-3">
                        <Globe class="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span class="w-14 shrink-0 text-muted-foreground">{{ t('players.planets') }}</span>
                        <span class="min-w-0 flex-1 truncate text-foreground">{{ detailPlayer.planetCount }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-border p-3">
                  <button type="button" class="profile-btn" disabled :title="t('common.soon')">
                    {{ t('players.share') }}
                  </button>
                  <button type="button" class="profile-btn" disabled :title="t('common.soon')">
                    {{ t('players.addToGroup') }}
                  </button>
                  <button type="button" class="profile-btn-primary" @click="openDetailMessage">
                    {{ t('players.sendMessage') }}
                  </button>
                </div>
              </template>

              <!-- 群聊资料卡 -->
              <template v-else-if="detail.type === 'group'">
                <div class="flex h-11 shrink-0 items-center border-b border-border px-2">
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    :title="t('common.back')"
                    @click="backFromDetail"
                  >
                    <ChevronLeft class="h-4 w-4" />
                    {{ t('common.back') }}
                  </button>
                </div>

                <div class="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10">
                  <div class="flex flex-col items-center">
                    <div class="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/50 via-primary/15 to-transparent p-1">
                      <div class="flex h-full w-full items-center justify-center rounded-full bg-primary/10">
                        <UsersRound class="h-10 w-10 text-primary" />
                      </div>
                    </div>
                    <h2 class="mt-3 text-lg font-semibold text-foreground">{{ t('chat.title') }}</h2>
                    <p class="mt-1 text-[11px] text-muted-foreground">{{ t('chat.groupHint') }}</p>

                    <div class="mt-6 flex items-center gap-6 text-sm">
                      <span class="flex items-center gap-1.5 text-foreground">
                        <Users class="h-4 w-4 text-muted-foreground" />
                        {{ t('chat.members') }} {{ players.length }}
                      </span>
                      <span class="flex items-center gap-1.5 text-foreground">
                        <span class="h-2 w-2 rounded-full bg-emerald-500" />
                        {{ onlineCount }} {{ t('players.online') }}
                      </span>
                    </div>

                    <div class="mt-8 w-full max-w-md">
                      <div class="mb-2 text-xs text-muted-foreground">{{ t('chat.members') }}</div>
                      <div class="grid grid-cols-2 gap-2">
                        <div
                          v-for="member in players.slice(0, 12)"
                          :key="member.id"
                          class="flex items-center gap-2 rounded-md bg-muted/40 p-2"
                        >
                          <span
                            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-primary-foreground"
                            :style="avatarStyle(member.id)"
                          >
                            {{ initials(member.name) }}
                          </span>
                          <span class="min-w-0 flex-1">
                            <span class="block truncate text-xs text-foreground">{{ member.name }}</span>
                            <span
                              class="text-[10px]"
                              :class="member.online ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'"
                            >
                              {{ member.online ? t('players.online') : t('players.offline') }}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex shrink-0 items-center justify-center border-t border-border p-3">
                  <button type="button" class="profile-btn-primary" @click="openDetailMessage">
                    {{ t('players.sendMessage') }}
                  </button>
                </div>
              </template>

              <template v-else>
                <div class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <Users class="h-10 w-10 text-muted-foreground/50" />
                  <p class="text-sm text-muted-foreground">{{ t('chat.selectContact') }}</p>
                </div>
              </template>
            </template>

            <!-- 聊天窗口 -->
            <template v-else-if="mainView === 'chat' && activeConversation">
              <div class="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
                <div class="flex min-w-0 items-center gap-2">
                  <button type="button" class="rail-btn qq-mobile-only" :title="t('common.back')" @click="mobilePane = 'list'">
                    <ChevronLeft class="h-5 w-5" />
                  </button>
                  <button type="button" class="flex min-w-0 items-center gap-2 text-left" :title="activeConversation.name" @click="openActiveDetail">
                    <span
                      class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                      :class="activeConversation.kind === 'group' ? 'bg-primary/10 text-primary' : 'text-primary-foreground'"
                      :style="activeConversation.kind === 'private' ? avatarStyle(activeConversation.peerId || '') : undefined"
                    >
                      <UsersRound v-if="activeConversation.kind === 'group'" class="h-4 w-4" />
                      <template v-else>{{ initials(activeConversation.name) }}</template>
                      <span
                        v-if="activeConversation.kind === 'private' && activeOnline"
                        class="absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500"
                      />
                    </span>
                    <span class="min-w-0">
                      <span class="flex items-baseline gap-1">
                        <h3 class="truncate text-sm font-semibold text-foreground">{{ activeConversation.name }}</h3>
                        <span v-if="activeConversation.kind === 'group'" class="text-xs text-muted-foreground">
                          ({{ players.length }})
                        </span>
                      </span>
                      <span class="block truncate text-[10px] text-muted-foreground">
                        <template v-if="activeConversation.kind === 'group'">
                          {{ onlineCount }} {{ t('players.online') }} · {{ t('chat.groupHint') }}
                        </template>
                        <template v-else>
                          {{ activeOnline ? t('players.online') : t('players.offline') }}
                          <template v-if="activePeer">
                            · {{ formatNumber(activePeer.points) }} {{ t('players.points') }} · {{ activePeer.planetCount }}
                            {{ t('players.planets') }}
                          </template>
                        </template>
                      </span>
                    </span>
                  </button>
                </div>
                <div class="flex shrink-0 items-center gap-0.5">
                  <button type="button" class="rail-btn" :title="t('common.viewDetails')" @click="openActiveDetail">
                    <Info class="h-4 w-4" />
                  </button>
                  <button type="button" class="rail-btn" :title="t('chat.contacts')" @click="showContacts">
                    <Users class="h-4 w-4" />
                  </button>
                  <button type="button" class="rail-btn qq-desktop-only" disabled :title="t('common.soon')">
                    <Bell class="h-4 w-4" />
                  </button>
                  <button type="button" class="rail-btn qq-desktop-only" disabled :title="t('common.soon')">
                    <Settings class="h-4 w-4" />
                  </button>
                  <button type="button" class="rail-btn qq-desktop-only" disabled :title="t('common.soon')">
                    <MoreHorizontal class="h-4 w-4" />
                  </button>
                </div>
              </div>

              <ScrollArea class="min-h-0 flex-1">
                <div class="space-y-4 px-4 py-4">
                  <template v-for="message in activeMessages" :key="message.id">
                    <div v-if="message.fromId === 'system'" class="flex justify-center">
                      <span class="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{{ message.text }}</span>
                    </div>
                    <div v-else class="flex gap-2" :class="message.fromId === myId ? 'flex-row-reverse' : ''">
                      <span
                        class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground"
                        :style="avatarStyle(message.fromId)"
                      >
                        {{ initials(message.fromName) }}
                      </span>
                      <div class="min-w-0 max-w-[75%]">
                        <div
                          class="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground"
                          :class="message.fromId === myId ? 'justify-end' : ''"
                        >
                          <span class="text-muted-foreground">{{ message.fromName }}</span>
                          <span>{{ formatTime(message.timestamp) }}</span>
                        </div>
                        <div
                          class="whitespace-pre-wrap break-words rounded-md px-3 py-2 text-sm leading-relaxed"
                          :class="message.fromId === myId ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'"
                        >
                          {{ message.text }}
                        </div>
                      </div>
                    </div>
                  </template>
                  <p v-if="activeMessages.length === 0" class="py-16 text-center text-xs text-muted-foreground">
                    {{ t('chat.empty') }}
                  </p>
                  <div ref="bottomRef" />
                </div>
              </ScrollArea>

              <div class="shrink-0 border-t border-border">
                <div class="flex flex-wrap items-center gap-1 px-2 pt-1.5">
                  <button type="button" class="trade-btn" disabled :title="t('chat.tradeDisabled')">
                    <ArrowLeftRight class="h-3.5 w-3.5" />
                    {{ t('players.tradeTitle') }}
                  </button>
                  <span class="mr-1 text-[10px] text-muted-foreground/70">{{ t('chat.tradeDisabled') }}</span>
                  <span class="mx-1 h-4 w-px bg-border" />
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><Smile class="h-4 w-4" /></button>
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><Scissors class="h-4 w-4" /></button>
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><Folder class="h-4 w-4" /></button>
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><ImageIcon class="h-4 w-4" /></button>
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><Mic class="h-4 w-4" /></button>
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><MessageSquare class="h-4 w-4" /></button>
                  <span v-if="!netStore.isOnline" class="ml-auto text-[10px] text-amber-600 dark:text-amber-400">
                    {{ t('chat.offline') }}
                  </span>
                </div>
                <div class="flex items-center gap-2 p-2">
                  <Input
                    v-model="draft"
                    :maxlength="MAX_CHAT_LENGTH"
                    :placeholder="t('chat.placeholder')"
                    class="h-9 border-0 bg-muted text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
                    @keydown.enter.prevent="send"
                  />
                  <button type="button" class="chat-send-btn" :disabled="!canSend" @click="send">
                    {{ t('chat.send') }}
                    <ChevronDown class="h-3 w-3 opacity-70" />
                  </button>
                </div>
              </div>
            </template>

            <!-- 空状态 -->
            <template v-else>
              <div class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <MessageCircle class="h-10 w-10 text-muted-foreground/50" />
                <p class="text-sm text-muted-foreground">
                  {{ stationView === 'contacts' ? t('chat.selectContact') : t('chat.selectConversation') }}
                </p>
              </div>
            </template>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useMediaQuery } from '@vueuse/core'
  import {
    ArrowLeftRight,
    Bell,
    ChevronDown,
    ChevronLeft,
    Coins,
    Folder,
    Gamepad2,
    Globe,
    Image as ImageIcon,
    Info,
    MessageCircle,
    MessageSquare,
    Mic,
    MoreHorizontal,
    Plus,
    Scissors,
    Search,
    Settings,
    Smile,
    Users,
    UsersRound,
    X
  } from 'lucide-vue-next'
  import { toast } from 'vue-sonner'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { ScrollArea } from '@/components/ui/scroll-area'
  import PlayerRoster from '@/components/chat/PlayerRoster.vue'
  import { useGameStore } from '@/stores/gameStore'
  import { useNetStore } from '@/stores/netStore'
  import { useI18n } from '@/composables/useI18n'
  import { MAX_CHAT_LENGTH } from '@/core/commands'
  import { dispatchCommand } from '@/core/runtime'
  import { formatNumber } from '@/utils/format'
  import type { ChatMessage } from '@/types/game'
  import type { PlayerPublicProfile } from '@/core/protocol'

  type StationView = 'chats' | 'contacts'
  type ContactSection = 'friends' | 'groups'
  type MainView = 'chat' | 'detail' | 'empty'
  type MobilePane = 'list' | 'main'
  type ConversationKind = 'group' | 'private'
  type Detail = { type: 'player'; id: string } | { type: 'group' }

  interface Conversation {
    id: string
    kind: ConversationKind
    peerId?: string
    name: string
    online: boolean
    preview: string
    timeLabel: string
    lastAt: number
    unread: number
  }

  const route = useRoute()
  const gameStore = useGameStore()
  const netStore = useNetStore()
  const { t } = useI18n()
  const isMobile = useMediaQuery('(max-width: 639px)')

  // 旧 /players 入口会带 chat=1 跳转过来，直接展开浮框
  const open = ref(route.query.chat === '1')
  const stationView = ref<StationView>('chats')
  const contactSection = ref<ContactSection>('friends')
  const mainView = ref<MainView>('chat')
  const mobilePane = ref<MobilePane>('list')
  const activeConversationId = ref<string | null>('group')
  const detail = ref<Detail | null>(null)
  const detailFromChat = ref(false)
  const openedPrivateIds = ref<string[]>([])
  const openedAt = ref<Record<string, number>>({})
  const search = ref('')
  const drafts = ref<Record<string, string>>({})
  const cooling = ref(false)
  const readAt = ref<Record<string, number>>({})
  const sessionStart = Date.now()
  const bottomRef = ref<HTMLElement | null>(null)

  const panelStyle = {
    width: 'min(920px, calc(100vw - 2rem))',
    height: 'min(560px, calc(100svh - 6rem))'
  }

  const myId = computed(() => netStore.playerId || gameStore.player.id)

  // 玩家列表：在线优先，其次按积分和昵称排序
  const players = computed(() =>
    [...netStore.players].sort(
      (a, b) => Number(b.online) - Number(a.online) || b.points - a.points || a.name.localeCompare(b.name)
    )
  )

  const playersById = computed(() => new Map(players.value.map(player => [player.id, player] as const)))

  const filteredPlayers = computed(() => {
    const keyword = search.value.trim().toLowerCase()
    if (!keyword) return players.value
    return players.value.filter(
      player => player.name.toLowerCase().includes(keyword) || player.id.toLowerCase().includes(keyword)
    )
  })

  const rosterEmptyKey = computed(() => (players.value.length === 0 ? 'chat.noPlayers' : 'players.selectPlayer'))
  const selectedContactId = computed(() => (detail.value?.type === 'player' ? detail.value.id : null))
  const onlineCount = computed(() => netStore.playerCount)

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const formatConversationTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    if (date.toDateString() === now.toDateString()) return formatTime(timestamp)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const avatarStyle = (id: string): Record<string, string> => {
    let hash = 0
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360
    return { backgroundColor: `hsl(${hash} 55% 42%)` }
  }

  const initials = (name: string): string => (name.trim().slice(0, 2) || '?').toUpperCase()

  const markRead = (id: string | null): void => {
    if (!id) return
    readAt.value[id] = Date.now()
  }

  const unreadFor = (id: string, messages: ChatMessage[], fromOther: (message: ChatMessage) => boolean): number => {
    const since = readAt.value[id] ?? sessionStart
    return messages.filter(message => message.timestamp > since && fromOther(message)).length
  }

  const privateMessagesFor = (peerId: string): ChatMessage[] => {
    const me = myId.value
    return (gameStore.player.chatMessages ?? [])
      .filter(
        message =>
          !!message.toId &&
          ((message.fromId === me && message.toId === peerId) || (message.fromId === peerId && message.toId === me))
      )
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  const publicMessages = computed(() =>
    (gameStore.player.chatMessages ?? []).filter(message => !message.toId).sort((a, b) => a.timestamp - b.timestamp)
  )

  const conversations = computed<Conversation[]>(() => {
    const list: Conversation[] = []
    const groupLast = publicMessages.value[publicMessages.value.length - 1]
    list.push({
      id: 'group',
      kind: 'group',
      name: t('chat.title'),
      online: true,
      preview: groupLast
        ? groupLast.fromId === myId.value
          ? `${t('players.me')}: ${groupLast.text}`
          : groupLast.fromId === 'system'
            ? groupLast.text
            : `${groupLast.fromName}: ${groupLast.text}`
        : t('chat.empty'),
      timeLabel: groupLast ? formatConversationTime(groupLast.timestamp) : '',
      lastAt: groupLast?.timestamp ?? 0,
      unread: unreadFor('group', publicMessages.value, message => message.fromId !== myId.value)
    })

    const allMessages = gameStore.player.chatMessages ?? []
    const peerIds = new Set<string>(openedPrivateIds.value)
    for (const message of allMessages) {
      if (!message.toId) continue
      if (message.fromId === myId.value) peerIds.add(message.toId)
      else if (message.toId === myId.value) peerIds.add(message.fromId)
    }

    for (const peerId of peerIds) {
      if (peerId === myId.value) continue
      const peer = playersById.value.get(peerId)
      const messages = privateMessagesFor(peerId)
      const last = messages[messages.length - 1]
      const lastAt = last?.timestamp ?? openedAt.value[peerId] ?? 0
      list.push({
        id: `private:${peerId}`,
        kind: 'private',
        peerId,
        name: peer?.name ?? messages.find(message => message.fromId === peerId)?.fromName ?? peerId,
        online: peer?.online ?? false,
        preview: last
          ? last.fromId === myId.value
            ? `${t('players.me')}: ${last.text}`
            : last.text
          : t('chat.empty'),
        timeLabel: lastAt ? formatConversationTime(lastAt) : '',
        lastAt,
        unread: unreadFor(`private:${peerId}`, messages, message => message.fromId === peerId)
      })
    }

    return list.sort((a, b) => b.lastAt - a.lastAt || (a.kind === 'group' ? -1 : 1))
  })

  const filteredConversations = computed(() => {
    const keyword = search.value.trim().toLowerCase()
    if (!keyword) return conversations.value
    return conversations.value.filter(
      conversation =>
        conversation.name.toLowerCase().includes(keyword) || conversation.preview.toLowerCase().includes(keyword)
    )
  })

  const totalUnread = computed(() => conversations.value.reduce((sum, conversation) => sum + conversation.unread, 0))
  const triggerUnread = computed(() => (open.value ? 0 : totalUnread.value))
  const activeConversation = computed(
    () => conversations.value.find(conversation => conversation.id === activeConversationId.value) ?? null
  )

  const activePeer = computed(() => {
    const conversation = activeConversation.value
    if (!conversation || conversation.kind !== 'private' || !conversation.peerId) return null
    return playersById.value.get(conversation.peerId) ?? null
  })

  const activeMessages = computed(() => {
    const conversation = activeConversation.value
    if (!conversation) return []
    if (conversation.kind === 'group') return publicMessages.value
    return conversation.peerId ? privateMessagesFor(conversation.peerId) : []
  })

  const activeOnline = computed(
    () => activePeer.value?.online ?? activeConversation.value?.online ?? false
  )

  const detailPlayer = computed(() => {
    const current = detail.value
    if (current?.type !== 'player') return null
    return playersById.value.get(current.id) ?? null
  })

  const viewingChat = computed(
    () =>
      open.value &&
      stationView.value === 'chats' &&
      mainView.value === 'chat' &&
      !!activeConversation.value &&
      (!isMobile.value || mobilePane.value === 'main')
  )

  const draft = computed({
    get: () => (activeConversationId.value ? drafts.value[activeConversationId.value] ?? '' : ''),
    set: (value: string) => {
      if (!activeConversationId.value) return
      drafts.value = { ...drafts.value, [activeConversationId.value]: value }
    }
  })

  const canSend = computed(() => netStore.isOnline && draft.value.trim().length > 0 && !cooling.value)

  const scrollToBottom = async (): Promise<void> => {
    await nextTick()
    bottomRef.value?.scrollIntoView({ block: 'end' })
  }

  const showChats = (): void => {
    stationView.value = 'chats'
    mainView.value = 'chat'
    search.value = ''
    if (isMobile.value) mobilePane.value = 'list'
  }

  const showContacts = (): void => {
    stationView.value = 'contacts'
    contactSection.value = 'friends'
    mainView.value = detail.value ? 'detail' : 'empty'
    search.value = ''
    if (isMobile.value) mobilePane.value = 'list'
  }

  const showChatsList = (): void => {
    stationView.value = 'chats'
    mainView.value = 'chat'
    search.value = ''
    mobilePane.value = 'list'
  }

  const showContactsList = (): void => {
    stationView.value = 'contacts'
    mainView.value = detail.value ? 'detail' : 'empty'
    search.value = ''
    mobilePane.value = 'list'
  }

  const selectContactSection = (next: ContactSection): void => {
    contactSection.value = next
    search.value = ''
    if (isMobile.value) mobilePane.value = 'list'
  }

  const openConversation = (id: string): void => {
    activeConversationId.value = id
    stationView.value = 'chats'
    mainView.value = 'chat'
    if (isMobile.value) mobilePane.value = 'main'
    markRead(id)
    void nextTick(scrollToBottom)
  }

  const openGroupChat = (): void => {
    openConversation('group')
  }

  const openPrivateChat = (peerId: string): void => {
    if (!openedPrivateIds.value.includes(peerId)) {
      openedPrivateIds.value.push(peerId)
      openedAt.value[peerId] = Date.now()
    }
    openConversation(`private:${peerId}`)
  }

  const openPlayerDetail = (player: PlayerPublicProfile, fromChat = false): void => {
    detail.value = { type: 'player', id: player.id }
    detailFromChat.value = fromChat
    stationView.value = 'contacts'
    mainView.value = 'detail'
    if (isMobile.value) mobilePane.value = 'main'
  }

  const openGroupDetail = (fromChat = false): void => {
    detail.value = { type: 'group' }
    detailFromChat.value = fromChat
    stationView.value = 'contacts'
    mainView.value = 'detail'
    if (isMobile.value) mobilePane.value = 'main'
  }

  const backFromDetail = (): void => {
    if (detailFromChat.value) {
      stationView.value = 'chats'
      mainView.value = 'chat'
      if (isMobile.value) mobilePane.value = 'main'
      return
    }
    mainView.value = 'empty'
    if (isMobile.value) mobilePane.value = 'list'
  }

  const openActiveDetail = (): void => {
    const conversation = activeConversation.value
    if (!conversation) return
    if (conversation.kind === 'group') {
      openGroupDetail(true)
      return
    }
    const peer = conversation.peerId ? playersById.value.get(conversation.peerId) : null
    if (peer) openPlayerDetail(peer, true)
  }

  const openDetailMessage = (): void => {
    const current = detail.value
    if (!current) return
    if (current.type === 'group') {
      openGroupChat()
      return
    }
    openPrivateChat(current.id)
  }

  const send = (): void => {
    const conversation = activeConversation.value
    const text = draft.value.trim()
    if (!conversation || !text || cooling.value) return
    if (!netStore.isOnline) {
      toast.error(t('chat.offline'))
      return
    }

    const result =
      conversation.kind === 'private' && conversation.peerId
        ? dispatchCommand({ type: 'chat.send', text, toPlayerId: conversation.peerId })
        : dispatchCommand({ type: 'chat.send', text })
    if (!result.ok) {
      toast.error(t(result.reason ?? 'errors.unknown'))
      return
    }

    drafts.value = { ...drafts.value, [conversation.id]: '' }
    cooling.value = true
    // 与服务端的 1 秒冷却对齐，避免点了没反应
    window.setTimeout(() => {
      cooling.value = false
    }, 1100)
    markRead(conversation.id)
    void scrollToBottom()
  }

  // 旧 /players 入口跳转时自动展开
  watch(
    () => route.query.chat,
    value => {
      if (value === '1') open.value = true
    }
  )

  // 打开浮框：桌面停在聊天，移动端停在会话列表
  watch(
    open,
    isOpen => {
      if (!isOpen) return
      stationView.value = 'chats'
      mainView.value = 'chat'
      mobilePane.value = isMobile.value ? 'list' : 'main'
      if (!isMobile.value) {
        markRead(activeConversationId.value)
        void scrollToBottom()
      }
    },
    { immediate: true }
  )

  // 聊天窗口可见时自动已读并滚到底部
  watch(
    [viewingChat, activeConversationId],
    ([visible, id]) => {
      if (!visible || !id) return
      markRead(id)
      void scrollToBottom()
    },
    { immediate: true }
  )

  watch(
    () => activeMessages.value[activeMessages.value.length - 1]?.id,
    () => {
      if (!viewingChat.value) return
      markRead(activeConversationId.value)
      void scrollToBottom()
    }
  )

  // 切换桌面/移动端时，回到列表更符合移动端习惯
  watch(isMobile, mobile => {
    mobilePane.value = mobile ? 'list' : 'main'
  })
</script>

<style scoped>
  @media (min-width: 640px) {
    .qq-mobile-only {
      display: none !important;
    }
  }

  @media (max-width: 639px) {
    .qq-desktop-only {
      display: none !important;
    }
  }

  .chat-dock-enter-active,
  .chat-dock-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .chat-dock-enter-from,
  .chat-dock-leave-to {
    opacity: 0;
    transform: translateY(8px);
  }

  .qq-titlebar-btn {
    display: flex;
    height: 24px;
    width: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--muted-foreground);
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .qq-titlebar-btn:hover {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  .rail-btn {
    display: flex;
    height: 36px;
    width: 36px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: var(--muted-foreground);
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .rail-btn:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  .rail-btn:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .rail-btn-active {
    background: color-mix(in oklab, var(--primary) 14%, transparent);
    color: var(--primary);
  }

  .rail-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    display: flex;
    min-width: 16px;
    height: 16px;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: var(--destructive);
    padding: 0 3px;
    font-size: 9px;
    line-height: 1;
    color: var(--destructive-foreground);
  }

  .profile-btn {
    height: 32px;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: transparent;
    padding: 0 18px;
    font-size: 12px;
    color: var(--muted-foreground);
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .profile-btn:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  .profile-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .profile-btn-primary {
    height: 32px;
    border-radius: 5px;
    background: var(--primary);
    padding: 0 22px;
    font-size: 12px;
    font-weight: 500;
    color: var(--primary-foreground);
    transition: filter 0.15s ease;
  }

  .profile-btn-primary:hover {
    filter: brightness(1.05);
  }

  .trade-btn {
    display: inline-flex;
    height: 26px;
    cursor: not-allowed;
    align-items: center;
    gap: 4px;
    border-radius: 4px;
    padding: 0 6px;
    font-size: 11px;
    color: var(--muted-foreground);
    opacity: 0.6;
  }

  .tool-btn {
    display: flex;
    height: 26px;
    width: 26px;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--muted-foreground);
  }

  .tool-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .chat-send-btn {
    display: inline-flex;
    height: 36px;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    border-radius: 6px;
    background: var(--primary);
    padding: 0 14px;
    font-size: 13px;
    color: var(--primary-foreground);
    white-space: nowrap;
    transition: filter 0.15s ease;
  }

  .chat-send-btn:hover:not(:disabled) {
    filter: brightness(1.05);
  }

  .chat-send-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
