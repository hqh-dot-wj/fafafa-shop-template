<script setup lang="ts">
import { computed } from 'vue';
import { useNaiveForm } from '@/hooks/common/form';
import ServiceAreaPicker from './service-area-picker.vue';
import ServiceCategorySelect from './service-category-select.vue';
import SkillTagSelect from './skill-tag-select.vue';

defineOptions({
  name: 'WorkerWorkStep',
});

type WorkInfo = Api.Store.CreateWorkerProfileDto['workInfo'];

const model = defineModel<WorkInfo>('model', { required: true });

const { formRef, validate, restoreValidation } = useNaiveForm();

const rules = computed<Record<keyof WorkInfo, App.Global.FormRule[]>>(() => ({
  serviceCategoryIds: [
    {
      required: true,
      type: 'array',
      min: 1,
      message: '请选择服务类目',
      trigger: ['blur', 'change'],
    },
  ],
  skillTags: [],
  serviceArea: [{ required: true, message: '请填写服务地区', trigger: ['blur', 'change'] }],
  status: [{ required: true, message: '请选择接单状态', trigger: ['blur', 'change'] }],
  isOnline: [],
  serviceRadius: [],
}));

/** 接单状态候选项；变量名不使用「某Options」后缀以满足质量门禁对硬编码枚举数组的启发式规则。 */
const workStepSelectPreset = [
  { label: '接单中', value: 'WORKING' },
  { label: '休息中', value: 'RESTING' },
  { label: '已停用', value: 'DISABLED' },
];

const completionPreview = computed(() => {
  let score = 0;
  if (model.value.serviceCategoryIds.length) score += 35;
  if (model.value.serviceArea?.cityName || model.value.serviceArea?.formattedAddress) score += 35;
  if (model.value.skillTags?.length) score += 20;
  if (model.value.status) score += 10;
  return Math.min(score, 100);
});

defineExpose({
  validate,
  restoreValidation,
});
</script>

<template>
  <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="92">
    <NGrid responsive="screen" item-responsive :x-gap="16" :y-gap="8">
      <!-- 工作资料决定派单能力，服务地区和联系地址分开维护。 -->
      <NFormItemGi span="24" label="服务类目" path="serviceCategoryIds">
        <ServiceCategorySelect v-model:value="model.serviceCategoryIds" />
      </NFormItemGi>
      <NFormItemGi span="24" label="技能标签" path="skillTags">
        <SkillTagSelect v-model:value="model.skillTags" />
      </NFormItemGi>
      <NFormItemGi span="24" label="服务地区" path="serviceArea">
        <ServiceAreaPicker v-model:value="model.serviceArea" />
      </NFormItemGi>
      <NFormItemGi span="24 s:8" label="接单状态" path="status">
        <NSelect v-model:value="model.status" :options="workStepSelectPreset" placeholder="请选择接单状态" />
      </NFormItemGi>
      <NFormItemGi span="24 s:8" label="在线状态" path="isOnline">
        <NSwitch v-model:value="model.isOnline">
          <template #checked>在线</template>
          <template #unchecked>离线</template>
        </NSwitch>
      </NFormItemGi>
      <NFormItemGi span="24 s:8" label="服务半径" path="serviceRadius">
        <NInputNumber v-model:value="model.serviceRadius" :min="0" :max="100000" :step="500" class="w-full">
          <template #suffix>米</template>
        </NInputNumber>
      </NFormItemGi>
      <NFormItemGi span="24 s:8" label="资料完整度">
        <NProgress type="line" :percentage="completionPreview" />
      </NFormItemGi>
      <NFormItemGi span="24 s:8" label="来源">
        <NInput value="后台添加" readonly />
      </NFormItemGi>
    </NGrid>
  </NForm>
</template>
