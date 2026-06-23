<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import MemberSelectModal from '@/components/business/member-select-modal.vue';
import type { MemberPickerSelection } from '@/components/business/entity-picker.shared';
import { useDict } from '@/hooks/business/dict';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'UpgradeSearch',
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Member.UpgradeApplySearchParams>('model', { required: true });
const memberPickerVisible = ref(false);
const memberDisplayValue = ref('');

const selectedMember = computed(() =>
  memberDisplayValue.value && model.value.memberId
    ? { memberId: model.value.memberId, displayName: memberDisplayValue.value }
    : null,
);

const activityVersionIdKeyword = computed<string>({
  get: () => readExtraParam('activityVersionId'),
  set: value => writeExtraParam('activityVersionId', value),
});

const referralCodeKeyword = computed<string>({
  get: () => readExtraParam('referralCode'),
  set: value => writeExtraParam('referralCode', value),
});

async function reset() {
  model.value.params = undefined;
  clearMemberSelection();
  await restoreValidation();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}

const { options: statusOptions } = useDict('member_upgrade_apply_status', true);
const { options: applyTypeOptions } = useDict('member_upgrade_apply_type', true);

function ensureParamsRecord(): Record<string, unknown> {
  if (!model.value.params || typeof model.value.params !== 'object' || Array.isArray(model.value.params)) {
    model.value.params = {};
  }
  return model.value.params as Record<string, unknown>;
}

function readExtraParam(key: string): string {
  const value = ensureParamsRecord()[key];
  if (typeof value !== 'string') return '';
  return value;
}

function writeExtraParam(key: string, value: string) {
  const normalized = value.trim();
  const params = ensureParamsRecord();
  if (normalized.length === 0) {
    delete params[key];
    return;
  }
  params[key] = normalized;
}

function openMemberPicker() {
  memberPickerVisible.value = true;
}

function handleMemberSelect(member: MemberPickerSelection) {
  model.value.memberId = member.memberId;
  memberDisplayValue.value = member.displayName || member.nickname || member.mobile || member.memberId;
}

function clearMemberSelection() {
  model.value.memberId = undefined;
  memberDisplayValue.value = '';
}

watch(
  () => model.value.memberId,
  value => {
    if (!value) {
      memberDisplayValue.value = '';
      return;
    }
    if (!memberDisplayValue.value) {
      memberDisplayValue.value = String(value);
    }
  },
  { immediate: true },
);
</script>

<template>
  <NCard :bordered="false" class="card-wrapper" size="small">
    <NCollapse>
      <NCollapseItem :title="$t('common.search')" name="search">
        <NForm ref="formRef" :model="model" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="会员ID" path="memberId" class="pr-24px">
              <NInput
                v-model:value="memberDisplayValue"
                placeholder="点击选择会员"
                clearable
                readonly
                @click="openMemberPicker"
                @clear="clearMemberSelection"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="状态" path="status" class="pr-24px">
              <NSelect v-model:value="model.status" :options="statusOptions" clearable placeholder="请选择状态" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="申请类型" path="applyType" class="pr-24px">
              <NSelect v-model:value="model.applyType" :options="applyTypeOptions" clearable placeholder="请选择类型" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="活动版本" class="pr-24px">
              <NInput v-model:value="activityVersionIdKeyword" clearable placeholder="请输入活动版本ID" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="推荐码" class="pr-24px">
              <NInput v-model:value="referralCodeKeyword" clearable placeholder="请输入推荐码" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6">
              <NSpace class="w-full justify-end" :wrap="false">
                <NButton @click="reset">
                  <template #icon>
                    <icon-ic-round-refresh />
                  </template>
                  {{ $t('common.reset') }}
                </NButton>
                <NButton type="primary" ghost @click="search">
                  <template #icon>
                    <icon-ic-round-search />
                  </template>
                  {{ $t('common.search') }}
                </NButton>
              </NSpace>
            </NFormItemGi>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>

  <MemberSelectModal v-model:visible="memberPickerVisible" :selected="selectedMember" @select="handleMemberSelect" />
</template>

<style scoped></style>
