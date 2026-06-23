<script lang="ts" setup>
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    expireAt?: string;
    remainClicks?: number;
    remainBinds?: number;
  }>(),
  {
    expireAt: '',
  },
);

const badgeList = computed(() => {
  const list: string[] = [];
  if (props.expireAt) list.push(`有效期至：${props.expireAt}`);
  if (typeof props.remainClicks === 'number') list.push(`剩余点击：${Math.max(props.remainClicks, 0)}`);
  if (typeof props.remainBinds === 'number') list.push(`剩余绑定：${Math.max(props.remainBinds, 0)}`);
  return list;
});
</script>

<template>
  <view v-if="badgeList.length > 0" class="dist-policy-badge">
    <text v-for="(item, index) in badgeList" :key="`${item}-${index}`" class="dist-policy-badge__item">
      {{ item }}
    </text>
  </view>
</template>

<style lang="scss" scoped>
.dist-policy-badge {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;

  &__item {
    display: inline-flex;
    align-items: center;
    border-radius: 999rpx;
    background: rgba(24, 144, 255, 0.1);
    color: #1668dc;
    font-size: 22rpx;
    line-height: 1.2;
    padding: 10rpx 18rpx;
  }
}
</style>
