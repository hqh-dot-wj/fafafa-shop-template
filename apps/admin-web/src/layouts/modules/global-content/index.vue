<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { LAYOUT_SCROLL_EL_ID } from '@sa/materials';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import { useRouteStore } from '@/store/modules/route';
import { useTabStore } from '@/store/modules/tab';

defineOptions({
  name: 'GlobalContent',
});

interface Props {
  /** Show padding for content */
  showPadding?: boolean;
}

withDefaults(defineProps<Props>(), {
  showPadding: true,
});

const appStore = useAppStore();
const themeStore = useThemeStore();
const routeStore = useRouteStore();
const tabStore = useTabStore();
const currentRoute = useRoute();

const transitionName = computed(() => (themeStore.page.animate ? themeStore.page.animateMode : ''));
/** 无过渡动画时不使用 out-in，避免异步组件未就绪时旧页已卸载、主区域长时间空白 */
const transitionMode = computed<'out-in' | undefined>(() =>
  themeStore.page.animate && transitionName.value ? 'out-in' : undefined,
);
const footerVar = computed(() => themeStore.footer.visible);
const contentLoadError = ref('');
const contentLoadErrorRoute = ref('');

const contentErrorRouteText = computed(() => contentLoadErrorRoute.value || currentRoute.fullPath || '-');

function resetScroll() {
  const el = document.querySelector(`#${LAYOUT_SCROLL_EL_ID}`);

  el?.scrollTo({ left: 0, top: 0 });
}

function formatContentLoadError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function clearContentLoadError() {
  contentLoadError.value = '';
  contentLoadErrorRoute.value = '';
}

async function retryContentLoad() {
  clearContentLoadError();
  await appStore.reloadPage(80);
}

function reloadBrowserPage() {
  window.location.reload();
}

onErrorCaptured((error, _instance, info) => {
  contentLoadError.value = formatContentLoadError(error);
  contentLoadErrorRoute.value = currentRoute.fullPath || String(currentRoute.name ?? '');

  console.error('[global-content] route component failed', {
    error,
    info,
    route: {
      fullPath: currentRoute.fullPath,
      name: currentRoute.name,
      path: currentRoute.path,
    },
  });

  return false;
});

watch(
  () => currentRoute.fullPath,
  () => {
    clearContentLoadError();
  },
);
</script>

<template>
  <div
    v-if="appStore.reloadFlag && contentLoadError"
    :key="`error-${tabStore.getTabIdByRoute(currentRoute)}`"
    :class="{ 'p-16px': showPadding, 'footer-var': footerVar }"
    class="min-h-240px flex flex-col flex-grow items-center justify-center gap-12px bg-layout text-center transition-300"
  >
    <div class="text-16px text-red-600 font-medium">页面加载失败</div>
    <div class="max-w-640px text-13px text-gray-500">当前路径：{{ contentErrorRouteText }}</div>
    <div class="max-w-640px break-all text-12px text-gray-400">
      {{ contentLoadError }}
    </div>
    <div class="flex-center gap-12px">
      <button
        class="rounded-4px bg-primary px-14px py-6px text-13px text-white"
        type="button"
        @click="retryContentLoad"
      >
        重试
      </button>
      <button
        class="border border-gray-300 rounded-4px px-14px py-6px text-13px text-gray-600"
        type="button"
        @click="reloadBrowserPage"
      >
        刷新页面
      </button>
    </div>
  </div>
  <RouterView v-else v-slot="routerView">
    <Transition
      :name="transitionName"
      :mode="transitionMode"
      @before-leave="appStore.setContentXScrollable(true)"
      @after-leave="resetScroll"
      @after-enter="appStore.setContentXScrollable(false)"
    >
      <KeepAlive :include="routeStore.cacheRoutes" :exclude="routeStore.excludeCacheRoutes">
        <component
          :is="routerView?.Component"
          v-if="appStore.reloadFlag && routerView?.Component"
          :key="tabStore.getTabIdByRoute(routerView.route || currentRoute)"
          :class="{ 'p-16px': showPadding, 'footer-var': footerVar }"
          class="min-h-0 flex-grow bg-layout transition-300"
        />
        <div
          v-else-if="appStore.reloadFlag"
          :key="`loading-${tabStore.getTabIdByRoute(routerView?.route || currentRoute)}`"
          class="min-h-240px flex flex-center flex-grow text-14px text-gray-500"
        >
          页面加载中…
        </div>
      </KeepAlive>
    </Transition>
  </RouterView>
</template>

<style>
.footer-var {
  --calc-footer-height: var(--soy-footer-height);
}
</style>
