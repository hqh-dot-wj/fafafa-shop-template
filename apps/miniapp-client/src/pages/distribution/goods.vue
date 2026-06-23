<script lang="ts" setup>
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { computed, reactive } from 'vue';
import DistPolicyBadge from '@/components/distribution/dist-policy-badge.vue';
import DistRoleGuard from '@/components/distribution/dist-role-guard.vue';
import DistShareSheet from '@/components/distribution/dist-share-sheet.vue';
import { useDistShare } from '@/composables/use-dist-share';
import { useUserStore } from '@/store/user';

definePage({
  style: {
    navigationBarTitleText: '商品分销',
  },
});

const userStore = useUserStore();
const {
  preparing,
  sheetVisible,
  sharePreview,
  prepareProductShare,
  openSheet,
  copyShareLink,
  goPosterPage,
  goQrcodePage,
  hintTimelineShare,
  trackEvent,
} = useDistShare();

const form = reactive({
  productId: '',
  productName: '',
  productImage: '',
});

const policyBadgeProps = computed(() => {
  const preview = sharePreview.value;
  const props: {
    expireAt?: string;
    remainClicks?: number;
    remainBinds?: number;
  } = {};
  if (preview?.expireAt !== undefined) props.expireAt = preview.expireAt;
  if (preview?.remainClicks !== undefined) props.remainClicks = preview.remainClicks;
  if (preview?.remainBinds !== undefined) props.remainBinds = preview.remainBinds;
  return props;
});

function buildShareAppContent(preview: NonNullable<typeof sharePreview.value>) {
  const content: { title: string; path: string; imageUrl?: string } = {
    title: preview.title,
    path: preview.path,
  };
  if (preview.imageUrl !== undefined) content.imageUrl = preview.imageUrl;
  return content;
}

function buildShareTimelineContent(preview: NonNullable<typeof sharePreview.value>) {
  const content: { title: string; query: string; imageUrl?: string } = {
    title: preview.title,
    query: preview.query,
  };
  if (preview.imageUrl !== undefined) content.imageUrl = preview.imageUrl;
  return content;
}

onLoad((options) => {
  if (typeof options?.id === 'string') form.productId = options.id;
  if (typeof options?.name === 'string') form.productName = options.name;
  if (typeof options?.image === 'string') form.productImage = options.image;
});

onShareAppMessage(() => {
  const preview = sharePreview.value;
  if (!preview) {
    return { title: '分销商品推荐', path: '/pages/distribution/index' };
  }
  void trackEvent('CLICK', { action: 'share_friend' });
  return buildShareAppContent(preview);
});

onShareTimeline(() => {
  const preview = sharePreview.value;
  if (!preview) {
    return { title: '分销商品推荐', query: '' };
  }
  void trackEvent('CLICK', { action: 'share_timeline' });
  return buildShareTimelineContent(preview);
});

async function generateShareToken() {
  if (!form.productId) {
    uni.showToast({ title: '请先输入商品ID', icon: 'none' });
    return;
  }
  await prepareProductShare({
    productId: form.productId,
    productName: form.productName || `商品${form.productId}`,
    productImage: form.productImage,
  });
  uni.showToast({ title: '分享凭证已生成', icon: 'success' });
}

async function openShareSheet() {
  await generateShareToken();
  openSheet();
}

function previewTarget() {
  if (!form.productId) {
    uni.showToast({ title: '请先输入商品ID', icon: 'none' });
    return;
  }
  uni.navigateTo({ url: `/pages/product/detail?id=${encodeURIComponent(form.productId)}` });
}

async function handleShareFriend() {
  await trackEvent('CLICK', { target: 'friend' });
}

async function handleShareTimeline() {
  await hintTimelineShare();
}
</script>

<template>
  <view class="dist-goods-page">
    <DistRoleGuard :allow="userStore.isDistributor">
      <view class="dist-goods-page__card">
        <view class="dist-goods-page__title">生成商品分销凭证</view>
        <wd-input v-model="form.productId" label="商品ID" placeholder="请输入商品ID（必填）" />
        <wd-input v-model="form.productName" label="商品名称" placeholder="用于分享文案（选填）" />
        <wd-input v-model="form.productImage" label="主图URL" placeholder="用于分享封面（选填）" />
      </view>

      <view class="dist-goods-page__actions">
        <wd-button type="primary" :loading="preparing" block @click="generateShareToken">生成分享凭证</wd-button>
        <wd-button plain :disabled="!form.productId" block @click="openShareSheet">打开分享面板</wd-button>
        <wd-button plain :disabled="!form.productId" block @click="previewTarget">预览商品页</wd-button>
      </view>

      <view v-if="sharePreview" class="dist-goods-page__card">
        <view class="dist-goods-page__title">当前分享信息</view>
        <view class="dist-goods-page__row">
          <text>sid</text>
          <text class="dist-goods-page__value">{{ sharePreview.sid }}</text>
        </view>
        <view class="dist-goods-page__row">
          <text>落地路径</text>
          <text class="dist-goods-page__value">{{ sharePreview.path }}</text>
        </view>
        <DistPolicyBadge v-bind="policyBadgeProps" />
      </view>

      <DistShareSheet
        v-model="sheetVisible"
        :loading="preparing"
        @share-friend="handleShareFriend"
        @share-timeline="handleShareTimeline"
        @copy-link="copyShareLink"
        @generate-poster="goPosterPage"
        @generate-qrcode="goQrcodePage"
      />
    </DistRoleGuard>
  </view>
</template>

<style lang="scss" scoped>
.dist-goods-page {
  min-height: 100vh;
  background: #f5f7fb;
  padding: 24rpx;
}

.dist-goods-page__card {
  background: #fff;
  border-radius: 22rpx;
  padding: 24rpx;
  display: grid;
  gap: 16rpx;
}

.dist-goods-page__title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.dist-goods-page__actions {
  margin-top: 18rpx;
  display: grid;
  gap: 16rpx;
}

.dist-goods-page__row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18rpx;
  color: #475569;
  font-size: 24rpx;
}

.dist-goods-page__value {
  max-width: 70%;
  text-align: right;
  color: #0f172a;
  word-break: break-all;
}
</style>
