<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { fetchCreateWorkerProfile, fetchUpdateWorkerProfile } from '@/service/api/store/worker';
import WorkerBasicStep from './worker-basic-step.vue';
import WorkerExperienceStep from './worker-experience-step.vue';
import WorkerWorkStep from './worker-work-step.vue';

defineOptions({
  name: 'WorkerProfileOperateDrawer',
});

type StepRef = {
  validate: () => Promise<void>;
  restoreValidation: () => Promise<void>;
};

const props = defineProps<{
  operateType: 'add' | 'edit';
  row: Api.Store.WorkerProfile | null;
}>();

const emit = defineEmits<{
  submitted: [];
}>();

const visible = defineModel<boolean>('visible', { required: true });

const basicStepRef = ref<StepRef | null>(null);
const workStepRef = ref<StepRef | null>(null);
const experienceStepRef = ref<StepRef | null>(null);
const currentStep = ref(1);
const submitLoading = ref(false);
const model = ref<Api.Store.CreateWorkerProfileDto>(createDefaultModel());

const title = computed(() => (props.operateType === 'add' ? '新增工作者' : '编辑工作者'));
const isLastStep = computed(() => currentStep.value === 3);

watch(
  () => visible.value,
  async (value) => {
    if (!value) return;
    currentStep.value = 1;
    model.value = props.operateType === 'edit' && props.row ? mapRowToForm(props.row) : createDefaultModel();
    await nextTick();
    basicStepRef.value?.restoreValidation();
    workStepRef.value?.restoreValidation();
    experienceStepRef.value?.restoreValidation();
  },
);

function createDefaultModel(): Api.Store.CreateWorkerProfileDto {
  return {
    basicInfo: {
      tenantId: undefined,
      name: '',
      nickName: '',
      phone: '',
      avatar: '',
      gender: 'UNKNOWN',
      address: {},
      remark: '',
    },
    workInfo: {
      serviceCategoryIds: [],
      skillTags: [],
      serviceArea: {},
      status: 'RESTING',
      isOnline: false,
      serviceRadius: 5000,
    },
    experienceInfo: {
      experienceYears: undefined,
      intro: '',
      certificates: [],
      remark: '',
    },
  };
}

function mapRowToForm(row: Api.Store.WorkerProfile): Api.Store.CreateWorkerProfileDto {
  return {
    basicInfo: {
      tenantId: row.tenantId,
      name: row.name,
      nickName: row.nickName,
      phone: row.phone,
      avatar: row.avatar,
      gender: row.gender,
      address: row.address || {},
      remark: row.remark,
    },
    workInfo: {
      serviceCategoryIds: row.serviceCategoryIds,
      skillTags: row.skillTags,
      serviceArea: row.serviceArea || {},
      status: row.status,
      isOnline: row.isOnline,
      serviceRadius: row.serviceRadius,
    },
    experienceInfo: {
      experienceYears: row.experienceYears,
      intro: row.intro,
      certificates: row.certificates,
      remark: row.remark,
    },
  };
}

async function validateCurrentStep() {
  const validators = [basicStepRef.value, workStepRef.value, experienceStepRef.value];
  await validators[currentStep.value - 1]?.validate();
}

async function nextStep() {
  await validateCurrentStep();
  currentStep.value += 1;
}

function prevStep() {
  currentStep.value -= 1;
}

async function submit() {
  await validateCurrentStep();
  submitLoading.value = true;
  try {
    if (props.operateType === 'edit' && props.row) {
      await fetchUpdateWorkerProfile(props.row.workerId, model.value);
      window.$message?.success('工作者资料已更新');
    } else {
      await fetchCreateWorkerProfile(model.value);
      window.$message?.success('工作者资料已创建');
    }
    visible.value = false;
    emit('submitted');
  } finally {
    submitLoading.value = false;
  }
}
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="760">
    <NDrawerContent :title="title" closable>
      <!-- 三步大表单只在前端分步，最终提交时统一发送后端 DTO。 -->
      <NSteps :current="currentStep" class="mb-20px">
        <NStep title="基础资料" />
        <NStep title="工作资料" />
        <NStep title="工作经历" />
      </NSteps>

      <WorkerBasicStep v-show="currentStep === 1" ref="basicStepRef" v-model:model="model.basicInfo" />
      <WorkerWorkStep v-show="currentStep === 2" ref="workStepRef" v-model:model="model.workInfo" />
      <WorkerExperienceStep v-show="currentStep === 3" ref="experienceStepRef" v-model:model="model.experienceInfo" />

      <template #footer>
        <NSpace justify="end">
          <NButton v-if="currentStep > 1" @click="prevStep">上一步</NButton>
          <NButton v-if="!isLastStep" type="primary" @click="nextStep">下一步</NButton>
          <NButton v-else type="primary" :loading="submitLoading" @click="submit">保存</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
