<script setup lang="ts">
import { ref } from 'vue';
import FgTabbar from '@/tabbar/index.vue';
import { useCartTabbarBadge } from '@/tabbar/useCartTabbarBadge';
import { isPageTabbar, tabbarStore } from './tabbar/store';
import { currRoute } from './utils';

useCartTabbarBadge();

const isCurrentPageTabbar = ref(true);
onShow(() => {
  console.log('App.ku.vue onShow', currRoute());
  const { path } = currRoute();
  // “蜡笔小开心”提到本地是 '/pages/index/index'，线上是 '/' 导致线上 tabbar 不见了
  // 所以这里需要判断一下，如果是 '/' 就当做首页，也要显示 tabbar
  if (path === '/') {
    isCurrentPageTabbar.value = true;
  } else {
    isCurrentPageTabbar.value = isPageTabbar(path);
  }
  // 与真实栈顶页对齐高亮（避免仅依赖拦截器时偶发不同步）
  if (isCurrentPageTabbar.value) {
    tabbarStore.setAutoCurIdx(path || '/');
  }
});

const helloKuRoot = ref('Hello KuRoot');

const exposeRef = ref('this is form app.Ku.vue');

defineExpose({
  exposeRef,
});
</script>

<template>
  <view>
    <!-- 这个先隐藏了，知道这样用就行 -->
    <view class="hidden text-center"> {{ helloKuRoot }}，这里可以配置全局的东西 </view>

    <KuRootView />

    <FgTabbar v-if="isCurrentPageTabbar" />
  </view>
</template>
