<script lang="ts" setup>
import type { CourseGroupDetailQuery, CourseGroupTeamDetail, CourseGroupTeamMember } from '@/api/course-group';
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app';
import { getCourseGroupTeamStatusMeta } from '@libs/common-constants';
import { computed, ref } from 'vue';
import { getCourseGroupJoinPreview, getCourseGroupTeamDetail, inspectCourseGroupTeamMember } from '@/api/course-group';
import { useAuthStore } from '@/store/auth';
import { useLocationStore } from '@/store/location';
import { useUserStore } from '@/store/user';
import TeamMemberProgress from './components/team-member-progress.vue';

// 拼课详情页对应 backend CourseGroupClientController 的 detail/inspect/join-preview。
// 真实成员、虚拟补位、参团资格和分享权限由后端返回，页面只做当前用户视角的展示和兜底文案。
definePage({
  style: {
    navigationBarTitleText: '拼课团详情',
    backgroundColor: '#f5f6fa',
  },
});

const authStore = useAuthStore();
const userStore = useUserStore();
const locationStore = useLocationStore();

const teamId = ref('');
const productId = ref('');
const activityContextKey = ref<string>();
const activityConfigId = ref<string>();
const loading = ref(true);
const joining = ref(false);
const inspectingMemberId = ref('');
const errorMsg = ref('');
const detail = ref<CourseGroupTeamDetail | null>(null);

const currentUserId = computed(() => {
  const raw = userStore.userInfo?.userId;
  if (raw === undefined || raw === null) return '';
  return String(raw);
});

const resolvedViewerRole = computed(() => {
  const current = detail.value;
  if (!current) return 'VISITOR';
  if (current.viewerRole && current.viewerRole !== 'VISITOR') return current.viewerRole;
  if (currentUserId.value && current.leader.userId === currentUserId.value) return 'LEADER';
  if (currentUserId.value && current.members.some((member) => member.userId === currentUserId.value)) return 'MEMBER';
  return 'VISITOR';
});

const canJoin = computed(() => {
  const current = detail.value;
  if (!current) return false;
  return current.canJoin && resolvedViewerRole.value === 'VISITOR';
});

const joinBlockReasonText = computed(() => {
  const current = detail.value;
  if (!current || canJoin.value) return '';
  if (current.joinBlockReasonText) return current.joinBlockReasonText;
  if (current.viewerJoined) return '你已在团内';
  return '当前团队暂不可参团';
});

const canShare = computed(() => {
  const current = detail.value;
  if (!current) return false;
  return current.canShare && (resolvedViewerRole.value === 'LEADER' || resolvedViewerRole.value === 'MEMBER');
});

const isLeaderViewer = computed(() => resolvedViewerRole.value === 'LEADER');

const teamStatusMeta = computed(() => getCourseGroupTeamStatusMeta(detail.value?.teamStatus));

const viewerRoleText = computed(() => {
  const roleMap: Record<string, string> = {
    LEADER: '你是本团团长',
    MEMBER: '你已加入本团',
    VISITOR: '可查看并直接参团',
  };
  return roleMap[resolvedViewerRole.value] || roleMap.VISITOR;
});

const statusPillClass = computed(() => `course-group-detail__status-pill--${teamStatusMeta.value.tagType}`);

const sharePath = computed(() => {
  if (!detail.value) return '/pages/index/index';
  const params = new URLSearchParams({
    teamId: detail.value.teamId,
    productId: detail.value.productId || productId.value,
  });
  if (detail.value.activityContextKey || activityContextKey.value) {
    params.set('activityContextKey', detail.value.activityContextKey || activityContextKey.value || '');
  }
  if (detail.value.activityConfigId || activityConfigId.value) {
    params.set('activityConfigId', detail.value.activityConfigId || activityConfigId.value || '');
  }
  return `/pages/course-group/detail?${params.toString()}`;
});

onShareAppMessage(() => ({
  title: detail.value?.shareTitle || `${detail.value?.leader.name || '团长'}邀请你一起拼课`,
  path: sharePath.value,
}));

onLoad((options) => {
  teamId.value =
    typeof options?.teamId === 'string' ? options.teamId : typeof options?.id === 'string' ? options.id : '';
  productId.value = typeof options?.productId === 'string' ? options.productId : '';
  activityContextKey.value = typeof options?.activityContextKey === 'string' ? options.activityContextKey : undefined;
  activityConfigId.value = typeof options?.activityConfigId === 'string' ? options.activityConfigId : undefined;

  if (!teamId.value) {
    loading.value = false;
    errorMsg.value = '缺少团队参数，无法查看详情';
    return;
  }

  void loadDetail();
});

async function loadDetail() {
  loading.value = true;
  errorMsg.value = '';
  const query: CourseGroupDetailQuery = {};
  if (locationStore.currentTenantId) query.tenantId = locationStore.currentTenantId;
  try {
    detail.value = await getCourseGroupTeamDetail(teamId.value, query, { hideErrorToast: true, timeout: 12_000 });
    if (detail.value?.productName) {
      uni.setNavigationBarTitle({ title: detail.value.productName });
    }
  } catch (error: any) {
    errorMsg.value = error?.msg || error?.message || '拼课团详情加载失败';
  } finally {
    loading.value = false;
  }
}

function formatDateTime(value?: string): string {
  if (!value) return '待定';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(
    2,
    '0',
  )} ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

function memberPayText(member: CourseGroupTeamMember): string {
  if (member.role === 'LEADER') return '团长占位';
  if (member.payStatus === 'PAID' || member.payStatus === 'SUCCESS') return '已支付';
  if (member.payStatus === 'NOT_REQUIRED') return '无需支付';
  if (member.payStatus) return member.payStatus;
  return '待支付';
}

function formatSourceType(value?: string): string {
  if (value === 'AUTO') return '系统自动补位';
  if (value === 'LEADER_MANUAL') return '团长手动补位';
  if (value === 'ADMIN_MANUAL') return '后台人工补位';
  return '真实成员';
}

async function handleInspectMember(member: CourseGroupTeamMember) {
  const current = detail.value;
  if (!current || !isLeaderViewer.value || !current.teamId) return;
  if (inspectingMemberId.value === member.memberId) return;

  inspectingMemberId.value = member.memberId;
  try {
    const query: CourseGroupDetailQuery = {};
    const tenantId = locationStore.currentTenantId || current.tenantId;
    if (tenantId) query.tenantId = tenantId;

    const inspected = await inspectCourseGroupTeamMember(current.teamId, member.memberId, query, {
      hideErrorToast: true,
      timeout: 12_000,
    });

    // 补位身份是高风险展示点：虚拟成员不能暗示真实订单、考勤或分佣参与。
    const content = inspected.isVirtual
      ? `虚拟成员\n来源：${formatSourceType(inspected.sourceType)}\n仅用于成团展示，不计入订单、考勤和分佣。`
      : '真实成员\n该成员参与真实订单、考勤和分佣计算。';

    uni.showModal({
      title: inspected.isVirtual ? '虚拟成员' : '真实成员',
      content,
      showCancel: false,
      confirmText: '知道了',
    });
  } catch (error: any) {
    uni.showToast({ title: error?.msg || error?.message || '成员信息加载失败', icon: 'none' });
  } finally {
    inspectingMemberId.value = '';
  }
}

async function handleJoinAndPay() {
  const current = detail.value;
  if (!current) return;
  if (!authStore.requireAuth(() => void handleJoinAndPay())) return;

  const tenantId = locationStore.currentTenantId || current.tenantId || '';
  if (!tenantId) {
    uni.showToast({ title: '请先选择门店', icon: 'none' });
    return;
  }

  joining.value = true;
  try {
    // 详情页按钮只发起预检，最终下单仍进入订单页，由订单服务再次计算金额和库存。
    const preview = await getCourseGroupJoinPreview(
      current.teamId,
      { tenantId },
      {
        hideErrorToast: true,
        timeout: 12_000,
      },
    );

    if (!preview.joinable) {
      uni.showToast({ title: preview.joinBlockReasonText || preview.message || '当前团队暂不可参团', icon: 'none' });
      return;
    }

    const skuId = current.skuId;
    if (!skuId) {
      uni.navigateTo({
        url: `/pages/product/detail?id=${encodeURIComponent(
          current.productId || productId.value,
        )}&teamId=${encodeURIComponent(current.teamId)}&isLeader=false&activityContextKey=${encodeURIComponent(
          current.activityContextKey || activityContextKey.value || '',
        )}`,
      });
      return;
    }

    const params = new URLSearchParams({
      mode: 'course_group',
      tenantId,
      skuId,
      quantity: '1',
      groupId: current.teamId,
      isLeader: 'false',
      activityType: 'COURSE_GROUP',
    });
    if (current.activityContextKey || activityContextKey.value) {
      params.set('activityContextKey', current.activityContextKey || activityContextKey.value || '');
    }
    if (current.activityConfigId || activityConfigId.value) {
      params.set('activityConfigId', current.activityConfigId || activityConfigId.value || '');
    }

    uni.navigateTo({
      url: `/pages/order/create?${params.toString()}`,
    });
  } finally {
    joining.value = false;
  }
}

function handleShareTip() {
  uni.showToast({
    title: canShare.value ? '点击右上角或下方按钮分享给好友' : '当前身份不可分享此团队',
    icon: 'none',
  });
}

function goTeams() {
  if (!detail.value) return;
  const params = new URLSearchParams({
    productId: detail.value.productId || productId.value,
    productName: detail.value.productName || '',
    skuId: detail.value.skuId || '',
  });
  if (detail.value.activityContextKey || activityContextKey.value) {
    params.set('activityContextKey', detail.value.activityContextKey || activityContextKey.value || '');
  }
  if (detail.value.activityConfigId || activityConfigId.value) {
    params.set('activityConfigId', detail.value.activityConfigId || activityConfigId.value || '');
  }
  uni.navigateTo({ url: `/pages/course-group/teams?${params.toString()}` });
}
</script>

<template>
  <view class="course-group-detail">
    <view v-if="loading" class="course-group-detail__loading">
      <wd-loading />
      <text>详情加载中...</text>
    </view>

    <view v-else-if="errorMsg" class="course-group-detail__error">
      <text>{{ errorMsg }}</text>
      <wd-button type="primary" size="small" @click="loadDetail">重新加载</wd-button>
    </view>

    <template v-else-if="detail">
      <view class="course-group-detail__hero">
        <view class="course-group-detail__hero-content">
          <view class="course-group-detail__hero-badge-row">
            <text class="course-group-detail__eyebrow">课程拼课</text>
            <text class="course-group-detail__status-pill" :class="statusPillClass">
              {{ teamStatusMeta.label }}
            </text>
          </view>
          <text class="course-group-detail__hero-role">{{ viewerRoleText }}</text>
          <view class="course-group-detail__store-pill">
            <view class="i-carbon-location course-group-detail__store-icon" />
            <text class="course-group-detail__store-text">{{ detail.tenantName || '当前门店' }}</text>
          </view>
        </view>
      </view>

      <view class="course-group-detail__body">
        <view class="course-group-detail__card">
          <view class="course-group-detail__leader">
            <view class="course-group-detail__leader-main">
              <image
                class="course-group-detail__leader-avatar"
                :src="detail.leader.avatar || '/static/images/default-avatar.png'"
                mode="aspectFill"
              />
              <view class="course-group-detail__leader-meta">
                <text class="course-group-detail__leader-name">{{ detail.leader.name }}</text>
                <text class="course-group-detail__leader-role">
                  {{ resolvedViewerRole === 'LEADER' ? '我是团长' : '团长发起' }}
                </text>
              </view>
            </view>
            <text class="course-group-detail__team-status" :class="statusPillClass">{{ teamStatusMeta.label }}</text>
          </view>

          <view class="course-group-detail__info-grid">
            <view class="course-group-detail__info-item">
              <text class="course-group-detail__info-label">门店</text>
              <text class="course-group-detail__info-value">{{ detail.tenantName || '当前门店' }}</text>
            </view>
            <view class="course-group-detail__info-item">
              <text class="course-group-detail__info-label">上课地址</text>
              <text class="course-group-detail__info-value">{{ detail.classAddress || '待确认' }}</text>
            </view>
            <view class="course-group-detail__info-item">
              <text class="course-group-detail__info-label">开课时间</text>
              <text class="course-group-detail__info-value">{{ formatDateTime(detail.classStartTime) }}</text>
            </view>
            <view class="course-group-detail__info-item">
              <text class="course-group-detail__info-label">结束时间</text>
              <text class="course-group-detail__info-value">{{ formatDateTime(detail.classEndTime) }}</text>
            </view>
          </view>
        </view>

        <TeamMemberProgress
          :min-count="detail.minCount"
          :max-count="detail.maxCount"
          :effective-members="detail.effectiveMemberCount"
          :real-paid-members="detail.realPaidMemberCount"
          :team-status="detail.teamStatus"
        />

        <view class="course-group-detail__card">
          <view class="course-group-detail__section-header">
            <text class="course-group-detail__section-title">成员列表</text>
            <text class="course-group-detail__section-subtitle">
              {{ detail.effectiveMemberCount }} 位已占位{{ isLeaderViewer ? ' · 点击头像可查看成员身份' : '' }}
            </text>
          </view>
          <view class="course-group-detail__members">
            <view v-for="member in detail.members" :key="member.memberId" class="course-group-detail__member">
              <view class="course-group-detail__member-main">
                <image
                  class="course-group-detail__member-avatar"
                  :src="member.avatar || '/static/images/default-avatar.png'"
                  mode="aspectFill"
                  @click.stop="handleInspectMember(member)"
                />
                <view class="course-group-detail__member-meta">
                  <view class="course-group-detail__member-row">
                    <text class="course-group-detail__member-name">{{ member.name }}</text>
                    <text class="course-group-detail__member-tag">
                      {{ member.role === 'LEADER' ? '团长' : '成员' }}
                    </text>
                  </view>
                  <text class="course-group-detail__member-time">
                    {{ member.joinedAt ? formatDateTime(member.joinedAt) : '刚刚加入' }}
                  </text>
                </view>
              </view>
              <text class="course-group-detail__member-pay">{{ memberPayText(member) }}</text>
            </view>
          </view>
        </view>

        <view class="course-group-detail__card">
          <view class="course-group-detail__section-header">
            <text class="course-group-detail__section-title">收益说明</text>
          </view>
          <view class="course-group-detail__income">
            <text>{{
              detail.revenueDescription || detail.revenueHint || '团长 0 元占位，成团后按活动规则结算收益。'
            }}</text>
            <text>{{
              detail.inviteDescription || '分享给好友后，好友完成参团支付即可占位，达到成团人数后自动开课。'
            }}</text>
          </view>
        </view>

        <view class="course-group-detail__actions">
          <text v-if="joinBlockReasonText" class="course-group-detail__join-block">
            {{ joinBlockReasonText }}
          </text>
          <wd-button plain custom-class="detail-secondary" @click="goTeams">更多团队</wd-button>
          <wd-button
            v-if="canJoin"
            type="primary"
            :loading="joining"
            custom-class="detail-primary"
            @click="handleJoinAndPay"
          >
            立即参团并支付
          </wd-button>
          <wd-button
            v-else-if="canShare"
            type="primary"
            open-type="share"
            custom-class="detail-primary"
            @click="handleShareTip"
          >
            立即分享
          </wd-button>
          <wd-button
            v-else
            plain
            :custom-class="canShare ? 'detail-primary' : 'detail-primary detail-primary--muted'"
            @click="handleShareTip"
          >
            查看分享说明
          </wd-button>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.course-group-detail {
  min-height: 100vh;
  background-color: var(--color-mine-page-tail);

  &__loading,
  &__error {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    color: var(--color-text-secondary);
    padding: var(--space-xl);
    text-align: center;
    background-color: var(--color-mine-page-tail);
  }

  &__hero {
    background-color: var(--color-mine-page-tail);
    background-image: var(--gradient-mine-page);
    padding: var(--space-md) var(--space-lg) var(--space-xs);
    box-sizing: border-box;
  }

  &__hero-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    box-sizing: border-box;
  }

  &__hero-badge-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  &__eyebrow {
    display: inline-flex;
    align-items: center;
    padding: 6rpx 16rpx;
    border-radius: var(--radius-pill);
    background: var(--color-brand-light);
    font-size: var(--font-caption);
    font-weight: 700;
    line-height: var(--lh-snug);
    color: var(--color-brand-primary);
  }

  &__status-pill {
    display: inline-flex;
    align-items: center;
    padding: 6rpx 16rpx;
    border-radius: var(--radius-pill);
    font-size: var(--font-caption);
    font-weight: 600;
    line-height: var(--lh-snug);

    &--success {
      background: var(--color-brand-light);
      color: var(--color-brand-primary);
    }

    &--warning {
      background: rgba(255, 156, 0, 0.12);
      color: var(--color-func-warning);
    }

    &--error {
      background: rgba(255, 77, 79, 0.1);
      color: var(--color-func-error);
    }

    &--info {
      background: rgba(0, 105, 142, 0.1);
      color: var(--color-func-link);
    }

    &--default {
      background: var(--color-bg-surface);
      color: var(--color-text-secondary);
    }
  }

  &__hero-role {
    display: block;
    font-size: var(--font-body-large);
    font-weight: 600;
    line-height: var(--lh-normal);
    color: var(--color-text-primary);
  }

  &__store-pill {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    max-width: 100%;
    gap: 6rpx;
    padding: 8rpx 18rpx;
    border-radius: var(--radius-pill);
    background: var(--color-bg-surface);
  }

  &__store-icon {
    flex-shrink: 0;
    font-size: var(--font-caption);
    color: var(--color-brand-primary);
  }

  &__store-text {
    min-width: 0;
    font-size: var(--font-caption);
    font-weight: 600;
    line-height: var(--lh-normal);
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__body {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-md) var(--space-xl);
    background-color: var(--color-mine-page-tail);
  }

  &__card {
    display: grid;
    gap: var(--space-md);
    padding: var(--space-md);
    border-radius: var(--radius-popup);
    background: var(--color-bg-surface);
    box-shadow: 0 8rpx 24rpx rgba(17, 17, 17, 0.04);
  }

  &__leader,
  &__leader-main,
  &__member,
  &__member-main,
  &__section-header,
  &__member-row,
  &__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
  }

  &__leader-avatar,
  &__member-avatar {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
    background: var(--color-bg-body);
    flex-shrink: 0;
  }

  &__leader-meta,
  &__member-meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  &__leader-name,
  &__member-name {
    font-size: var(--font-title-medium);
    color: var(--color-text-primary);
    font-weight: 700;
  }

  &__leader-role,
  &__member-time,
  &__section-subtitle {
    font-size: var(--font-caption);
    color: var(--color-text-secondary);
  }

  &__team-status {
    flex-shrink: 0;
    padding: 8rpx 16rpx;
    border-radius: var(--radius-pill);
    font-size: var(--font-micro);
    font-weight: 600;
  }

  &__member-tag {
    flex-shrink: 0;
    padding: 6rpx 14rpx;
    border-radius: var(--radius-pill);
    font-size: var(--font-micro);
    font-weight: 600;
    color: var(--color-brand-primary);
    background: var(--color-brand-light);
  }

  &__info-grid {
    display: grid;
    gap: 18rpx;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  &__info-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-md);
    border-radius: var(--radius-card);
    background: var(--color-bg-body);
  }

  &__info-label {
    font-size: var(--font-caption);
    color: var(--color-text-secondary);
  }

  &__info-value {
    font-size: var(--font-body-medium);
    color: var(--color-text-primary);
    line-height: var(--lh-relaxed);
    word-break: break-all;
  }

  &__section-title {
    font-size: var(--font-title-medium);
    color: var(--color-text-primary);
    font-weight: 700;
  }

  &__members {
    display: grid;
    gap: 18rpx;
  }

  &__member {
    padding-bottom: var(--space-sm);
    border-bottom: 1rpx solid var(--color-border-default);

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  }

  &__member-pay {
    flex-shrink: 0;
    font-size: var(--font-caption);
    color: var(--color-brand-primary);
    font-weight: 600;
  }

  &__actions {
    flex-wrap: wrap;
  }

  &__income {
    display: grid;
    gap: var(--space-xs);
    font-size: var(--font-body-medium);
    line-height: var(--lh-relaxed);
    color: var(--color-text-secondary);
  }

  &__join-block {
    width: 100%;
    font-size: var(--font-caption);
    color: var(--color-func-warning);
    line-height: var(--lh-normal);
  }
}

:deep(.detail-primary) {
  flex: 1 !important;
  border: none !important;
  border-radius: var(--radius-pill) !important;
  background: var(--color-brand-primary) !important;
  color: var(--color-bg-surface) !important;
  font-weight: 700 !important;
}

:deep(.detail-primary--muted) {
  flex: 1 !important;
  border: 2rpx solid var(--color-border-default) !important;
  border-radius: var(--radius-pill) !important;
  background: var(--color-bg-body) !important;
  color: var(--color-text-tertiary) !important;
}

:deep(.detail-secondary) {
  min-width: 200rpx !important;
  border-radius: var(--radius-pill) !important;
  color: var(--color-text-primary) !important;
  border-color: var(--color-border-default) !important;
}
</style>
