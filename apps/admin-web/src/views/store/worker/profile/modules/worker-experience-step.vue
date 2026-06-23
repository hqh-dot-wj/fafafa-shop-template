<script setup lang="ts">
import { computed } from 'vue';
import { useNaiveForm } from '@/hooks/common/form';
import CertificateUploadList from './certificate-upload-list.vue';

defineOptions({
  name: 'WorkerExperienceStep',
});

type ExperienceInfo = Api.Store.CreateWorkerProfileDto['experienceInfo'];

const model = defineModel<ExperienceInfo>('model', { required: true });

const { formRef, validate, restoreValidation } = useNaiveForm();

const rules = computed<Record<keyof ExperienceInfo, App.Global.FormRule[]>>(() => ({
  experienceYears: [],
  intro: [],
  certificates: [],
  remark: [],
}));

defineExpose({
  validate,
  restoreValidation,
});
</script>

<template>
  <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="92">
    <NGrid responsive="screen" item-responsive :x-gap="16" :y-gap="8">
      <!-- 工作经历首期只做资料沉淀，证书不是强制项。 -->
      <NFormItemGi span="24 s:12" label="工作年限" path="experienceYears">
        <NInputNumber v-model:value="model.experienceYears" :min="0" :max="80" class="w-full">
          <template #suffix>年</template>
        </NInputNumber>
      </NFormItemGi>
      <NFormItemGi span="24" label="个人简介" path="intro">
        <NInput
          v-model:value="model.intro"
          type="textarea"
          clearable
          placeholder="请输入个人简介、擅长说明或历史经验"
        />
      </NFormItemGi>
      <NFormItemGi span="24" label="证书资质" path="certificates">
        <CertificateUploadList v-model:value="model.certificates" />
      </NFormItemGi>
      <NFormItemGi span="24" label="内部备注" path="remark">
        <NInput v-model:value="model.remark" type="textarea" clearable placeholder="请输入内部备注" />
      </NFormItemGi>
    </NGrid>
  </NForm>
</template>
