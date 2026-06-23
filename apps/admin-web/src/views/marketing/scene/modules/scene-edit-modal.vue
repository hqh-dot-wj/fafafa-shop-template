<script setup lang="ts">
import type { SelectOption } from 'naive-ui';
import { NAlert, NButton, NForm, NFormItem, NInput, NModal, NSelect, NSpace, NSwitch } from 'naive-ui';
import MiniappRouteTargetEditor from '@/components/business/miniapp-route-target-editor.vue';

defineOptions({ name: 'SceneEditModal' });

type SceneForm = Api.Marketing.SaveSceneParams & { id?: string };

const props = defineProps<{
  show: boolean;
  editingCode: string | null;
  submitting: boolean;
  routeValid: boolean;
  form: SceneForm;
  templateOptions: SelectOption[];
  templateLoading: boolean;
  useTemplateCreate: boolean;
  selectedTemplateCode: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:form', value: SceneForm): void;
  (e: 'update:routeValid', value: boolean): void;
  (e: 'update:useTemplateCreate', value: boolean): void;
  (e: 'update:selectedTemplateCode', value: string | null): void;
  (e: 'save'): void;
}>();

function updateFormField<K extends keyof SceneForm>(key: K, value: SceneForm[K]) {
  emit('update:form', {
    ...props.form,
    [key]: value,
  });
}

function updateChannelScope(value: string) {
  // 方法职责：将逗号分隔的渠道输入转成后端需要的 channelScope 数组。
  updateFormField(
    'channelScope',
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}
</script>

<template>
  <!-- 场景编辑弹窗：新建时可从模板生成草稿，编辑时维护场景字段和路由。 -->
  <NModal
    :show="show"
    preset="card"
    :title="editingCode ? '编辑场景' : '新增场景'"
    class="w-720px"
    @update:show="(value) => emit('update:show', value)"
  >
    <NForm :model="props.form" label-placement="left" :label-width="120">
      <!-- 模板创建区：仅新增场景时展示，模板字段不会覆盖已有场景。 -->
      <NFormItem v-if="!editingCode" label="模板创建">
        <NSwitch :value="props.useTemplateCreate" @update:value="(value) => emit('update:useTemplateCreate', value)" />
      </NFormItem>
      <NFormItem v-if="!editingCode && props.useTemplateCreate" label="场景模板">
        <NSelect
          :value="props.selectedTemplateCode"
          :options="props.templateOptions"
          :loading="props.templateLoading"
          placeholder="请选择场景模板"
          filterable
          clearable
          @update:value="(value) => emit('update:selectedTemplateCode', value as string | null)"
        />
      </NFormItem>
      <!-- 基础信息区：维护场景编码、名称、类型和渠道范围。 -->
      <NFormItem label="场景编码">
        <NInput
          :value="props.form.sceneCode"
          :disabled="!!editingCode"
          placeholder="如：HOME_FEATURED"
          @update:value="(value) => updateFormField('sceneCode', value)"
        />
      </NFormItem>
      <NFormItem label="场景名称">
        <NInput
          :value="props.form.sceneName"
          placeholder="请输入场景名称"
          @update:value="(value) => updateFormField('sceneName', value)"
        />
      </NFormItem>
      <NFormItem v-if="editingCode || !props.useTemplateCreate" label="场景类型">
        <NInput
          :value="props.form.sceneType"
          placeholder="如：HOMEPAGE"
          @update:value="(value) => updateFormField('sceneType', value)"
        />
      </NFormItem>
      <NFormItem v-if="editingCode || !props.useTemplateCreate" label="渠道范围">
        <NInput
          :value="(props.form.channelScope || []).join(',')"
          placeholder="如：miniapp"
          @update:value="updateChannelScope"
        />
      </NFormItem>
      <template v-if="editingCode || !props.useTemplateCreate">
        <!-- 路由配置区：通过白名单编辑器维护小程序目标页面。 -->
        <MiniappRouteTargetEditor
          :model-value="props.form.pageRoute ?? undefined"
          default-target-key="product_list"
          @update:model-value="(value) => updateFormField('pageRoute', value)"
          @update:valid="(value) => emit('update:routeValid', value)"
        />
        <NAlert v-if="!props.routeValid" class="mb-12px" type="warning" :show-icon="false">
          页面路由参数不完整，请先修正
        </NAlert>
      </template>
      <!-- 默认策略区：绑定卡片模板和裁决策略编码。 -->
      <NFormItem v-if="editingCode || !props.useTemplateCreate" label="默认卡片模板">
        <NInput
          :value="props.form.defaultCardTemplateCode"
          placeholder="可选"
          @update:value="(value) => updateFormField('defaultCardTemplateCode', value)"
        />
      </NFormItem>
      <NFormItem v-if="editingCode || !props.useTemplateCreate" label="默认裁决策略">
        <NInput
          :value="props.form.defaultResolverPolicyCode"
          placeholder="可选"
          @update:value="(value) => updateFormField('defaultResolverPolicyCode', value)"
        />
      </NFormItem>
      <NFormItem label="状态">
        <NSelect
          :value="props.form.status"
          :options="[
            { label: '启用', value: 'ACTIVE' },
            { label: '停用', value: 'INACTIVE' },
            { label: '草稿', value: 'DRAFT' },
          ]"
          @update:value="(value) => updateFormField('status', value)"
        />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="emit('save')">保存</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
