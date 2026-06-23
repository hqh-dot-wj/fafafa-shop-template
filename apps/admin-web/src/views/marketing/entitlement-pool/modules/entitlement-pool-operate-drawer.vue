<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NDrawer, NDrawerContent, NForm, NFormItem, NInput, NSelect, NSpace, NTag } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import type { EntitlementPoolType, EntitlementProductSourceType, EntitlementTouchpoint } from '@/service/api/marketing';
import MemberSelectModal from '@/components/business/member-select-modal.vue';
import type { MemberPickerSelection } from '@/components/business/entity-picker.shared';
import { $t } from '@/locales';
import CouponPoolForm from './coupon-pool-form.vue';
import PointsPoolForm from './points-pool-form.vue';
import { type EntitlementPoolDraft, createDefaultDraft } from './entitlement-pool.types';

defineOptions({ name: 'EntitlementPoolOperateDrawer' });

// 权益池抽屉只维护单个池的草稿字段，真正的协议校验和运行产物生成在父页面 compile 调用中完成。
const props = withDefaults(
  defineProps<{
    visible: boolean;
    mode: 'create' | 'edit';
    model?: EntitlementPoolDraft | null;
    submitting: boolean;
    disallowedScopes: string[];
  }>(),
  {
    model: null,
  },
);

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'submit', value: EntitlementPoolDraft): void;
  (e: 'pickProduct'): void;
  (e: 'pickCouponTemplate'): void;
  (e: 'pickPointsTask'): void;
}>();

type PoolTouchpoint = Extract<EntitlementTouchpoint, 'product' | 'coupon' | 'points'>;

const show = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const drawerTitle = computed(() => (props.mode === 'create' ? '新增权益池' : '编辑权益池'));

const poolTypeOptions: SelectOption[] = [
  { label: '商品池', value: 'PRODUCT' },
  { label: '券池', value: 'COUPON' },
  { label: '积分池', value: 'POINTS' },
];

const sourceTypeOptions: SelectOption[] = [
  { label: '场景商品池', value: 'SCENE' },
  { label: '类目商品池', value: 'CATEGORY' },
  { label: '推荐商品池', value: 'RECOMMEND' },
];

const touchpointOptions: SelectOption[] = [
  { label: '人群触点', value: 'audience' },
  { label: '商品触点', value: 'product' },
  { label: '券触点', value: 'coupon' },
  { label: '积分触点', value: 'points' },
];

const formModel = reactive<EntitlementPoolDraft>(createDefaultDraft());
const memberPickerVisible = ref(false);
const memberDisplayValue = ref('');

watch(
  show,
  (value) => {
    if (!value) return;
    const base = createDefaultDraft();
    Object.assign(formModel, base, props.model ?? {});
    ensurePoolTouchpoint(formModel.poolType);
    memberDisplayValue.value = formModel.memberId || '';
  },
  { immediate: true },
);

watch(
  () => props.model,
  (value) => {
    if (!show.value || !value) return;
    Object.assign(formModel, createDefaultDraft(), value);
    ensurePoolTouchpoint(formModel.poolType);
    memberDisplayValue.value = formModel.memberId || '';
  },
  { deep: true },
);

watch(
  () => formModel.poolType,
  (type) => {
    // 切换池类型时清理其他类型的来源字段，避免商品来源、券模板、积分任务互相污染。
    ensurePoolTouchpoint(type);
    if (type !== 'PRODUCT') {
      formModel.sourceType = null;
      formModel.sourceKey = '';
      formModel.memberId = '';
      memberDisplayValue.value = '';
    }
    if (type !== 'COUPON') {
      formModel.templateId = '';
      formModel.templateName = '';
    }
    if (type !== 'POINTS') {
      formModel.taskId = '';
      formModel.taskName = '';
    }
  },
);

function ensurePoolTouchpoint(poolType: EntitlementPoolType) {
  const current = [...formModel.touchpoints];
  const required = getPoolTouchpoint(poolType);
  // 方法职责：同步池类型对应触点，并过滤当前协议禁用的 notification/share。
  const filtered = current.filter((item) => item !== 'notification' && item !== 'share');
  if (!filtered.includes(required)) {
    filtered.push(required);
  }
  formModel.touchpoints = [...new Set(filtered)] as EntitlementTouchpoint[];
}

function getPoolTouchpoint(poolType: EntitlementPoolType): PoolTouchpoint {
  if (poolType === 'COUPON') return 'coupon';
  if (poolType === 'POINTS') return 'points';
  return 'product';
}

function validateForm() {
  const name = formModel.name.trim();
  if (!name) {
    window.$message?.warning('请输入权益池名称');
    return false;
  }
  if (formModel.poolType === 'PRODUCT') {
    if (!formModel.sourceType) {
      window.$message?.warning('请选择商品池来源');
      return false;
    }
    if (formModel.sourceType !== 'RECOMMEND' && !formModel.sourceKey?.trim()) {
      window.$message?.warning('请输入来源标识');
      return false;
    }
  }
  if (formModel.poolType === 'COUPON' && !formModel.templateId?.trim()) {
    window.$message?.warning('请选择券模板');
    return false;
  }
  if (formModel.poolType === 'POINTS' && !formModel.taskId?.trim()) {
    window.$message?.warning('请选择积分任务');
    return false;
  }
  return true;
}

function handleSubmit() {
  if (!validateForm()) return;
  emit('submit', { ...formModel, name: formModel.name.trim() });
}

function updateSourceType(value: string | number | null) {
  formModel.sourceType = (value as EntitlementProductSourceType | null) ?? null;
}

function openMemberPicker() {
  memberPickerVisible.value = true;
}

function handleMemberSelect(member: MemberPickerSelection) {
  formModel.memberId = member.memberId;
  memberDisplayValue.value = member.displayName || member.nickname || member.mobile || member.memberId;
}

function clearMemberSelection() {
  formModel.memberId = '';
  memberDisplayValue.value = '';
}
</script>

<template>
  <!-- 权益池编辑抽屉：维护池类型、触点和各类型来源参数。 -->
  <NDrawer v-model:show="show" :width="640">
    <NDrawerContent :title="drawerTitle" closable>
      <NForm :model="formModel" label-placement="left" :label-width="108">
        <!-- 通用配置区：定义池名称、类型和触点范围。 -->
        <NFormItem label="权益池名称">
          <NInput v-model:value="formModel.name" placeholder="用于运营识别和编排回溯" />
        </NFormItem>
        <NFormItem label="池类型">
          <NSelect v-model:value="formModel.poolType" :options="poolTypeOptions" />
        </NFormItem>
        <NFormItem label="触点范围">
          <NSelect
            v-model:value="formModel.touchpoints"
            multiple
            :options="touchpointOptions"
            placeholder="至少包含当前池类型的主触点"
          />
        </NFormItem>
        <NFormItem label="禁止触点">
          <NSpace>
            <NTag v-for="scope in disallowedScopes" :key="scope" type="warning">{{ scope }}</NTag>
          </NSpace>
        </NFormItem>

        <!-- 商品池配置区：定义商品来源、来源标识和可选会员预览上下文。 -->
        <template v-if="formModel.poolType === 'PRODUCT'">
          <NFormItem label="商品来源">
            <NSelect
              :value="formModel.sourceType"
              clearable
              :options="sourceTypeOptions"
              placeholder="选择来源模型"
              @update:value="updateSourceType"
            />
          </NFormItem>
          <NFormItem label="来源标识">
            <NSpace class="w-full">
              <NInput
                v-model:value="formModel.sourceKey"
                :placeholder="formModel.sourceType === 'CATEGORY' ? '例如类目 ID: 12' : '例如场景码: newcomer'"
                class="flex-1"
              />
              <NButton type="primary" ghost @click="emit('pickProduct')">选择商品填充</NButton>
            </NSpace>
          </NFormItem>
          <NFormItem label="会员ID">
            <NInput
              v-model:value="memberDisplayValue"
              placeholder="可选，点击选择会员用于个性化预览"
              clearable
              readonly
              @click="openMemberPicker"
              @clear="clearMemberSelection"
            />
          </NFormItem>
        </template>

        <!-- 券池配置区：选择后端券模板作为编译输入。 -->
        <template v-else-if="formModel.poolType === 'COUPON'">
          <CouponPoolForm
            :template-id="formModel.templateId"
            :template-name="formModel.templateName"
            @update:template-id="formModel.templateId = $event"
            @update:template-name="formModel.templateName = $event"
            @pick-template="emit('pickCouponTemplate')"
          />
        </template>

        <!-- 积分池配置区：选择积分任务作为编译输入。 -->
        <template v-else>
          <PointsPoolForm
            :task-id="formModel.taskId"
            :task-name="formModel.taskName"
            @update:task-id="formModel.taskId = $event"
            @update:task-name="formModel.taskName = $event"
            @pick-task="emit('pickPointsTask')"
          />
        </template>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="show = false">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSubmit">{{ $t('common.save') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>

  <!-- 会员选择弹窗：仅为商品池个性化预览提供 memberId。 -->
  <MemberSelectModal
    v-model:visible="memberPickerVisible"
    :selected="
      formModel.memberId
        ? {
            memberId: formModel.memberId,
            displayName: memberDisplayValue || formModel.memberId,
          }
        : null
    "
    @select="handleMemberSelect"
  />
</template>
