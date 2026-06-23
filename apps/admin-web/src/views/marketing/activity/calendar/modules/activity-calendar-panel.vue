<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NAlert, NButton, NCard, NEmpty, NGi, NGrid, NTag } from 'naive-ui';
import type { ActivityCalendarConflict, ActivityCalendarDay } from '@/service/api/marketing';
import { ACTIVITY_TYPE_LABEL, resolveActivityStatus } from '../../modules/activity-table-columns';

defineOptions({ name: 'ActivityCalendarPanel' });

const PREVIEW_LIMIT = 3;

const props = defineProps<{
  loading: boolean;
  month: string;
  days: ActivityCalendarDay[];
  conflicts: ActivityCalendarConflict[];
}>();

const emit = defineEmits<{
  viewDetail: [activityId: string];
}>();

const visibleConflicts = computed(() => props.conflicts.slice(0, 6));

/** 按日期展开当日全部活动（换月后重置） */
const expandedDates = ref<Record<string, boolean>>({});

watch(
  () => props.month,
  () => {
    expandedDates.value = {};
  },
);

function isDayExpanded(date: string) {
  return Boolean(expandedDates.value[date]);
}

function setDayExpanded(date: string, value: boolean) {
  expandedDates.value = { ...expandedDates.value, [date]: value };
}

function itemsToShow(day: ActivityCalendarDay) {
  return isDayExpanded(day.date) ? day.items : day.items.slice(0, PREVIEW_LIMIT);
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date);
}

function formatActivityType(type: string) {
  return ACTIVITY_TYPE_LABEL[type] ?? type;
}
</script>

<template>
  <div class="flex-col-stretch gap-16px">
    <!-- 冲突提醒区：展示同日重叠活动，发布阻断仍以后端预检为准。 -->
    <NAlert v-if="visibleConflicts.length" type="warning" title="排期冲突提醒" :show-icon="false">
      <div class="flex flex-wrap gap-8px">
        <span v-for="item in visibleConflicts" :key="item.date" class="text-13px text-warning">
          {{ item.date }} 有 {{ item.count }} 个活动重叠
        </span>
      </div>
    </NAlert>

    <!-- 月视图区：按日期展示活动卡片，并允许展开当天全部活动。 -->
    <NCard :bordered="false" size="small" class="card-wrapper" :title="`${month} 活动排期`" :loading="loading">
      <NEmpty v-if="!days.length" description="当前筛选条件下暂无排期" class="py-24px" />

      <NGrid v-else cols="1 s:2 m:3 xl:7" responsive="screen" :x-gap="12" :y-gap="12">
        <NGi v-for="day in days" :key="day.date">
          <!-- 日期卡片：展示当天活动列表和冲突状态，点击活动进入详情。 -->
          <div
            class="h-full min-h-180px flex-col gap-10px border border-gray-200 rounded-12px bg-white px-12px py-12px shadow-sm"
            :class="day.hasConflict ? 'border-warning bg-warning/4' : ''"
          >
            <div class="flex items-center justify-between gap-8px">
              <div class="flex-col gap-4px">
                <span class="text-14px text-gray-900 font-semibold">{{ formatDateLabel(day.date) }}</span>
                <span class="text-12px text-gray-500">共 {{ day.total }} 个活动</span>
              </div>
              <NTag :type="day.hasConflict ? 'warning' : 'default'" size="small">
                {{ day.hasConflict ? '有冲突' : '正常' }}
              </NTag>
            </div>

            <div class="flex-col gap-8px">
              <div
                class="flex-col gap-8px"
                :class="isDayExpanded(day.date) ? 'max-h-280px overflow-y-auto pr-4px' : ''"
              >
                <div
                  v-for="item in itemsToShow(day)"
                  :key="item.id"
                  role="button"
                  tabindex="0"
                  class="cursor-pointer rounded-8px bg-gray-50 px-10px py-8px transition-colors hover:bg-primary/8"
                  @click="emit('viewDetail', item.id)"
                  @keydown.enter.prevent="emit('viewDetail', item.id)"
                  @keydown.space.prevent="emit('viewDetail', item.id)"
                >
                  <div class="flex items-center justify-between gap-8px">
                    <span class="truncate text-13px text-gray-900 font-medium">{{ item.name }}</span>
                    <NTag :type="resolveActivityStatus(item).type" size="small">
                      {{ resolveActivityStatus(item).label }}
                    </NTag>
                  </div>
                  <div class="mt-4px text-12px text-gray-500">
                    {{ formatActivityType(item.type) }} · {{ item.tenantName || item.tenantId }}
                  </div>
                </div>
              </div>

              <div v-if="day.items.length > PREVIEW_LIMIT" class="flex justify-end pt-2px">
                <NButton
                  v-if="!isDayExpanded(day.date)"
                  text
                  type="primary"
                  size="tiny"
                  @click="setDayExpanded(day.date, true)"
                >
                  展开全部（还有 {{ day.items.length - PREVIEW_LIMIT }} 个）
                </NButton>
                <NButton v-else text size="tiny" @click="setDayExpanded(day.date, false)">收起</NButton>
              </div>
            </div>
          </div>
        </NGi>
      </NGrid>
    </NCard>
  </div>
</template>
