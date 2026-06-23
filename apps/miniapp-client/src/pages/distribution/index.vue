<script lang="ts" setup>
import type { DistributionCapability, PendingReward, QualificationApplication, QualificationEvidence } from '@libs/common-types';
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import {
  getDistributionCapability,
  getMyPendingRewards,
  getMyQualificationApplication,
  getMyQualificationEvidence,
  submitQualificationApplication,
} from '@/api/distribution';
import { useAuthStore } from '@/store/auth';
import { getShareSid } from '@/utils/dist-share-context';

definePage({
  style: {
    navigationBarTitleText: '分销中心',
  },
});

const authStore = useAuthStore();

const currentSid = ref('');
const loading = ref(false);
const submitting = ref(false);
const capability = ref<DistributionCapability | null>(null);
const application = ref<QualificationApplication | null>(null);
const evidenceList = ref<QualificationEvidence[]>([]);
const pendingRewards = ref<PendingReward[]>([]);
const selectedEvidenceIds = ref<string[]>([]);

const activeEvidence = computed(() => evidenceList.value.filter(item => item.evidenceStatus === 'ELIGIBLE'));
const targetLevelId = computed(() => ((capability.value?.levelId ?? 0) >= 1 ? 2 : 1));
const canSubmitApplication = computed(() => {
  if (capability.value?.canEarnCommission) return false;
  if (application.value?.status === 'PENDING_REVIEW' || application.value?.status === 'APPROVED') return false;
  return selectedEvidenceIds.value.length > 0;
});
const pendingRewardAmount = computed(() => capability.value?.pendingRewardAmount ?? 0);

function refreshShareInfo() {
  currentSid.value = getShareSid() || '';
}

async function loadCenter() {
  loading.value = true;
  try {
    refreshShareInfo();
    const [capabilityRes, applicationRes, evidenceRes, pendingRewardRes] = await Promise.all([
      getDistributionCapability(),
      getMyQualificationApplication(),
      getMyQualificationEvidence({ pageNum: 1, pageSize: 20 }),
      getMyPendingRewards({ pageNum: 1, pageSize: 20 }),
    ]);

    capability.value = capabilityRes;
    application.value = applicationRes;
    evidenceList.value = evidenceRes.rows ?? [];
    pendingRewards.value = pendingRewardRes.rows ?? [];
    selectedEvidenceIds.value = activeEvidence.value.map(item => item.id);
  } finally {
    loading.value = false;
  }
}

onShow(() => {
  loadCenter();
});

function goGoodsPage() {
  uni.navigateTo({ url: '/pages/distribution/goods' });
}

function goReferralCode() {
  uni.navigateTo({ url: '/pages/upgrade/referral-code' });
}

function toggleEvidence(id: string) {
  if (selectedEvidenceIds.value.includes(id)) {
    selectedEvidenceIds.value = selectedEvidenceIds.value.filter(item => item !== id);
    return;
  }
  selectedEvidenceIds.value = [...selectedEvidenceIds.value, id];
}

async function submitApplication() {
  if (!canSubmitApplication.value) return;
  submitting.value = true;
  try {
    application.value = await submitQualificationApplication({
      targetLevelId: targetLevelId.value,
      evidenceIds: selectedEvidenceIds.value,
      applyReason: '服务履约完成申请分销资格',
    });
    uni.showToast({ title: '已提交申请', icon: 'success' });
    await loadCenter();
  } finally {
    submitting.value = false;
  }
}

function levelText(level?: number) {
  if (level === 2) return 'C2 股东';
  if (level === 1) return 'C1 团长';
  return '普通用户';
}

function applicationStatusText(status?: string) {
  const map: Record<string, string> = {
    PENDING_REVIEW: '待审核',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELLED: '已取消',
  };
  return status ? map[status] || status : '未申请';
}

function evidenceStatusText(status?: string) {
  const map: Record<string, string> = {
    PENDING_DELIVERY: '待交付',
    ELIGIBLE: '可申请',
    USED: '已使用',
    INVALID: '已失效',
    REFUNDED: '已退款',
    LEGACY_IMPORT: '历史导入',
  };
  return status ? map[status] || status : '-';
}

function pendingStatusText(status?: string) {
  const map: Record<string, string> = {
    FROZEN: '冻结中',
    ELIGIBLE: '可释放',
    RELEASED: '已释放',
    VOIDED: '已作废',
  };
  return status ? map[status] || status : '-';
}

function moneyText(value?: number) {
  return Number(value ?? 0).toFixed(2);
}
</script>

<template>
  <view class="dist-center-page">
    <view class="dist-center-page__hero">
      <view>
        <text class="dist-center-page__title">分销中心</text>
        <text class="dist-center-page__subtitle">{{ levelText(capability?.levelId) }}</text>
      </view>
      <view class="dist-center-page__status">
        <text>{{ capability?.profileStatus || 'NONE' }}</text>
      </view>
    </view>

    <view class="dist-center-page__metrics">
      <view class="dist-center-page__metric">
        <text class="dist-center-page__metric-value">{{ moneyText(pendingRewardAmount) }}</text>
        <text class="dist-center-page__metric-label">待激活收益</text>
      </view>
      <view class="dist-center-page__metric">
        <text class="dist-center-page__metric-value">{{ activeEvidence.length }}</text>
        <text class="dist-center-page__metric-label">可用材料</text>
      </view>
      <view class="dist-center-page__metric">
        <text class="dist-center-page__metric-value">{{ capability?.canWithdraw ? '可' : '否' }}</text>
        <text class="dist-center-page__metric-label">提现</text>
      </view>
    </view>

    <view class="dist-center-page__card">
      <view class="dist-center-page__card-head">
        <text class="dist-center-page__card-title">资格申请</text>
        <text class="dist-center-page__pill">{{ applicationStatusText(application?.status) }}</text>
      </view>
      <view class="dist-center-page__row">
        <text>申请等级</text>
        <text class="dist-center-page__value">{{ levelText(targetLevelId) }}</text>
      </view>
      <view v-if="application?.reviewRemark" class="dist-center-page__row">
        <text>审核备注</text>
        <text class="dist-center-page__value">{{ application.reviewRemark }}</text>
      </view>
      <wd-button
        type="primary"
        block
        :loading="submitting"
        :disabled="loading || !canSubmitApplication"
        custom-class="dist-center-page__button"
        @click="submitApplication"
      >
        提交申请
      </wd-button>
    </view>

    <view class="dist-center-page__card">
      <view class="dist-center-page__card-head">
        <text class="dist-center-page__card-title">资格材料</text>
        <text class="dist-center-page__pill">{{ evidenceList.length }}</text>
      </view>
      <view v-if="evidenceList.length === 0" class="dist-center-page__empty">暂无材料</view>
      <view
        v-for="item in evidenceList"
        :key="item.id"
        class="dist-center-page__evidence"
        :class="{ 'dist-center-page__evidence--active': selectedEvidenceIds.includes(item.id) }"
        @click="item.evidenceStatus === 'ELIGIBLE' && toggleEvidence(item.id)"
      >
        <view>
          <text class="dist-center-page__evidence-title">订单 {{ item.orderId }}</text>
          <text class="dist-center-page__evidence-desc">{{ item.verifiedAt || item.createTime }}</text>
        </view>
        <text class="dist-center-page__pill">{{ evidenceStatusText(item.evidenceStatus) }}</text>
      </view>
    </view>

    <view class="dist-center-page__card">
      <view class="dist-center-page__card-head">
        <text class="dist-center-page__card-title">分享归因</text>
      </view>
      <view class="dist-center-page__row">
        <text>当前凭证</text>
        <text class="dist-center-page__value">{{ currentSid || '暂无' }}</text>
      </view>
      <view class="dist-center-page__row">
        <text>当前推荐人</text>
        <text class="dist-center-page__value">{{ authStore.getShareUserId() || '暂无' }}</text>
      </view>
      <view class="dist-center-page__actions">
        <wd-button type="primary" block :disabled="!capability?.canEarnCommission" @click="goGoodsPage">商品分销分享</wd-button>
        <wd-button plain block @click="goReferralCode">查看推荐码</wd-button>
      </view>
    </view>

    <view class="dist-center-page__card">
      <view class="dist-center-page__card-head">
        <text class="dist-center-page__card-title">待激活收益</text>
        <text class="dist-center-page__pill">{{ pendingRewards.length }}</text>
      </view>
      <view v-if="pendingRewards.length === 0" class="dist-center-page__empty">暂无收益</view>
      <view v-for="item in pendingRewards" :key="item.id" class="dist-center-page__reward">
        <view>
          <text class="dist-center-page__evidence-title">¥ {{ moneyText(item.amount) }}</text>
          <text class="dist-center-page__evidence-desc">{{ item.orderId }}</text>
        </view>
        <text class="dist-center-page__pill">{{ pendingStatusText(item.status) }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.dist-center-page {
  min-height: 100vh;
  background: #f5f7fb;
  padding: 26rpx;
}

.dist-center-page__hero {
  border-radius: 24rpx;
  padding: 36rpx 30rpx;
  background: linear-gradient(135deg, #155e75 0%, #2563eb 100%);
  color: #fff;
  display: flex;
  justify-content: space-between;
  gap: 22rpx;
  align-items: flex-start;
}

.dist-center-page__title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
}

.dist-center-page__subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  opacity: 0.9;
}

.dist-center-page__status,
.dist-center-page__pill {
  flex-shrink: 0;
  border-radius: 999rpx;
  padding: 8rpx 18rpx;
  font-size: 22rpx;
  background: rgba(255, 255, 255, 0.18);
}

.dist-center-page__metrics {
  margin-top: 20rpx;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.dist-center-page__metric,
.dist-center-page__card {
  background: #fff;
  border-radius: 22rpx;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.06);
}

.dist-center-page__metric {
  padding: 24rpx 12rpx;
  text-align: center;
}

.dist-center-page__metric-value {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.dist-center-page__metric-label {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #64748b;
}

.dist-center-page__card {
  margin-top: 20rpx;
  padding: 26rpx;
}

.dist-center-page__card-head,
.dist-center-page__row,
.dist-center-page__evidence,
.dist-center-page__reward {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  align-items: center;
}

.dist-center-page__card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.dist-center-page__card .dist-center-page__pill {
  color: #2563eb;
  background: #eff6ff;
}

.dist-center-page__row {
  margin-top: 18rpx;
  font-size: 26rpx;
  color: #475569;
}

.dist-center-page__value {
  color: #0f172a;
  max-width: 68%;
  text-align: right;
  word-break: break-all;
}

.dist-center-page__button,
.dist-center-page__actions {
  margin-top: 24rpx;
}

.dist-center-page__actions {
  display: grid;
  gap: 18rpx;
}

.dist-center-page__empty {
  margin-top: 20rpx;
  color: #94a3b8;
  font-size: 24rpx;
}

.dist-center-page__evidence,
.dist-center-page__reward {
  margin-top: 18rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 18rpx;
  padding: 20rpx;
}

.dist-center-page__evidence--active {
  border-color: #2563eb;
  background: #eff6ff;
}

.dist-center-page__evidence-title {
  display: block;
  max-width: 460rpx;
  color: #0f172a;
  font-size: 26rpx;
  word-break: break-all;
}

.dist-center-page__evidence-desc {
  display: block;
  margin-top: 6rpx;
  color: #64748b;
  font-size: 22rpx;
}
</style>
