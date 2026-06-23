<script setup lang="ts">
import { NButton, NCollapse, NCollapseItem, NSpace, NStep, NSteps } from 'naive-ui';

defineOptions({ name: 'SceneWorkflowGuide' });

const emit = defineEmits<{
  (e: 'toPolicy'): void;
  (e: 'toSceneModule'): void;
  (e: 'toConfig'): void;
  (e: 'toRuntimeLedger'): void;
}>();
</script>

<template>
  <!-- 场景投放向导区：按推荐顺序引导运营完成策略、模块、配置、发布和运行态核对。 -->
  <NCollapse>
    <NCollapseItem title="场景投放向导（推荐顺序）" name="marketing-scene-wizard">
      <NSteps vertical>
        <NStep
          title="维护策略配置"
          description="在策略配置中维护 SOURCE / AUDIENCE / RESOLVER / SORT 等策略，供场景模块按需引用。"
        />
        <NStep title="编排场景模块" description="在场景模块中维护投放模块、绑定策略、排序和展示上限。" />
        <NStep title="确认活动配置" description="在活动配置中确认可投放的活动、商品池和门店参与范围已准备完成。" />
        <NStep
          title="本页预检并发布"
          description="先做预检修复阻塞项，再发布场景；发布后结合监控数据观察成功率与延迟。"
        />
        <NStep
          title="核对运行态台账（可选）"
          description="查看场景、聚合页与开关类 sys_config 台账，和监控数据交叉确认是否已正确生效。"
        />
      </NSteps>
      <NSpace class="mt-12px" wrap>
        <NButton size="small" type="primary" ghost @click="emit('toPolicy')">去策略配置</NButton>
        <NButton size="small" type="primary" ghost @click="emit('toSceneModule')">去场景模块</NButton>
        <NButton size="small" type="primary" ghost @click="emit('toConfig')">去活动配置</NButton>
        <NButton size="small" type="default" ghost @click="emit('toRuntimeLedger')">去运行态台账</NButton>
      </NSpace>
    </NCollapseItem>
  </NCollapse>
</template>

<style scoped></style>
