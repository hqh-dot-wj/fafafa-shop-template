<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from 'naive-ui';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NSelect, NSpace } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';
import { storeConfigStatusOptions } from './store-config-labels';

defineOptions({ name: 'StoreConfigSearch' });

interface Props {
  templateOptions?: SelectOption[];
}

interface Emits {
  (e: 'search'): void;
  (e: 'reset'): void;
}

const props = withDefaults(defineProps<Props>(), {
  templateOptions: () => [],
});

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Marketing.StoreConfigSearchParams>('model', { required: true });

type RuleKey = Extract<keyof Api.Marketing.StoreConfigSearchParams, 'templateCode' | 'status'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  templateCode: [],
  status: [],
}));

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
  <!-- 动态配置搜索区：按玩法模板和上下架状态筛选商品/服务配置。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['store-config-search']">
      <NCollapseItem :title="$t('common.search')" name="store-config-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="104">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="玩法模板" path="templateCode" class="pr-24px">
              <NSelect
                v-model:value="model.templateCode"
                :options="props.templateOptions"
                clearable
                placeholder="请选择玩法模板"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="状态" path="status" class="pr-24px">
              <NSelect
                v-model:value="model.status"
                :options="storeConfigStatusOptions"
                clearable
                placeholder="请选择状态"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6">
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
