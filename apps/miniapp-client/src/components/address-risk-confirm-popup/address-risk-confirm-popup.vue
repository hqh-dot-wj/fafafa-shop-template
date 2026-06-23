<template>
  <wd-popup
    :model-value="visible"
    position="center"
    :close-on-click-modal="false"
    custom-class="rounded-xl overflow-hidden"
    :z-index="998"
    :root-portal="true"
    @update:model-value="onVisibleChange"
  >
    <view v-if="visible" class="address-risk-popup bg-surface p-space-lg" @touchmove.stop.prevent>
      <view class="mb-space-md text-center text-title-md text-ink font-bold">门店不一致</view>
      <view class="mb-space-lg text-body-md text-ink-light leading-relaxed">
        当前定位门店与结算门店不一致，请先切换服务门店或重新选择服务区域后再提交订单。
      </view>
      <view class="flex flex-col gap-space-sm">
        <button
          class="rounded-pill bg-primary py-space-sm text-body-md text-white font-medium"
          hover-class="opacity-90"
          @click="recheck"
        >
          我已切换好
        </button>
        <button
          class="rounded-pill bg-fill py-space-sm text-body-md text-ink font-medium"
          hover-class="opacity-80"
          @click="goSelect"
        >
          去选择服务区域
        </button>
        <button class="text-body-sm text-ink-tertiary py-space-xs text-center" hover-class="opacity-70" @click="cancel">
          取消
        </button>
      </view>
    </view>
  </wd-popup>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import WdPopup from 'wot-design-uni/components/wd-popup/wd-popup.vue';
import { useLocationStore } from '@/store/location';
import { completeRuntimePopup, useRuntimePopupOrchestrator } from '@/store/popup-orchestrator';

const locationStore = useLocationStore();
const popup = useRuntimePopupOrchestrator();
const visible = computed(() => locationStore.addressRiskModalVisible && popup.activeKind.value === 'address');

function onVisibleChange(v: boolean) {
  if (!v) {
    locationStore.cancelAddressRiskConfirm();
    completeRuntimePopup('address');
  }
}

function recheck() {
  locationStore.submitAddressRiskRecheck();
}

function goSelect() {
  locationStore.cancelAddressRiskConfirm();
  uni.navigateTo({ url: '/pages/address/select' });
}

function cancel() {
  locationStore.cancelAddressRiskConfirm();
  completeRuntimePopup('address');
}
</script>

<style lang="scss" scoped>
.address-risk-popup {
  box-sizing: border-box;
  width: 78vw;
  max-width: 360px;
}
</style>
