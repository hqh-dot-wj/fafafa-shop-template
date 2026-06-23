<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'LevelSearch',
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Store.LevelSearchParams>('model', { required: true });

const statusOptions = computed<SelectOption[]>(() => [
  { label: $t('page.store_distribution.search.enabled'), value: 1 },
  { label: $t('page.store_distribution.search.disabled'), value: 0 },
]);

const statusSelectValue = computed(() => {
  if (model.value.isActive === true) return 1;
  if (model.value.isActive === false) return 0;
  return null;
});

function onStatusChange(v: 1 | 0 | null): void {
  if (v === 1) model.value.isActive = true;
  else if (v === 0) model.value.isActive = false;
  else model.value.isActive = undefined;
}

async function reset() {
  await restoreValidation();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse>
      <NCollapseItem :title="$t('common.search')" name="level-search">
        <NForm ref="formRef" :model="model" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.store_distribution.search.status')" path="isActive" class="pr-24px">
              <NSelect
                :value="statusSelectValue"
                :placeholder="$t('page.store_distribution.search.statusPlaceholder')"
                :options="statusOptions"
                clearable
                @update:value="onStatusChange"
              />
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
</template>

<style scoped></style>
