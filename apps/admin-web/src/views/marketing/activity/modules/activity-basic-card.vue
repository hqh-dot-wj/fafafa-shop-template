<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NForm, NFormItem, NGrid, NInput } from 'naive-ui';

interface ActivityBasicForm {
  name: string;
  type: string;
  description: string;
  startTime: string;
  endTime: string;
}

const props = defineProps<{
  model: ActivityBasicForm;
}>();

const model = computed(() => props.model);
</script>

<template>
  <!-- 活动基础信息区：编辑活动名称、类型、时间窗和描述。 -->
  <NCard title="基础信息" :bordered="false" size="small">
    <NForm :model="model" label-placement="left" :label-width="96">
      <NGrid :cols="2" :x-gap="12">
        <NFormItem label="活动名称">
          <NInput v-model:value="model.name" />
        </NFormItem>
        <NFormItem label="活动类型">
          <NInput v-model:value="model.type" disabled />
        </NFormItem>
        <NFormItem label="开始时间">
          <input v-model="model.startTime" type="datetime-local" class="w-full" />
        </NFormItem>
        <NFormItem label="结束时间">
          <input v-model="model.endTime" type="datetime-local" class="w-full" />
        </NFormItem>
        <NFormItem label="活动描述" :span="2">
          <NInput v-model:value="model.description" type="textarea" :rows="2" />
        </NFormItem>
      </NGrid>
    </NForm>
  </NCard>
</template>
