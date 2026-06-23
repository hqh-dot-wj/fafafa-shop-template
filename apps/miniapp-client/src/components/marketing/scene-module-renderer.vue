<script lang="ts" setup>
import type { ClientModuleView } from '@/api/marketing';

defineOptions({ name: 'SceneModuleRenderer' });

// 场景模块渲染器只负责展示 ClientSceneController 返回的模块标题和插槽内容。
// 商品排序、模块曝光资格和兜底策略都在后端场景出数或上层 composable 中完成。
defineProps<{
  module: ClientModuleView;
}>();
</script>

<template>
  <view class="scene-module">
    <view class="scene-module__header">
      {{ module.moduleName }}
    </view>
    <slot />
  </view>
</template>
