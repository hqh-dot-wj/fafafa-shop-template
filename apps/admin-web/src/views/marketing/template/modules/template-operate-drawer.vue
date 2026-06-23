<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import {
  NButton,
  NCard,
  NDrawer,
  NDrawerContent,
  NDynamicInput,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
} from 'naive-ui';
import { fetchCreateTemplate, fetchUpdateTemplate } from '@/service/api/marketing/template';
import { useNaiveForm } from '@/hooks/common/form';
import { templateFieldTypeOptions } from './template-operate-labels';

defineOptions({ name: 'TemplateOperateDrawer' });

// 玩法模板抽屉只维护模板元数据和规则字段 schema，不能写具体商品价格、库存或会员资格。
interface Props {
  operateType: NaiveUI.TableOperateType;
  rowData?: Api.Marketing.PlayTemplate | null;
}

interface Emits {
  (e: 'submitted'): void;
}

interface TemplateFormModel {
  name: string;
  unitName: string;
  ruleSchema: {
    fields: Api.Marketing.SchemaField[];
  };
  uiComponentId?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const { formRef, validate, restoreValidation } = useNaiveForm();

const title = computed(() => {
  const titleMap: Record<NaiveUI.TableOperateType, string> = {
    add: '新增玩法模板',
    edit: '编辑玩法模板',
  };

  return titleMap[props.operateType];
});

const displayCode = computed(() => {
  if (props.operateType === 'edit') {
    return props.rowData?.code ?? '';
  }

  return '保存后系统自动生成';
});

const model = reactive<TemplateFormModel>({
  name: '',
  unitName: '',
  ruleSchema: {
    fields: [],
  },
  uiComponentId: '',
});

const schemaFields = reactive<Api.Marketing.SchemaField[]>([]);

function updateSchemaFields(next: unknown[]) {
  // schemaFields 使用 reactive 数组承载 NDynamicInput，更新时整体替换以避免残留旧字段。
  schemaFields.splice(0, schemaFields.length, ...(next as Api.Marketing.SchemaField[]));
}

watch(visible, (value) => {
  if (value) {
    handleInit();
  }
});

function handleInit() {
  restoreValidation();

  if (props.operateType === 'edit' && props.rowData) {
    Object.assign(model, {
      name: props.rowData.name,
      unitName: props.rowData.unitName,
      ruleSchema: props.rowData.ruleSchema ?? { fields: [] },
      uiComponentId: props.rowData.uiComponentId ?? '',
    });

    const fields = props.rowData.ruleSchema?.fields ?? [];
    schemaFields.splice(0, schemaFields.length, ...fields);
    return;
  }

  Object.assign(model, {
    name: '',
    unitName: '人',
    ruleSchema: { fields: [] },
    uiComponentId: '',
  });
  schemaFields.splice(0, schemaFields.length);
}

async function handleSubmit() {
  await validate();

  // 提交前把动态字段收回 ruleSchema，后续营销配置页会按这份 schema 生成规则填写项。
  model.ruleSchema = {
    fields: schemaFields,
  };

  if (props.operateType === 'add') {
    await fetchCreateTemplate(model);
  } else {
    if (!props.rowData?.id) return;
    await fetchUpdateTemplate(props.rowData.id, model);
  }

  window.$message?.success(props.operateType === 'add' ? '新增成功' : '修改成功');
  visible.value = false;
  emit('submitted');
}
</script>

<template>
  <!-- 玩法模板编辑抽屉：维护模板基础信息和规则字段 schema。 -->
  <NDrawer v-model:show="visible" display-directive="show" :width="620">
    <NDrawerContent :title="title" :native-scrollbar="false">
      <NForm ref="formRef" :model="model">
        <!-- 基础信息区：展示系统生成编码并编辑名称、单位和详情组件。 -->
        <NCard title="基础信息" class="mb-4" size="small">
          <NFormItem label="玩法编码">
            <NInput :value="displayCode" disabled />
          </NFormItem>
          <NFormItem label="玩法名称" path="name" rule-path="required">
            <NInput v-model:value="model.name" placeholder="如：拼课、秒杀、优惠价" />
          </NFormItem>
          <NFormItem label="计量单位" path="unitName" rule-path="required">
            <NInput v-model:value="model.unitName" placeholder="如：人、件、小时" />
          </NFormItem>
          <NFormItem label="详情交互模板" path="uiComponentId">
            <NInput v-model:value="model.uiComponentId" placeholder="如：group-buy-detail / flash-sale-detail" />
          </NFormItem>
        </NCard>

        <!-- 规则定义区：维护营销配置页后续需要填写的 schema 字段。 -->
        <NCard title="规则定义" class="mb-4" size="small">
          <div class="mb-2 text-xs text-gray-500">定义后续在营销配置页需要填写的规则字段。</div>

          <NDynamicInput
            :value="schemaFields"
            :on-create="() => ({ key: '', label: '', type: 'number', required: true })"
            @update:value="updateSchemaFields"
          >
            <template #default="{ value }">
              <div class="w-full flex items-center gap-2">
                <NInput v-model:value="value.key" placeholder="字段 Key，如 targetCount" class="flex-1" />
                <NInput v-model:value="value.label" placeholder="字段名称，如 成团人数" class="flex-1" />
                <NSelect v-model:value="value.type" :options="templateFieldTypeOptions" class="w-140px" />
              </div>
            </template>
          </NDynamicInput>
        </NCard>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="visible = false">取消</NButton>
          <NButton type="primary" @click="handleSubmit">确认</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
