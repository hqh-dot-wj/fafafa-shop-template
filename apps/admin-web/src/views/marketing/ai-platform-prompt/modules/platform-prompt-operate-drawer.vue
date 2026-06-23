<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NDrawer, NDrawerContent, NForm, NFormItem, NInput, NInputNumber, NSpace } from 'naive-ui';
import type { FormRules } from 'naive-ui';
import {
  type AiPlatformPromptCreateBody,
  type AiPlatformPromptRow,
  type AiPlatformPromptUpdateBody,
  fetchAiPromptCreate,
  fetchAiPromptUpdate,
} from '@/service/api/marketing/ai-prompt';
import { useNaiveForm } from '@/hooks/common/form';
import { buildObjectFromEditableText, formatObjectEditorText, toPlainRecord } from '../../shared/object-summary';

defineOptions({ name: 'PlatformPromptOperateDrawer' });

// Prompt 抽屉编辑系统提示词和输出 schema，schema 会被后端用于约束 AI 生成结果。
// platformCode 是运行路由锚点，编辑时禁止修改。
const props = defineProps<{
  operateType: NaiveUI.TableOperateType;
  /** 编辑时的行数据；新增时为 null */
  rowData?: AiPlatformPromptRow | null;
}>();

const emit = defineEmits<{
  (e: 'submitted'): void;
}>();

const visible = defineModel<boolean>('visible', { default: false });

const { formRef, validate, restoreValidation } = useNaiveForm();

const title = computed(() => (props.operateType === 'add' ? '新增平台 Prompt' : '编辑平台 Prompt'));

const model = reactive({
  platformCode: '',
  platformName: '',
  icon: '',
  systemPrompt: '',
  outputSchemaText: '',
  maxLength: null as number | null,
  sortOrder: 0,
});
const outputSchemaBase = ref<Record<string, unknown>>({});

const rules: FormRules = {
  platformCode: [{ required: true, message: '请输入平台标识', trigger: 'blur' }],
  platformName: [{ required: true, message: '请输入平台名称', trigger: 'blur' }],
  systemPrompt: [{ required: true, message: '请输入 System Prompt', trigger: 'blur' }],
  outputSchemaText: [
    {
      required: true,
      trigger: 'blur',
      validator: (_rule, value: string) => {
        const outputSchema = normalizeOutputSchema(buildObjectFromEditableText(outputSchemaBase.value, value || ''));
        if (Object.keys(outputSchema).length === 0) {
          return new Error('请至少配置一个输出字段');
        }
        return true;
      },
    },
  ],
};

function resetModel() {
  model.platformCode = '';
  model.platformName = '';
  model.icon = '';
  model.systemPrompt = '';
  model.outputSchemaText = '';
  outputSchemaBase.value = {};
  model.maxLength = null;
  model.sortOrder = 0;
}

function isPositiveInt(n: number | null): n is number {
  return typeof n === 'number' && !Number.isNaN(n) && n > 0;
}

watch(
  () => [visible.value, props.rowData, props.operateType] as const,
  ([v, row, op]) => {
    if (!v) return;
    restoreValidation();
    if (op === 'edit' && row) {
      model.platformCode = row.platformCode;
      model.platformName = row.platformName;
      model.icon = row.icon ?? '';
      model.systemPrompt = row.systemPrompt;
      outputSchemaBase.value = toPlainRecord(row.outputSchema);
      model.outputSchemaText = formatObjectEditorText(outputSchemaBase.value);
      model.maxLength = row.maxLength;
      model.sortOrder = row.sortOrder;
    } else {
      resetModel();
    }
  },
);

function normalizeOutputSchema(record: Record<string, unknown>): Record<string, string> {
  // 方法职责：提交前只保留非空 schema key/value，避免空字段影响后端 schema 解析。
  return Object.entries(record).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalizedKey = key.trim();
    const normalizedValue = String(value ?? '').trim();
    if (normalizedKey && normalizedValue) {
      acc[normalizedKey] = normalizedValue;
    }
    return acc;
  }, {});
}

async function handleSubmit() {
  await validate();
  const outputSchema = normalizeOutputSchema(
    buildObjectFromEditableText(outputSchemaBase.value, model.outputSchemaText),
  );
  if (props.operateType === 'add') {
    // 新增时提交 platformCode，编辑时不提交，保持平台标识和历史调用记录稳定。
    const body: AiPlatformPromptCreateBody = {
      platformCode: model.platformCode.trim(),
      platformName: model.platformName.trim(),
      systemPrompt: model.systemPrompt,
      outputSchema,
      sortOrder: model.sortOrder,
    };
    if (model.icon.trim()) body.icon = model.icon.trim();
    if (isPositiveInt(model.maxLength)) body.maxLength = model.maxLength;
    await fetchAiPromptCreate(body);
  } else if (props.rowData) {
    const body: AiPlatformPromptUpdateBody = {
      platformName: model.platformName.trim(),
      systemPrompt: model.systemPrompt,
      outputSchema,
      sortOrder: model.sortOrder,
    };
    if (model.icon.trim()) body.icon = model.icon.trim();
    else body.icon = '';
    if (isPositiveInt(model.maxLength)) body.maxLength = model.maxLength;
    else body.maxLength = undefined;
    await fetchAiPromptUpdate(props.rowData.id, body);
  }
  visible.value = false;
  emit('submitted');
}
</script>

<template>
  <!-- Prompt 编辑抽屉：维护平台标识、提示词和输出 schema，编辑态禁止改 platformCode。 -->
  <NDrawer v-model:show="visible" display-directive="show" :width="560">
    <NDrawerContent :title="title" closable>
      <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" label-width="120">
        <!-- 基础配置区：定义平台展示信息和排序。 -->
        <NFormItem label="平台标识" path="platformCode">
          <NInput v-model:value="model.platformCode" placeholder="如 WECHAT_MP" :disabled="operateType === 'edit'" />
        </NFormItem>
        <NFormItem label="平台名称" path="platformName">
          <NInput v-model:value="model.platformName" placeholder="展示名称" />
        </NFormItem>
        <NFormItem label="图标 URL" path="icon">
          <NInput v-model:value="model.icon" placeholder="可选" />
        </NFormItem>
        <NFormItem label="排序" path="sortOrder">
          <NInputNumber v-model:value="model.sortOrder" class="w-full" :min="0" />
        </NFormItem>
        <NFormItem label="字数建议" path="maxLength">
          <NInputNumber v-model:value="model.maxLength" class="w-full" :min="1" placeholder="可选" clearable />
        </NFormItem>
        <!-- Prompt 与 schema 区：提交系统提示词和后端用于解析结果的字段约束。 -->
        <NFormItem label="System Prompt" path="systemPrompt">
          <NInput v-model:value="model.systemPrompt" type="textarea" :rows="8" placeholder="系统提示词模板" />
        </NFormItem>
        <NFormItem label="输出字段" path="outputSchemaText">
          <NInput
            v-model:value="model.outputSchemaText"
            type="textarea"
            :rows="6"
            placeholder="如 title = string，每行一个字段"
            class="text-12px"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <!-- 操作区：保存前走表单校验和 schema 清洗。 -->
        <NSpace justify="end">
          <NButton @click="visible = false">取消</NButton>
          <NButton type="primary" @click="handleSubmit">保存</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
