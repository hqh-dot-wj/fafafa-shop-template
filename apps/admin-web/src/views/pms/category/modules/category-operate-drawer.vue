<script setup lang="tsx">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import type { UploadFileInfo } from 'naive-ui';
import { NForm, NFormItem, NInput, NInputNumber, NSelect, NTreeSelect } from 'naive-ui';
import { fetchAddCategory, fetchGetCategoryList, fetchGetCategoryTree, fetchUpdateCategory } from '@/service/api/pms/category';
import { fetchGetAttributeList } from '@/service/api/pms/attribute';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import FileUpload from '@/components/custom/file-upload.vue';
import { $t } from '@/locales';
import { getNextSortValue } from '@/utils/sort';

defineOptions({
  name: 'CategoryOperateDrawer',
});

interface Props {
  /** the type of operation */
  operateType: NaiveUI.TableOperateType;
  /** the edit row data */
  rowData?: Api.Pms.Category | null;
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
    add: $t('page.pms.category.addCategory'),
    edit: $t('page.pms.category.editCategory'),
  };
  return titles[props.operateType];
});

type Model = Api.Pms.CategoryFormModel;

const model: Model = reactive(createDefaultModel());

function createDefaultModel(): Model {
  return {
    name: '',
    sort: 1,
    level: 1,
    parentId: null,
    icon: undefined,
    bindType: undefined,
    attrTemplateId: undefined,
  };
}

/** 仅提交后端 CreateCategoryDto 允许的字段，避免列表 VO 上的 id/catId/level/status 触发 forbidNonWhitelisted */
function toCategoryWriteBody(m: Model): Api.Pms.CategoryWriteBody {
  const body: Api.Pms.CategoryWriteBody = {
    name: m.name,
    sort: m.sort ?? 0,
  };
  const pid = m.parentId;
  if (pid !== undefined && pid !== null && pid !== 0) {
    body.parentId = pid;
  }
  if ((m.icon ?? '') !== '') {
    body.icon = m.icon;
  }
  if ((m.bindType ?? '') !== '') {
    body.bindType = m.bindType;
  }
  if (m.attrTemplateId !== undefined && m.attrTemplateId !== null) {
    body.attrTemplateId = m.attrTemplateId;
  }
  return body;
}

const attrTemplateOptions = ref<CommonType.Option<number>[]>([]);

async function getAttrTemplates() {
  const { data } = await fetchGetAttributeList({ pageNum: 1, pageSize: 100 });
  if (data) {
    attrTemplateOptions.value = data.rows.map((item) => ({
      label: item.name,
      value: item.templateId,
    }));
  }
}

const treeOptions = ref<Api.Pms.CategoryTree>([]);

async function getTree() {
  const { data } = await fetchGetCategoryTree();
  if (data) {
    treeOptions.value = data;
  }
}

type RuleKey = Extract<keyof Model, 'name'>;

const rules: Record<RuleKey, App.Global.FormRule> = {
  name: defaultRequiredRule,
};

const iconFileList = ref<UploadFileInfo[]>([]);
let syncingIconFromModel = false;

watch(
  () => model.icon,
  (url) => {
    const first = iconFileList.value[0];
    const finishedUrl = first?.status === 'finished' ? first.url : undefined;
    const normalized = url ?? '';
    if (normalized === (finishedUrl ?? '')) {
      return;
    }
    const uploading = iconFileList.value.some((f) => f.status === 'uploading' || f.status === 'pending');
    if (uploading) {
      return;
    }
    syncingIconFromModel = true;
    iconFileList.value =
      normalized !== '' ? [{ id: 'legacy-url-0', name: 'icon', status: 'finished', url: normalized }] : [];
    nextTick(() => {
      syncingIconFromModel = false;
    });
  },
);

watch(
  iconFileList,
  () => {
    if (syncingIconFromModel) {
      return;
    }
    const first = iconFileList.value.find((f) => f.status === 'finished' && f.url);
    const u = first?.url;
    const next = typeof u === 'string' && u !== '' ? u : '';
    if ((model.icon ?? '') !== next) {
      model.icon = next === '' ? undefined : next;
    }
  },
  { deep: true },
);

function handleUpdateStoreSelection(_val: number | null, option: { level?: number } | null) {
  if (option) {
    model.level = (option.level ?? 0) + 1;
  } else {
    model.level = 1;
  }
}

/** 后端 pageSize 上限 100；同级分类较多时需顺序分页合并后再算 sort */
async function suggestSortByParent(parentId?: number | null) {
  const pageSize = 100;
  const baseParams: Api.Pms.CategorySearchParams = { pageNum: 1, pageSize };
  if (parentId !== undefined && parentId !== null && parentId > 0) {
    baseParams.parentId = parentId;
  }
  const allRows: Api.Pms.Category[] = [];
  const maxPages = 100;
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    // eslint-disable-next-line no-await-in-loop -- 顺序分页直至末页
    const { data } = await fetchGetCategoryList({ ...baseParams, pageNum });
    const rows = data?.rows ?? [];
    allRows.push(...rows);
    if (rows.length < pageSize) break;
  }
  model.sort = getNextSortValue(allRows, item => item.sort);
}

async function handleSubmit() {
  await validate();
  if (props.operateType === 'add') {
    await fetchAddCategory(toCategoryWriteBody(model));
  } else {
    const catId = model.catId;
    if (catId === undefined || catId === null) {
      window.$message?.error('分类 ID 缺失，请关闭后重试');
      return;
    }
    await fetchUpdateCategory(catId, toCategoryWriteBody(model));
  }
  window.$message?.success($t('common.updateSuccess'));
  close();
  emit('submitted');
}

function close() {
  visible.value = false;
}

watch(visible, () => {
  if (visible.value) {
    void handleInit();
    restoreValidation();
    getTree();
    getAttrTemplates();
  }
});

async function handleInit() {
  Object.assign(model, createDefaultModel());
  if (props.operateType === 'edit' && props.rowData) {
    const row = props.rowData;
    model.catId = row.catId;
    model.name = row.name;
    model.sort = row.sort ?? 0;
    model.parentId = typeof row.parentId === 'number' ? row.parentId : null;
    model.level = row.level ?? 1;
    model.icon = typeof row.icon === 'string' && row.icon !== '' ? row.icon : undefined;
    model.bindType = row.bindType ?? undefined;
    model.attrTemplateId = row.attrTemplate?.templateId ?? row.attrTemplateId ?? undefined;
  }
  // If adding sub-category
  if (props.operateType === 'add' && props.rowData) {
    model.parentId = props.rowData.catId;
    model.level = props.rowData.level + 1;
  }
  if (props.operateType === 'add') {
    try {
      await suggestSortByParent(model.parentId);
    } catch {
      // 使用本地默认值兜底
    }
  }
}
</script>

<template>
  <NDrawer v-model:show="visible" :title="title" display-directive="show" :width="400">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NForm ref="formRef" :model="model" :rules="rules">
        <NFormItem :label="$t('page.pms.category.parentCategory')" path="parentId">
          <NTreeSelect
            v-model:value="model.parentId"
            :options="treeOptions"
            key-field="catId"
            label-field="name"
            children-field="children"
            :placeholder="$t('page.pms.category.selectParent')"
            clearable
            @update:value="handleUpdateStoreSelection"
          />
        </NFormItem>
        <NFormItem :label="$t('page.pms.category.categoryName')" path="name">
          <NInput v-model:value="model.name" :placeholder="$t('page.pms.category.form.categoryName.required')" />
        </NFormItem>
        <NFormItem :label="$t('page.pms.category.icon')" path="icon">
          <div class="w-full flex-col gap-12px">
            <FileUpload v-model:file-list="iconFileList" :max="1" upload-type="image" :file-size="5" />
            <NInput
              :value="model.icon ?? ''"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              :placeholder="$t('page.pms.category.form.icon.urlOptional')"
              @update:value="(v) => (model.icon = v.trim() === '' ? undefined : v)"
            />
          </div>
        </NFormItem>
        <NFormItem :label="$t('common.sort')" path="sort">
          <NInputNumber v-model:value="model.sort" :placeholder="$t('page.pms.category.form.sort.required')" />
        </NFormItem>
        <NFormItem :label="$t('page.pms.category.bindType')" path="bindType">
          <NSelect
            v-model:value="model.bindType"
            :options="[
              { label: $t('page.pms.category.realProduct'), value: 'REAL' },
              { label: $t('page.pms.category.serviceProduct'), value: 'SERVICE' },
            ]"
            clearable
          />
        </NFormItem>
        <NFormItem :label="$t('page.pms.category.attributeTemplate')" path="attrTemplateId">
          <NSelect
            v-model:value="model.attrTemplateId"
            :options="attrTemplateOptions"
            :placeholder="$t('page.pms.category.selectAttributeTemplate')"
            clearable
            filterable
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="center" class="w-full">
          <NButton @click="close">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
