<script setup lang="ts">
import { computed } from 'vue';
import { createReusableTemplate } from '@vueuse/core';
import { useThemeStore } from '@/store/modules/theme';

defineOptions({
  name: 'FinanceCardData',
});

interface Props {
  data: Api.Finance.Dashboard | null;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  refresh: [];
}>();

const themeStore = useThemeStore();

interface CardItem {
  key: string;
  title: string;
  value: number;
  unit: string;
  color: { start: string; end: string };
  icon: string;
}

const cardData = computed<CardItem[]>(() => {
  const d = props.data;
  return [
    {
      key: 'todayGMV',
      title: '今日收入',
      value: d?.todayGMV ?? 0,
      unit: '¥',
      color: { start: '#865ec0', end: '#5144b4' },
      icon: 'ant-design:money-collect-outlined',
    },
    {
      key: 'monthGMV',
      title: '本月收入',
      value: d?.monthGMV ?? 0,
      unit: '¥',
      color: { start: '#56cdf3', end: '#719de3' },
      icon: 'ant-design:line-chart-outlined',
    },
    {
      key: 'pendingWithdrawalAmount',
      title: '待提现总额',
      value: d?.pendingWithdrawalAmount ?? 0,
      unit: '¥',
      color: { start: '#f7b731', end: '#fa8231' },
      icon: 'ant-design:clock-circle-outlined',
    },
    {
      key: 'settledWithdrawalAmount',
      title: '已结算提现',
      value: d?.settledWithdrawalAmount ?? 0,
      unit: '¥',
      color: { start: '#18a058', end: '#0c7a43' },
      icon: 'ant-design:check-circle-outlined',
    },
  ];
});

interface GradientBgProps {
  gradientColor: string;
}

const [DefineGradientBg, GradientBg] = createReusableTemplate<GradientBgProps>();

function getGradientColor(color: CardItem['color']) {
  return `linear-gradient(to bottom right, ${color.start}, ${color.end})`;
}

function onRefresh() {
  emit('refresh');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <template #header>
      <div class="flex items-center justify-between">
        <span class="font-semibold">核心指标</span>
        <NButton text :loading="loading" @click="onRefresh">
          <template #icon>
            <icon-mdi-refresh class="text-icon" />
          </template>
          刷新
        </NButton>
      </div>
    </template>

    <DefineGradientBg v-slot="{ $slots, gradientColor }">
      <div
        class="px-16px pb-4px pt-8px text-white"
        :style="{ backgroundImage: gradientColor, borderRadius: themeStore.themeRadius + 'px' }"
      >
        <component :is="$slots.default" />
      </div>
    </DefineGradientBg>

    <NSpin :show="loading">
      <NGrid cols="s:1 m:2 l:4" responsive="screen" :x-gap="16" :y-gap="16">
        <NGi v-for="item in cardData" :key="item.key">
          <GradientBg :gradient-color="getGradientColor(item.color)" class="flex-1">
            <h3 class="text-16px">{{ item.title }}</h3>
            <div class="flex justify-between pt-12px">
              <SvgIcon :icon="item.icon" class="text-32px" />
              <CountTo
                :prefix="item.unit === '¥' ? '¥' : ''"
                :suffix="item.unit !== '¥' ? item.unit : ''"
                :start-value="0"
                :end-value="item.value"
                :duration="1000"
                class="text-30px text-white dark:text-dark"
              />
            </div>
          </GradientBg>
        </NGi>
      </NGrid>
    </NSpin>
  </NCard>
</template>

<style scoped></style>
