<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

defineOptions({
  name: 'TableSiderLayout',
});

interface Props {
  defaultExpanded?: boolean;
  siderTitle?: string;
}

withDefaults(defineProps<Props>(), {
  defaultExpanded: false,
  siderTitle: undefined,
});

const time = new Date().getTime();
const breakpoints = useBreakpoints(breakpointsTailwind);
const isCollapse = breakpoints.smaller('lg');
</script>

<template>
  <NGrid
    v-if="isCollapse"
    class="min-h-500px flex-col-stretch gap-16px overflow-auto"
    :x-gap="12"
    :y-gap="12"
    item-responsive
    responsive="screen"
  >
    <!-- 小于 lg 时纵向堆叠：侧栏占满一行，避免 m:8 等窄列把标题挤成竖排 -->
    <NGridItem span="24">
      <NCard
        :bordered="false"
        size="small"
        class="sider-layout-card h-full card-wrapper"
        content-class="sider-layout-card-content"
      >
        <NCollapse v-if="isCollapse" :default-expanded-names="defaultExpanded ? [`table-sider-layout${time}`] : []">
          <NCollapseItem :name="`table-sider-layout${time}`" display-directive="show">
            <template #header>
              <slot name="header">
                <div class="collapse-sider-head min-w-0 w-full flex flex-col gap-8px">
                  <span v-if="siderTitle" class="title">{{ siderTitle }}</span>
                  <div v-if="$slots['header-extra']" class="flex flex-wrap gap-8px" @click.stop>
                    <slot name="header-extra" />
                  </div>
                </div>
              </slot>
            </template>
            <slot name="sider" />
          </NCollapseItem>
        </NCollapse>
      </NCard>
    </NGridItem>
    <NGridItem class="content" span="24">
      <slot />
    </NGridItem>
  </NGrid>
  <NLayout v-else has-sider class="table-sider-layout-desktop min-h-0">
    <NLayoutSider
      collapse-mode="transform"
      :collapsed-width="0"
      :width="320"
      show-trigger="bar"
      class="table-sider-layout-sider"
    >
      <NCard
        :bordered="false"
        size="small"
        class="sider-layout-card h-full min-h-0 flex flex-col card-wrapper"
        content-class="sider-layout-card-content flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <template #header>
          <slot name="header">
            <div class="sider-card-head min-w-0 w-full flex flex-col gap-10px">
              <span v-if="siderTitle" class="title">{{ siderTitle }}</span>
              <div v-if="$slots['header-extra']" class="flex flex-wrap gap-8px">
                <slot name="header-extra" />
              </div>
            </div>
          </slot>
        </template>
        <slot name="sider" />
      </NCard>
    </NLayoutSider>
    <NLayoutContent content-class="bg-transparent">
      <slot />
    </NLayoutContent>
  </NLayout>
</template>

<style scoped>
.title {
  font-weight: 500;
  font-size: 16px;
  line-height: 1.4;
  min-width: 0;
  width: 100%;
  color: var(--n-title-text-color);
}

.content {
  min-height: calc(100vh - 196px - var(--calc-footer-height, 0px));
}

:deep(.n-collapse-item__header) {
  padding-top: 0 !important;
  align-items: flex-start;
}

:deep(.n-collapse-item__header-main) {
  min-width: 0;
  flex: 1;
}

:deep(.n-layout-content) {
  background-color: transparent;
  padding-left: 25px;
}

:deep(.n-layout-sider) {
  background-color: transparent;
}

/* 侧栏标题与操作按钮纵向排列，避免窄宽度下与 header-extra 同一行挤压成「一字一行」 */
:deep(.sider-layout-card .n-card-header) {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

:deep(.sider-layout-card .n-card-header__main) {
  flex: none;
  width: 100%;
  max-width: 100%;
}

:deep(.sider-layout-card .n-card-header__extra) {
  display: none;
}

.table-sider-layout-desktop {
  min-height: calc(100vh - 196px - var(--calc-footer-height, 0px));
}

.table-sider-layout-desktop :deep(.n-layout-scroll-container) {
  min-height: inherit;
}

.table-sider-layout-sider :deep(.n-layout-sider-scroll-container) {
  height: 100%;
  min-height: inherit;
}
</style>
