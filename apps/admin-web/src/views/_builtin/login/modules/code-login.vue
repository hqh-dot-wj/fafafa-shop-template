<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { SelectOption } from 'naive-ui';
import { useCountDown, useLoading } from '@sa/hooks';
import { fetchSendAdminLoginCode, fetchTenantList } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';
import { useRouterPush } from '@/hooks/common/router';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { REG_PHONE } from '@/constants/reg';
import { $t } from '@/locales';

defineOptions({
  name: 'CodeLogin',
});

const authStore = useAuthStore();
const { toggleLoginModule } = useRouterPush();
const { formRef, validate } = useNaiveForm();
const { loading: sendLoading, startLoading: startSend, endLoading: endSend } = useLoading();
const { loading: tenantLoading, startLoading: startTenantLoading, endLoading: endTenantLoading } = useLoading();
const { count, start, isCounting } = useCountDown(60);

const tenantEnabled = ref(false);
const tenantOption = ref<SelectOption[]>([]);

interface FormModel {
  tenantId: string;
  phone: string;
  code: string;
}

const model: FormModel = reactive({
  tenantId: '000000',
  phone: '',
  code: '',
});

const sendLabel = computed(() => {
  if (sendLoading.value) return '';
  if (isCounting.value) return `${count.value}s 后重发`;
  return $t('page.login.codeLogin.getCode');
});

const rules = computed<Record<keyof FormModel, App.Global.FormRule[]>>(() => {
  const { formRules } = useFormRules();

  return {
    tenantId: tenantEnabled.value ? formRules.tenantId : [],
    phone: formRules.phone,
    code: formRules.code,
  };
});

async function handleFetchTenantList() {
  startTenantLoading();
  try {
    const { data } = await fetchTenantList();
    if (!data) return;
    tenantEnabled.value = data.tenantEnabled;
    if (data.tenantEnabled) {
      tenantOption.value = data.voList.map((t) => ({ label: t.companyName, value: t.tenantId }));
    }
  } finally {
    endTenantLoading();
  }
}

handleFetchTenantList();

function validatePhone(): boolean {
  if (!model.phone.trim()) {
    window.$message?.error($t('form.phone.required'));
    return false;
  }
  if (!REG_PHONE.test(model.phone)) {
    window.$message?.error($t('form.phone.invalid'));
    return false;
  }
  return true;
}

async function handleSendCode() {
  if (!validatePhone() || sendLoading.value || isCounting.value) return;
  startSend();
  try {
    await fetchSendAdminLoginCode({ mobile: model.phone.trim(), tenantId: model.tenantId });
    window.$message?.success($t('page.login.codeLogin.sendCodeSuccess'));
    start();
  } finally {
    endSend();
  }
}

async function handleSubmit() {
  await validate();
  try {
    await authStore.loginBySms({
      mobile: model.phone.trim(),
      code: model.code.trim(),
      tenantId: model.tenantId,
    });
  } catch {
    // 拦截器已提示
  }
}
</script>

<template>
  <div class="mb-5px text-32px text-black font-600 sm:text-30px dark:text-white">
    {{ $t('page.login.codeLogin.title') }}
  </div>
  <div class="pb-18px text-16px text-#858585">请输入已登记的管理员手机号，验证码将发送至该号码</div>
  <NForm ref="formRef" :model="model" :rules="rules" size="large" :show-label="false" @keyup.enter="handleSubmit">
    <NFormItem v-if="tenantEnabled" path="tenantId">
      <NSelect
        v-model:value="model.tenantId"
        placeholder="请选择租户"
        :options="tenantOption"
        :loading="tenantLoading"
      />
    </NFormItem>
    <NFormItem path="phone">
      <NInput v-model:value="model.phone" :placeholder="$t('page.login.common.phonePlaceholder')" />
    </NFormItem>
    <NFormItem path="code">
      <div class="w-full flex-y-center gap-16px">
        <NInput v-model:value="model.code" :placeholder="$t('page.login.common.codePlaceholder')" />
        <NButton size="large" :disabled="isCounting" :loading="sendLoading" @click="handleSendCode">
          {{ sendLabel }}
        </NButton>
      </div>
    </NFormItem>
    <NSpace vertical :size="20" class="w-full">
      <NButton type="primary" size="large" block :loading="authStore.loginLoading" @click="handleSubmit">
        {{ $t('page.login.codeLogin.title') }}
      </NButton>
      <NButton size="large" block @click="toggleLoginModule('pwd-login')">
        {{ $t('page.login.common.back') }}
      </NButton>
    </NSpace>
  </NForm>
</template>

<style scoped>
:deep(.n-base-selection),
:deep(.n-input) {
  --n-height: 42px !important;
  --n-font-size: 16px !important;
  --n-border-radius: 8px !important;
}

:deep(.n-base-selection-label) {
  padding: 0 6px !important;
}

:deep(.n-button) {
  --n-height: 42px !important;
  --n-font-size: 18px !important;
  --n-border-radius: 8px !important;
}
</style>
