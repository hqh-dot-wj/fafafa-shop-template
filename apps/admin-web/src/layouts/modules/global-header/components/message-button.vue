<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { fetchReadMessage } from '@/service/api/system/message';
import { useAdminInboxStore } from '@/store/modules/admin-inbox';
import { getMessageTypeMeta, navigateByMessage, navigateToFirstAvailableRoute } from '@/utils/message-navigation';

defineOptions({
  name: 'MessgaeButton',
});

const show = ref(false);
const router = useRouter();
const adminInbox = useAdminInboxStore();
const { items, unreadCount, loading } = storeToRefs(adminInbox);

onMounted(() => {
  // 收件箱在首屏并非必读：把第一次拉取推到 idle 时段，避免与首页 dashboard / SSE 三条请求挤占带宽。
  // 用户点开徽标时仍会通过 watch(show) 主动刷新一次，UX 不受影响。
  const refreshInbox = () => {
    adminInbox.refresh().catch(() => undefined);
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(refreshInbox, { timeout: 2000 });
  } else {
    setTimeout(refreshInbox, 0);
  }
});

watch(show, (open) => {
  if (open) {
    adminInbox.refresh().catch(() => undefined);
  }
});

async function handleItemClick(row: Api.System.Message) {
  if (!row.isRead) {
    try {
      await fetchReadMessage(row.id);
    } catch {
      // 已忽略：请求层已提示
    }
  }
  await adminInbox.refresh();
  show.value = false;
  await navigateByMessage(router, row);
}

async function handleReadAll() {
  const unread = items.value.filter((row) => !row.isRead);
  await Promise.all(
    unread.map((row) =>
      fetchReadMessage(row.id).catch(() => {
        // 单条失败不阻断其余
      }),
    ),
  );
  await adminInbox.refresh();
}

async function goMessageCenter() {
  show.value = false;
  await navigateToFirstAvailableRoute(router, ['system_notice', 'home'], { fallbackPath: '/' });
}
</script>

<template>
  <NPopover v-model:show="show" trigger="click" arrow-point-to-center raw class="border-rounded-6px">
    <template #trigger>
      <NTooltip :disabled="show">
        <template #trigger>
          <NButton quaternary class="bell-button h-36px text-icon" :focusable="false">
            <NBadge :value="unreadCount" :max="99" :offset="[2, -2]">
              <div class="bell-icon flex-center gap-8px">
                <SvgIcon local-icon="bell" />
              </div>
            </NBadge>
          </NButton>
        </template>
        {{ $t('page.home.message') }}
      </NTooltip>
    </template>
    <NCard
      size="small"
      :bordered="false"
      class="w-345px"
      header-class="p-0"
      :segmented="{ content: true, footer: 'soft' }"
    >
      <template #header>
        <span>站内消息</span>
      </template>
      <template #header-extra>
        <NTooltip placement="left" :z-index="98">
          <template #trigger>
            <NPopconfirm @positive-click="handleReadAll">
              <template #trigger>
                <NButton quaternary :disabled="loading || unreadCount === 0">
                  <div class="flex-center gap-8px">
                    <SvgIcon icon="lucide:mail-check" class="text-16px" />
                  </div>
                </NButton>
              </template>
              确定全部已读吗？
            </NPopconfirm>
          </template>
          一键已读
        </NTooltip>
      </template>
      <NScrollbar class="h-260px">
        <template v-if="items.length">
          <template v-for="(row, index) in items" :key="row.id">
            <NDivider v-show="index !== 0" />
            <div class="flex cursor-pointer" @click="handleItemClick(row)">
              <div class="flex-col justify-between gap-3px">
                <NEllipsis class="w-260px">{{ row.title }}</NEllipsis>
                <div class="flex items-center gap-8px text-#898989">
                  <NTag size="small" :type="getMessageTypeMeta(row.type).tagType">
                    {{ getMessageTypeMeta(row.type).label }}
                  </NTag>
                  <span>{{ row.createTime }}</span>
                </div>
              </div>
              <div>
                <NTag :type="row.isRead ? 'success' : 'error'">{{ row.isRead ? '已读' : '未读' }}</NTag>
              </div>
            </div>
          </template>
        </template>
        <NEmpty v-else class="h-180px flex-center" />
      </NScrollbar>
      <template #footer>
        <div class="flex items-center justify-end">
          <NButton type="primary" size="small" @click="goMessageCenter">查看通知公告</NButton>
        </div>
      </template>
    </NCard>
  </NPopover>
</template>

<style scoped lang="scss">
:deep(.n-divider) {
  margin: 12px 0;
}

:deep(.n-thing-header) {
  margin-bottom: 1px !important;
}

:deep(.n-thing-main__content) {
  margin-top: 0 !important;
}

:deep(.messgae-popover) {
  padding: 0 !important;
}

:deep(.n-badge-sup) {
  padding: 0 5px !important;
  font-size: 10px !important;
  height: 15px !important;
  line-height: 15px !important;
}

.bell-button {
  &:hover {
    .bell-icon {
      animation: bell-ring 1s both;
    }
  }
}

@keyframes bell-ring {
  0%,
  100% {
    transform-origin: top;
  }

  15% {
    transform: rotateZ(10deg);
  }

  30% {
    transform: rotateZ(-10deg);
  }

  45% {
    transform: rotateZ(5deg);
  }

  60% {
    transform: rotateZ(-5deg);
  }

  75% {
    transform: rotateZ(2deg);
  }
}
</style>
