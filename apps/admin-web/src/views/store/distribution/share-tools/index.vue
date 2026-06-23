<script setup lang="ts">
import { onMounted } from 'vue';
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItemGi,
  NGrid,
  NInput,
  NInputNumber,
  NPagination,
  NSelect,
  NSpace,
} from 'naive-ui';
import MemberSelectModal from '@/components/business/member-select-modal.vue';
import ProductSelectModal from '@/components/business/product-select-modal.vue';
import { $t } from '@/locales';
import { useShareTokenTools } from './hooks/use-share-token-tools';
import TokenResultPanel from './modules/token-result-panel.vue';

defineOptions({
  name: 'StoreDistributionShareTools',
});

const {
  formModel,
  creating,
  creatingQrcode,
  currentToken,
  qrcodeUrl,
  hasToken,
  bizTypeOptions,
  bizIdPlaceholder,
  canPickBiz,
  shareUserPickerVisible,
  productPickerVisible,
  shareUserDisplayValue,
  bizDisplayValue,
  selectedShareUser,
  selectedProduct,
  createToken,
  createQrcode,
  openShareUserPicker,
  handleShareUserSelect,
  clearShareUser,
  openBizPicker,
  handleProductSelect,
  clearBiz,
  resetTokenForm,
  logs,
  columns,
  logLoading,
  logQuery,
  logTotal,
  eventTypeOptions,
  loadLogs,
  searchLogs,
  resetLogFilters,
  handlePageChange,
  handlePageSizeChange,
} = useShareTokenTools();

onMounted(() => {
  loadLogs();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-y-auto lt-sm:overflow-auto">
    <NCard :title="$t('route.store_distribution_share-tools')" :bordered="false" size="small" class="card-wrapper">
      <NForm :model="formModel" label-placement="left" :label-width="130">
        <NGrid :cols="24" :x-gap="16">
          <NFormItemGi span="24 s:12" :label="$t('page.store_distribution.shareTools.shareUserId')">
            <NInput
              v-model:value="shareUserDisplayValue"
              :placeholder="$t('page.store_distribution.shareTools.shareUserIdPlaceholder')"
              readonly
              clearable
              @click="openShareUserPicker"
              @clear="clearShareUser"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12" :label="$t('page.store_distribution.shareTools.bizType')">
            <NSelect v-model:value="formModel.bizType" :options="bizTypeOptions" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12" :label="$t('page.store_distribution.shareTools.bizId')">
            <NInput
              v-if="canPickBiz"
              v-model:value="bizDisplayValue"
              :placeholder="bizIdPlaceholder"
              readonly
              clearable
              @click="openBizPicker"
              @clear="clearBiz"
            />
            <NInput v-else v-model:value="formModel.bizId" :placeholder="bizIdPlaceholder" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:6" :label="$t('page.store_distribution.shareTools.linkExpireMinutes')">
            <NInputNumber v-model:value="formModel.linkExpireMinutes" :min="1" class="w-full" />
          </NFormItemGi>
          <NFormItemGi span="24 s:6" :label="$t('page.store_distribution.shareTools.maxClickCount')">
            <NInputNumber v-model:value="formModel.maxClickCount" :min="1" class="w-full" />
          </NFormItemGi>
          <NFormItemGi span="24 s:6" :label="$t('page.store_distribution.shareTools.maxBindCount')">
            <NInputNumber v-model:value="formModel.maxBindCount" :min="0" class="w-full" />
          </NFormItemGi>
          <NFormItemGi span="24 s:6" :label="$t('page.store_distribution.shareTools.maxOrderCount')">
            <NInputNumber v-model:value="formModel.maxOrderCount" :min="0" class="w-full" />
          </NFormItemGi>
        </NGrid>
      </NForm>

      <div class="mt-8px flex flex-wrap justify-end gap-12px">
        <NButton @click="resetTokenForm">{{ $t('common.reset') }}</NButton>
        <NButton type="primary" :loading="creating" @click="createToken">
          {{ $t('page.store_distribution.shareTools.generateToken') }}
        </NButton>
      </div>
    </NCard>

    <TokenResultPanel
      :token="currentToken"
      :qrcode-url="qrcodeUrl"
      :creating-qrcode="creatingQrcode"
      @generate-qrcode="createQrcode"
    />

    <NCard :title="$t('page.store_distribution.shareTools.logTitle')" :bordered="false" size="small" class="card-wrapper">
      <NForm :model="logQuery" inline label-placement="left">
        <NSpace>
          <NInput v-model:value="logQuery.sid" :placeholder="$t('page.store_distribution.shareTools.sidPlaceholder')" clearable />
          <NSelect
            v-model:value="logQuery.eventType"
            :options="eventTypeOptions"
            :placeholder="$t('page.store_distribution.shareTools.eventTypePlaceholder')"
            clearable
            class="w-200px"
          />
          <NButton type="primary" @click="searchLogs">{{ $t('common.search') }}</NButton>
          <NButton @click="resetLogFilters">{{ $t('common.reset') }}</NButton>
        </NSpace>
      </NForm>

      <NDataTable
        class="mt-12px"
        remote
        :loading="logLoading"
        :columns="columns"
        :data="logs"
        :pagination="false"
        :row-key="row => row.id"
      />

      <div class="mt-12px flex justify-end">
        <NPagination
          :page="logQuery.pageNum || 1"
          :page-size="logQuery.pageSize || 10"
          :item-count="logTotal"
          show-size-picker
          :page-sizes="[10, 20, 50]"
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </div>

      <div v-if="!hasToken" class="mt-8px text-12px text-gray-500">
        {{ $t('page.store_distribution.shareTools.logHint') }}
      </div>
    </NCard>
  </div>

  <MemberSelectModal
    v-model:visible="shareUserPickerVisible"
    :selected="selectedShareUser"
    @select="handleShareUserSelect"
  />

  <ProductSelectModal
    v-model:visible="productPickerVisible"
    :selected="selectedProduct"
    @select="handleProductSelect"
  />
</template>
