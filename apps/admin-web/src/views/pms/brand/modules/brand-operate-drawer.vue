<script setup lang="tsx">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import type { UploadFileInfo } from 'naive-ui';
import { fetchAddBrand, fetchUpdateBrand } from '@/service/api/pms/brand';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import FileUpload from '@/components/custom/file-upload.vue';
import { $t } from '@/locales';

defineOptions({
  name: 'BrandOperateDrawer',
});

interface Props {
  /** the type of operation */
  operateType: NaiveUI.TableOperateType;
  /** the edit row data */
  rowData?: Api.Pms.Brand | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false,
});

const { formRef, validate, restoreValidation } = useNaiveForm();
const { defaultRequiredRule } = useFormRules();

const title = computed(() => {
  const titles: Record<NaiveUI.TableOperateType, string> = {
    add: $t('page.pms.brand.addBrand'),
    edit: $t('page.pms.brand.editBrand'),
  };
  return titles[props.operateType];
});

type Model = Api.Pms.BrandOperateParams;

const model: Model = reactive(createDefaultModel());

function createDefaultModel(): Model {
  return {
    name: '',
    logo: '',
  };
}

type RuleKey = Extract<keyof Model, 'name'>;

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  name: [defaultRequiredRule],
};

const logoFileList = ref<UploadFileInfo[]>([]);
let syncingLogoFromModel = false;

/** 提交中：避免连点触发全局防重复提交（500ms 内同 URL+body） */
const submitting = ref(false);

watch(
  () => model.logo,
  (url) => {
    const first = logoFileList.value[0];
    const finishedUrl = first?.status === 'finished' ? first.url : undefined;
    const normalized = url ?? '';
    if (normalized === (finishedUrl ?? '')) {
      return;
    }
    const uploading = logoFileList.value.some((f) => f.status === 'uploading' || f.status === 'pending');
    if (uploading) {
      return;
    }
    syncingLogoFromModel = true;
    logoFileList.value =
      normalized !== '' ? [{ id: 'legacy-url-0', name: 'logo', status: 'finished', url: normalized }] : [];
    nextTick(() => {
      syncingLogoFromModel = false;
    });
  },
);

watch(
  logoFileList,
  () => {
    if (syncingLogoFromModel) {
      return;
    }
    const first = logoFileList.value.find((f) => f.status === 'finished' && f.url);
    const u = first?.url;
    const next = typeof u === 'string' && u !== '' ? u : '';
    if (model.logo !== next) {
      model.logo = next;
    }
  },
  { deep: true },
);

async function handleSubmit() {
  if (submitting.value) {
    return;
  }
  submitting.value = true;
  try {
    await validate();
    if (props.operateType === 'add') {
      await fetchAddBrand(model);
    } else {
      await fetchUpdateBrand(model);
    }
    window.$message?.success($t('common.updateSuccess'));
    close();
    emit('submitted');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('请勿重复提交')) {
      window.$message?.warning(msg);
      return;
    }
    throw error;
  } finally {
    submitting.value = false;
  }
}

function close() {
  visible.value = false;
}

watch(visible, () => {
  if (visible.value) {
    handleInit();
    restoreValidation();
  }
});

function handleInit() {
  Object.assign(model, createDefaultModel());
  if (props.operateType === 'edit' && props.rowData) {
    Object.assign(model, props.rowData);
  }
}
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="400">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NForm ref="formRef" :model="model" :rules="rules">
        <NFormItem :label="$t('page.pms.brand.brandName')" path="name">
          <NInput v-model:value="model.name" :placeholder="$t('page.pms.brand.form.brandName.required')" />
        </NFormItem>
        <NFormItem :label="$t('page.pms.brand.brandLogo')" path="logo">
          <div class="w-full flex-col gap-12px">
            <FileUpload v-model:file-list="logoFileList" :max="1" upload-type="image" :file-size="5" />
            <NInput
              v-model:value="model.logo"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              :placeholder="$t('page.pms.brand.form.logo.urlOptional')"
            />
          </div>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="close">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="submitting" :disabled="submitting" @click="handleSubmit">
            {{ $t('common.confirm') }}
          </NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
