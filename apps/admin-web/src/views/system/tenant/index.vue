<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, watch } from 'vue';
import type { UploadFileInfo } from 'naive-ui';
import { useLoading } from '@sa/hooks';
import { REG_PHONE } from '@/constants/reg';
import {
  type ShopSettingsPayload,
  fetchGetShopSettings,
  fetchUpdateShopSettings,
} from '@/service/api/system/shop-settings';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { useAuth } from '@/hooks/business/auth';
import FileUpload from '@/components/custom/file-upload.vue';

defineOptions({
  name: 'ShopSettings',
});

const { hasAuth } = useAuth();
const { formRef, validate, restoreValidation } = useNaiveForm();
const { createRequiredRule } = useFormRules();
const { loading, startLoading, endLoading } = useLoading();

const canEdit = hasAuth('system:tenant:edit');
const submitting = ref(false);

const model = reactive<ShopSettingsPayload>({
  companyName: '',
  logoUrl: '',
  themeColor: '#1976d2',
  contactUserName: '',
  contactPhone: '',
  userAgreement: '',
  privacyAgreement: '',
});

const logoFileList = ref<UploadFileInfo[]>([]);
let syncingLogoFromModel = false;

const rules = {
  companyName: createRequiredRule('店铺名称不能为空'),
  contactPhone: [
    {
      validator: (_rule, value: string) => {
        if (!value) return true;
        return REG_PHONE.test(value) ? true : new Error('联系电话格式不正确');
      },
      trigger: ['blur', 'change'],
    },
  ],
  themeColor: [
    {
      pattern: /^$|^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/,
      message: '主题色格式不正确（示例 #1976d2）',
      trigger: ['blur', 'change'],
    },
  ],
};

watch(
  () => model.logoUrl,
  (url) => {
    const normalized = url ?? '';
    const finishedUrl = logoFileList.value[0]?.status === 'finished' ? logoFileList.value[0].url : undefined;
    if (normalized === (finishedUrl ?? '')) return;
    if (logoFileList.value.some((f) => f.status === 'uploading' || f.status === 'pending')) return;
    syncingLogoFromModel = true;
    logoFileList.value =
      normalized !== '' ? [{ id: 'shop-logo', name: 'logo', status: 'finished', url: normalized }] : [];
    nextTick(() => {
      syncingLogoFromModel = false;
    });
  },
);

watch(logoFileList, () => {
  if (syncingLogoFromModel) return;
  const first = logoFileList.value.find((f) => f.status === 'finished' && f.url);
  const next = typeof first?.url === 'string' && first.url !== '' ? first.url : '';
  if (model.logoUrl !== next) model.logoUrl = next;
});

async function loadSettings() {
  startLoading();
  try {
    const { data } = await fetchGetShopSettings();
    if (!data) return;
    Object.assign(model, {
      companyName: data.companyName ?? '',
      logoUrl: data.logoUrl ?? '',
      themeColor: data.themeColor || '#1976d2',
      contactUserName: data.contactUserName ?? '',
      contactPhone: data.contactPhone ?? '',
      userAgreement: data.userAgreement ?? '',
      privacyAgreement: data.privacyAgreement ?? '',
    });
  } catch {
    // error handled by request interceptor
  } finally {
    endLoading();
  }
}

async function handleSubmit() {
  await validate();
  if (!canEdit) return;
  submitting.value = true;
  try {
    await fetchUpdateShopSettings({ ...model });
    window.$message?.success('店铺设置已保存');
  } catch {
    // error handled by request interceptor
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadSettings().catch(() => undefined);
});

watch(
  () => canEdit,
  () => {
    restoreValidation();
  },
);
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="店铺设置" :bordered="false" size="small" class="card-wrapper">
      <template #header-extra>
        <NButton v-if="canEdit" type="primary" :loading="submitting" @click="handleSubmit">保存</NButton>
      </template>

      <NSpin :show="loading">
        <NForm
          ref="formRef"
          :model="model"
          :rules="rules"
          label-placement="left"
          :label-width="110"
          :disabled="!canEdit"
        >
          <NGrid :cols="24" :x-gap="16">
            <NFormItemGi :span="12" label="店铺名称" path="companyName">
              <NInput v-model:value="model.companyName" placeholder="对外展示的店铺名称" maxlength="100" show-count />
            </NFormItemGi>
            <NFormItemGi :span="12" label="主题色" path="themeColor">
              <div class="w-full flex-y-center gap-12px">
                <NColorPicker v-model:value="model.themeColor" :modes="['hex']" :show-alpha="false" class="w-160px" />
                <NInput v-model:value="model.themeColor" placeholder="#1976d2" maxlength="32" />
              </div>
            </NFormItemGi>
            <NFormItemGi :span="24" label="店铺 Logo" path="logoUrl">
              <div class="w-full flex-col gap-8px">
                <FileUpload v-model:file-list="logoFileList" :max="1" accept="image/*" list-type="image-card" />
                <NInput v-model:value="model.logoUrl" placeholder="或直接填写 Logo 图片 URL" maxlength="500" />
              </div>
            </NFormItemGi>
            <NFormItemGi :span="12" label="客服联系人" path="contactUserName">
              <NInput v-model:value="model.contactUserName" placeholder="如：在线客服" maxlength="50" />
            </NFormItemGi>
            <NFormItemGi :span="12" label="客服电话" path="contactPhone">
              <NInput v-model:value="model.contactPhone" placeholder="客服联系电话" maxlength="20" />
            </NFormItemGi>
            <NFormItemGi :span="24" label="用户协议" path="userAgreement">
              <NInput
                v-model:value="model.userAgreement"
                type="textarea"
                placeholder="用户服务协议正文（C 端注册/下单页展示）"
                :autosize="{ minRows: 6, maxRows: 16 }"
              />
            </NFormItemGi>
            <NFormItemGi :span="24" label="隐私政策" path="privacyAgreement">
              <NInput
                v-model:value="model.privacyAgreement"
                type="textarea"
                placeholder="隐私政策正文"
                :autosize="{ minRows: 6, maxRows: 16 }"
              />
            </NFormItemGi>
          </NGrid>
        </NForm>
        <NAlert type="info" class="mt-16px" :bordered="false">
          访问域名由 fafafa 平台在开通时配置，此处不提供修改。首次部署时的管理员账号仍由平台环境变量注入。
        </NAlert>
      </NSpin>
    </NCard>
  </div>
</template>

<style scoped>
:deep(.n-card-header__main) {
  min-width: 36px !important;
}
</style>
