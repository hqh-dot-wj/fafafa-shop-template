<script setup lang="ts">
import type { CustomTabBarItem, CustomTabBarItemBadge } from './types';
import { tabbarStore } from './store';

defineProps<{
  item: CustomTabBarItem;
  index: number;
  isBulge?: boolean;
}>();

function getImageByIndex(index: number, item: CustomTabBarItem) {
  if (!item.iconActive) {
    console.warn('image 模式下，需要配置 iconActive (高亮时的图片），否则无法切换高亮图片');
    return item.icon;
  }
  return tabbarStore.curIdx === index ? item.iconActive : item.icon;
}

function getUiLibFallbackLabel(item: CustomTabBarItem) {
  return item.text.slice(0, 1) || '?';
}

/** 仅 1 位数字：严格正圆 */
function badgeNumShapeClass(badge: CustomTabBarItemBadge | undefined): string {
  if (badge === 'dot' || badge === undefined) return '';
  if (typeof badge !== 'number' || badge <= 0) return '';
  const text = badge > 99 ? '99+' : String(badge);
  return text.length <= 1 ? 'tabbar-badge-num--circle' : '';
}

/** 2 位及以上略缩小字号与字距，避免裁切 */
function badgeNumWideClass(badge: CustomTabBarItemBadge | undefined): string {
  if (badge === 'dot' || badge === undefined) return '';
  if (typeof badge !== 'number' || badge <= 0) return '';
  const text = badge > 99 ? '99+' : String(badge);
  return text.length > 1 ? 'tabbar-badge-num--wide' : '';
}
</script>

<template>
  <view class="flex flex-col items-center justify-center">
    <!-- 角标定位基准只能是「图标区域」，不能是整个 Tab 列（含文字），否则徽标会跑到整格右侧 -->
    <view
      class="relative flex shrink-0 items-center justify-center"
      :class="isBulge ? 'h-80px w-80px' : 'h-24px w-24px'"
    >
      <template v-if="item.iconType === 'uiLib'">
        <!-- 当前项目未接入具体 UI 库图标组件；若配置 uiLib，退化为首字占位，避免出现空白 tab。 -->
        <view :class="isBulge ? 'text-32px font-600' : 'text-18px font-600'">
          {{ getUiLibFallbackLabel(item) }}
        </view>
      </template>
      <template v-if="item.iconType === 'unocss' || item.iconType === 'iconfont'">
        <view :class="[item.icon, isBulge ? 'text-80px' : 'text-20px']" />
      </template>
      <template v-if="item.iconType === 'image'">
        <image
          :src="getImageByIndex(index, item)"
          mode="scaleToFill"
          :class="isBulge ? 'h-80px w-80px block' : 'h-24px w-24px block'"
        />
      </template>
      <!-- 叠在图标右上角，略向外「挂角」 -->
      <view v-if="item.badge" class="tabbar-badge-anchor pointer-events-none absolute z-10">
        <template v-if="item.badge === 'dot'">
          <view class="tabbar-badge-dot" />
        </template>
        <template v-else>
          <view class="tabbar-badge-num" :class="[badgeNumShapeClass(item.badge), badgeNumWideClass(item.badge)]">
            {{ item.badge > 99 ? '99+' : item.badge }}
          </view>
        </template>
      </view>
    </view>
    <view v-if="!isBulge" class="mt-2px text-12px">
      {{ item.text }}
    </view>
  </view>
</template>

<style scoped lang="scss">
/* 用 px + 固定高 + radius=高的一半，避免各端 rpx/百分比算成椭圆 */
.tabbar-badge-anchor {
  top: 8px;
  right: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(52%, -32%);
}

.tabbar-badge-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background-color: red;
}

$tab-h: 20px;
$tab-r: 10px;

.tabbar-badge-num {
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-width: $tab-h;
  height: $tab-h;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: #fff;
  white-space: nowrap;
  background-color: red;
  /* 半径=高度一半：多位数字为跑道圆；配合 overflow 裁剪更圆 */
  border-radius: $tab-r;
  overflow: hidden;
}

.tabbar-badge-num--circle {
  width: $tab-h;
  min-width: $tab-h;
  max-width: $tab-h;
  padding: 0;
  border-radius: 50%;
}

.tabbar-badge-num--wide {
  padding: 0 5px;
  font-size: 10px;
  letter-spacing: -0.3px;
}
</style>
