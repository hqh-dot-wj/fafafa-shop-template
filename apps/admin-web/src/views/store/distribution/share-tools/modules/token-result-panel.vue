<script setup lang="ts">
import { NButton, NCard, NDescriptions, NDescriptionsItem, NImage, NTag } from 'naive-ui';
import { $t } from '@/locales';

defineProps<{
  token: Api.Store.ShareToken | null;
  qrcodeUrl: string;
  creatingQrcode: boolean;
}>();

const emit = defineEmits<{
  (e: 'generate-qrcode'): void;
}>();
</script>

<template>
  <NCard :title="$t('page.store_distribution.shareTools.tokenResultTitle')" :bordered="false" size="small">
    <template v-if="token">
      <NDescriptions :column="2" bordered size="small" label-placement="left">
        <NDescriptionsItem :label="$t('page.store_distribution.shareTools.sid')">{{ token.sid }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.shareTools.bizType')">{{ token.bizType }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.shareTools.bizId')">{{ token.bizId }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.shareTools.expireAt')">{{ token.expireAt }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.shareTools.shareUserId')">{{ token.shareUserId }}</NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.shareTools.status')">
          <NTag type="info">{{ token.status }}</NTag>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.shareTools.maxClickCount')">
          {{ token.maxClickCount }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.shareTools.maxBindCount')">
          {{ token.maxBindCount }}
        </NDescriptionsItem>
      </NDescriptions>

      <div class="mt-12px break-all text-13px text-gray-500">
        {{ token.shareUrl }}
      </div>

      <div class="mt-12px flex items-start gap-16px">
        <NButton type="primary" :loading="creatingQrcode" @click="emit('generate-qrcode')">
          {{ $t('page.store_distribution.shareTools.generateQrcode') }}
        </NButton>
        <NImage v-if="qrcodeUrl" :src="qrcodeUrl" width="144" />
      </div>
    </template>
    <template v-else>
      <div class="text-13px text-gray-500">
        {{ $t('page.store_distribution.shareTools.tokenEmptyTip') }}
      </div>
    </template>
  </NCard>
</template>
