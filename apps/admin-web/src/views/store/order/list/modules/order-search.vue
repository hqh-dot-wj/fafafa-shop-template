<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NDatePicker,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NSelect,
} from 'naive-ui';
import { useDict } from '@/hooks/business/dict';
import { $t } from '@/locales';

defineOptions({
  name: 'OrderSearch',
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();
const model = defineModel<Api.Order.SearchParams>('model', { required: true });

const { options: statusOptions } = useDict('store_order_status', true);
const { options: orderTypeOptions } = useDict('store_order_type', true);

const dateRange = ref<[number, number] | null>(null);

const dateShortcuts = computed<Record<string, () => [number, number]>>(() => ({
  [$t('page.store_order_list.search.shortcutToday')]: () => {
    const now = Date.now();
    const start = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    return [start, now] as [number, number];
  },
  [$t('page.store_order_list.search.shortcutYesterday')]: () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const start = new Date(d.setHours(0, 0, 0, 0)).getTime();
    const end = new Date(d.setHours(23, 59, 59, 999)).getTime();
    return [start, end] as [number, number];
  },
  [$t('page.store_order_list.search.shortcutThisWeek')]: () => {
    const now = new Date();
    const day = now.getDay() || 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1).getTime();
    return [start, Date.now()] as [number, number];
  },
  [$t('page.store_order_list.search.shortcutThisMonth')]: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return [start, Date.now()] as [number, number];
  },
}));

function handleDateChange(value: [number, number] | null) {
  dateRange.value = value;
  if (value) {
    const [start, end] = value;
    model.value['params.beginTime'] = new Date(start).toISOString().slice(0, 10);
    model.value['params.endTime'] = new Date(end).toISOString().slice(0, 10);
  } else {
    model.value['params.beginTime'] = null;
    model.value['params.endTime'] = null;
  }
}

function handleReset() {
  dateRange.value = null;
  emit('reset');
}

function handleSearch() {
  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse>
      <NCollapseItem :title="$t('common.search')" name="order-search">
        <NForm :model="model" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive :x-gap="16" :y-gap="16">
            <NGridItem span="24 s:12 m:6">
              <NFormItem :label="$t('page.store_order_list.search.orderSn')" path="orderSn">
                <NInput v-model:value="model.orderSn" :placeholder="$t('page.store_order_list.search.orderSnPlaceholder')" clearable />
              </NFormItem>
            </NGridItem>
            <NGridItem span="24 s:12 m:6">
              <NFormItem :label="$t('page.store_order_list.search.mobile')" path="receiverPhone">
                <NInput
                  v-model:value="model.receiverPhone"
                  :placeholder="$t('page.store_order_list.search.mobilePlaceholder')"
                  clearable
                />
              </NFormItem>
            </NGridItem>
            <NGridItem span="24 s:12 m:6">
              <NFormItem :label="$t('page.store_order_list.search.status')" path="status">
                <NSelect
                  v-model:value="model.status"
                  :options="statusOptions"
                  :placeholder="$t('page.store_order_list.search.placeholderSelect')"
                  clearable
                />
              </NFormItem>
            </NGridItem>
            <NGridItem span="24 s:12 m:6">
              <NFormItem :label="$t('page.store_order_list.search.orderType')" path="orderType">
                <NSelect
                  v-model:value="model.orderType"
                  :options="orderTypeOptions"
                  :placeholder="$t('page.store_order_list.search.placeholderSelect')"
                  clearable
                />
              </NFormItem>
            </NGridItem>
            <NGridItem span="24 s:12 m:6">
              <NFormItem :label="$t('page.store_order_list.search.orderedAt')" path="createTime">
                <NDatePicker
                  :value="dateRange"
                  type="daterange"
                  clearable
                  :shortcuts="dateShortcuts"
                  :start-placeholder="$t('page.store_order_list.search.startDate')"
                  :end-placeholder="$t('page.store_order_list.search.endDate')"
                  @update:value="handleDateChange"
                />
              </NFormItem>
            </NGridItem>
            <NGridItem span="24 s:24 m:24">
              <NFormItem>
                <div class="w-full flex justify-end gap-12px">
                  <NButton @click="handleReset">{{ $t('common.reset') }}</NButton>
                  <NButton type="primary" ghost @click="handleSearch">{{ $t('common.search') }}</NButton>
                </div>
              </NFormItem>
            </NGridItem>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>
