<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import TenantSelectModal from '@/components/business/tenant-select-modal.vue';
import type { TenantPickerSelection } from '@/components/business/entity-picker.shared';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'TenantSearch',
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.System.TenantSearchParams>('model', { required: true });
const tenantPickerVisible = ref(false);
const tenantDisplayValue = ref('');

const selectedTenant = computed(() =>
  tenantDisplayValue.value && model.value.tenantId
    ? { tenantId: String(model.value.tenantId), displayName: tenantDisplayValue.value }
    : null,
);

async function reset() {
  await restoreValidation();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}

function openTenantPicker() {
  tenantPickerVisible.value = true;
}

function handleTenantSelect(selection: TenantPickerSelection) {
  model.value.tenantId = selection.tenantId;
  tenantDisplayValue.value = selection.displayName || selection.companyName || selection.tenantId;
}

function clearTenantSelection() {
  model.value.tenantId = null;
  tenantDisplayValue.value = '';
}

watch(
  () => model.value.tenantId,
  value => {
    if (!value) {
      tenantDisplayValue.value = '';
      return;
    }
    if (!tenantDisplayValue.value) {
      tenantDisplayValue.value = String(value);
    }
  },
  { immediate: true },
);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse>
      <NCollapseItem :title="$t('common.search')" name="user-search">
        <NForm ref="formRef" :model="model" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="租户编号" path="tenantId" class="pr-24px">
              <NInput
                v-model:value="tenantDisplayValue"
                placeholder="点击选择租户"
                clearable
                readonly
                @click="openTenantPicker"
                @clear="clearTenantSelection"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="联系人" path="contactUserName" class="pr-24px">
              <NInput v-model:value="model.contactUserName" placeholder="请输入联系人" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="联系电话" path="contactPhone" class="pr-24px">
              <NInput v-model:value="model.contactPhone" placeholder="请输入联系电话" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="企业名称" path="companyName" class="pr-24px">
              <NInput v-model:value="model.companyName" placeholder="请输入企业名称" />
            </NFormItemGi>
            <NFormItemGi span="24" class="pr-24px">
              <NSpace class="w-full" justify="end">
                <NButton @click="reset">
                  <template #icon>
                    <icon-ic-round-refresh class="text-icon" />
                  </template>
                  {{ $t('common.reset') }}
                </NButton>
                <NButton type="primary" ghost @click="search">
                  <template #icon>
                    <icon-ic-round-search class="text-icon" />
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

  <TenantSelectModal v-model:visible="tenantPickerVisible" :selected="selectedTenant" @select="handleTenantSelect" />
</template>

<style scoped></style>
