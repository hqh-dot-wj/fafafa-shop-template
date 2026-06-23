<script lang="ts" setup>
import type {
  CourseGroupListQuery,
  CourseGroupOpenPayload,
  CourseGroupTeamsResponse,
  CourseGroupTeamSummary,
} from '@/api/course-group';
import { onLoad } from '@dcloudio/uni-app';
import { computed, reactive, ref } from 'vue';
import {
  getCourseGroupJoinPreview,
  listCourseGroupTeams,
  openCourseGroupTeam,
  proxyOpenCourseGroupTeam,
} from '@/api/course-group';
import { useAuthStore } from '@/store/auth';
import { useLocationStore } from '@/store/location';
import TeamListCard from './components/team-list-card.vue';

// 拼课组队页对应 backend CourseGroupClientController 的 teams/open/proxy-open/join-preview。
// 页面可以展示和收集开团信息，但参团资格、价格、名额和代开权限必须以后端预检和开团结果为准。
definePage({
  style: {
    navigationBarTitleText: '拼课组队',
    backgroundColor: '#f5f6fa',
  },
});

interface PageQuery {
  productId: string;
  productName: string | undefined;
  productImg: string | undefined;
  skuId: string | undefined;
  activityContextKey: string | undefined;
  activityConfigId: string | undefined;
  allowProxyOpen: boolean | undefined;
}

const authStore = useAuthStore();
const locationStore = useLocationStore();

const query = reactive<PageQuery>({
  productId: '',
  productName: undefined,
  productImg: undefined,
  skuId: undefined,
  activityContextKey: undefined,
  activityConfigId: undefined,
  allowProxyOpen: undefined,
});
const loading = ref(true);
const refreshing = ref(false);
const opening = ref(false);
const joiningTeamId = ref('');
const errorMsg = ref('');
const openPopupVisible = ref(false);
const openForm = reactive({
  classAddress: '',
  classStartTime: '',
  classEndTime: '',
});

const teamData = ref<CourseGroupTeamsResponse>({
  productId: '',
  activityContextKey: '',
  activityConfigId: '',
  canOpen: true,
  allowProxyOpen: false,
  teams: [],
  total: 0,
  pageNum: 1,
  pageSize: 20,
});

const canOpenTeam = computed(() => teamData.value.canOpen);
const allowProxyOpen = computed(() => teamData.value.allowProxyOpen || query.allowProxyOpen === true);
const currentTenantId = computed(() => locationStore.currentTenantId || teamData.value.tenantId || '');
const tenantLabel = computed(() => locationStore.currentCompanyName || teamData.value.tenantName || '当前门店');
const emptyHint = computed(() => teamData.value.emptyHint || '当前暂无可参团的拼课团队，可以先发起一团。');

onLoad((options) => {
  query.productId =
    typeof options?.productId === 'string' ? options.productId : typeof options?.id === 'string' ? options.id : '';
  query.productName = typeof options?.productName === 'string' ? decodeURIComponent(options.productName) : undefined;
  query.productImg = typeof options?.productImg === 'string' ? decodeURIComponent(options.productImg) : undefined;
  query.skuId = typeof options?.skuId === 'string' ? options.skuId : undefined;
  query.activityContextKey = typeof options?.activityContextKey === 'string' ? options.activityContextKey : undefined;
  query.activityConfigId = typeof options?.activityConfigId === 'string' ? options.activityConfigId : undefined;
  query.allowProxyOpen =
    typeof options?.allowProxyOpen === 'string'
      ? options.allowProxyOpen === '1' || options.allowProxyOpen === 'true'
      : undefined;

  if (!query.productId) {
    loading.value = false;
    errorMsg.value = '缺少商品参数，无法查看拼课团队';
    return;
  }

  if (query.productName) {
    uni.setNavigationBarTitle({ title: query.productName });
  }

  void loadTeams();
});

async function loadTeams() {
  const isFirstLoad = loading.value;
  if (!isFirstLoad) refreshing.value = true;
  errorMsg.value = '';

  const requestQuery: CourseGroupListQuery = {};
  if (currentTenantId.value) requestQuery.tenantId = currentTenantId.value;
  if (query.activityContextKey) requestQuery.activityContextKey = query.activityContextKey;

  try {
    teamData.value = await listCourseGroupTeams(query.productId, requestQuery, {
      hideErrorToast: true,
      timeout: 12_000,
    });
    const navTitle = query.productName || teamData.value.productName;
    if (navTitle) {
      uni.setNavigationBarTitle({ title: navTitle });
    }
  } catch (error: any) {
    errorMsg.value = error?.msg || error?.message || '拼课团队加载失败，请稍后重试';
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

function formatDateTimeLabel(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(
    2,
    '0',
  )} ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

function validateOpenClassTimeRange(
  classStartTimeInput: string,
  classEndTimeInput: string,
): {
  classStartTime: string;
  classEndTime: string;
} | null {
  const classStartTime = classStartTimeInput.trim();
  const classEndTime = classEndTimeInput.trim();
  if (!classStartTime || !classEndTime) {
    uni.showToast({ title: '请填写开课时间', icon: 'none' });
    return null;
  }
  const start = Date.parse(classStartTime);
  const end = Date.parse(classEndTime);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    uni.showToast({ title: '时间格式不正确', icon: 'none' });
    return null;
  }
  if (start >= end) {
    uni.showToast({ title: '开始时间必须早于结束时间', icon: 'none' });
    return null;
  }
  return { classStartTime, classEndTime };
}

function navigateToDetail(team: CourseGroupTeamSummary) {
  const params = new URLSearchParams({
    teamId: team.teamId,
    productId: team.productId || query.productId,
  });
  if (team.activityContextKey || query.activityContextKey) {
    params.set('activityContextKey', team.activityContextKey || query.activityContextKey || '');
  }
  if (team.activityConfigId || query.activityConfigId) {
    params.set('activityConfigId', team.activityConfigId || query.activityConfigId || '');
  }
  uni.navigateTo({
    url: `/pages/course-group/detail?${params.toString()}`,
  });
}

function navigateToDetailByTeamId(teamId: string, productId?: string) {
  const params = new URLSearchParams({
    teamId,
    productId: productId || query.productId,
  });
  if (query.activityContextKey) {
    params.set('activityContextKey', query.activityContextKey);
  }
  if (query.activityConfigId) {
    params.set('activityConfigId', query.activityConfigId);
  }
  uni.navigateTo({
    url: `/pages/course-group/detail?${params.toString()}`,
  });
}

async function handleJoin(team: CourseGroupTeamSummary) {
  if (!authStore.requireAuth(() => void handleJoin(team))) return;

  const tenantId = currentTenantId.value || team.tenantId || '';
  if (!tenantId) {
    uni.showToast({ title: '请先选择门店', icon: 'none' });
    return;
  }

  joiningTeamId.value = team.teamId;
  try {
    // 列表态可能已过期，进入支付前必须用 join-preview 重新确认当前团队仍可参团。
    const preview = await getCourseGroupJoinPreview(
      team.teamId,
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

    const skuId = team.skuId || query.skuId;
    if (!skuId) {
      uni.navigateTo({
        url: `/pages/product/detail?id=${encodeURIComponent(
          team.productId || query.productId,
        )}&teamId=${encodeURIComponent(team.teamId)}&isLeader=false&activityContextKey=${encodeURIComponent(
          team.activityContextKey || query.activityContextKey || '',
        )}`,
      });
      return;
    }

    const amountText = preview.payAmount !== undefined ? `¥${Number(preview.payAmount).toFixed(2)}` : '拼课价';
    const confirmed = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: '确认参团',
        content: preview.message || `确认加入 ${team.leader.name} 的拼课团，待支付金额 ${amountText}？`,
        confirmText: '去支付',
        success: (result) => resolve(Boolean(result.confirm)),
        fail: () => resolve(false),
      });
    });
    if (!confirmed) return;

    const params = new URLSearchParams({
      mode: 'course_group',
      tenantId,
      skuId,
      quantity: '1',
      groupId: team.teamId,
      isLeader: 'false',
      activityType: 'COURSE_GROUP',
    });
    if (team.activityContextKey || query.activityContextKey) {
      params.set('activityContextKey', team.activityContextKey || query.activityContextKey || '');
    }
    if (team.activityConfigId || query.activityConfigId) {
      params.set('activityConfigId', team.activityConfigId || query.activityConfigId || '');
    }
    uni.navigateTo({
      url: `/pages/order/create?${params.toString()}`,
    });
  } finally {
    joiningTeamId.value = '';
  }
}

function openCreatePopup() {
  if (!authStore.requireAuth(openCreatePopup)) return;
  if (!canOpenTeam.value) {
    uni.showToast({ title: '当前商品暂不可开团', icon: 'none' });
    return;
  }
  if (!currentTenantId.value) {
    uni.showToast({ title: '请先选择门店', icon: 'none' });
    return;
  }
  openPopupVisible.value = true;
}

function closeCreatePopup() {
  openPopupVisible.value = false;
}

function buildOpenPayload(): CourseGroupOpenPayload | null {
  if (!query.productId) return null;
  if (!currentTenantId.value) {
    uni.showToast({ title: '请先选择门店', icon: 'none' });
    return null;
  }
  const classAddress = openForm.classAddress.trim();
  if (!classAddress) {
    uni.showToast({ title: '请填写上课地址', icon: 'none' });
    return null;
  }
  const classTimeRange = validateOpenClassTimeRange(openForm.classStartTime, openForm.classEndTime);
  if (!classTimeRange) return null;
  if (!openForm.classAddress.trim()) {
    uni.showToast({ title: '请输入上课地址', icon: 'none' });
    return null;
  }
  if (!openForm.classStartTime.trim()) {
    uni.showToast({ title: '请输入开课时间', icon: 'none' });
    return null;
  }
  if (!openForm.classEndTime.trim()) {
    uni.showToast({ title: '请输入结束时间', icon: 'none' });
    return null;
  }

  const payload: CourseGroupOpenPayload = {
    productId: query.productId,
    tenantId: currentTenantId.value,
    classAddress,
    classStartTime: classTimeRange.classStartTime,
    classEndTime: classTimeRange.classEndTime,
  };
  if (query.skuId) payload.skuId = query.skuId;
  if (query.activityContextKey) payload.activityContextKey = query.activityContextKey;
  return payload;
}

async function submitOpen(mode: 'self' | 'proxy') {
  const payload = buildOpenPayload();
  if (!payload) return;

  opening.value = true;
  try {
    // self/proxy 走同一份 payload，后端根据登录态和 WorkerAuthGuard 区分普通开团与门店代开。
    const result = mode === 'proxy' ? await proxyOpenCourseGroupTeam(payload) : await openCourseGroupTeam(payload);
    uni.showToast({
      title: result.message || (mode === 'proxy' ? '门店代开成功' : '开团成功'),
      icon: 'success',
    });
    closeCreatePopup();
    if (result.teamId) {
      navigateToDetailByTeamId(result.teamId, query.productId);
      return;
    }
    await loadTeams();
  } catch (error: any) {
    uni.showToast({ title: error?.msg || error?.message || '开团失败，请稍后重试', icon: 'none' });
  } finally {
    opening.value = false;
  }
}
</script>

<template>
  <view class="course-group-page">
    <view class="course-group-page__hero">
      <view class="course-group-page__hero-content">
        <view class="course-group-page__hero-meta">
          <view class="course-group-page__store-pill">
            <view class="i-carbon-location course-group-page__store-icon" />
            <text class="course-group-page__store-text">{{ tenantLabel }}</text>
          </view>
          <text v-if="!loading && teamData.total > 0" class="course-group-page__team-count">
            {{ teamData.total }} 个团招募中
          </text>
        </view>
      </view>
    </view>

    <view class="course-group-page__body">
      <view class="course-group-page__toolbar">
        <view>
          <text class="course-group-page__section-title">可参团列表</text>
          <text class="course-group-page__section-desc">优先选择已推荐团队，成团更快。</text>
        </view>
        <wd-button size="small" plain custom-class="toolbar-refresh" @click="loadTeams">
          {{ refreshing ? '刷新中...' : '刷新' }}
        </wd-button>
      </view>

      <view v-if="loading" class="course-group-page__loading">
        <wd-loading />
        <text>团队信息加载中...</text>
      </view>

      <view v-else-if="errorMsg" class="course-group-page__error">
        <text>{{ errorMsg }}</text>
        <wd-button type="primary" size="small" @click="loadTeams">重新加载</wd-button>
      </view>

      <view v-else-if="teamData.teams.length > 0" class="course-group-page__list">
        <TeamListCard
          v-for="team in teamData.teams"
          :key="team.teamId"
          :team="team"
          :joining="joiningTeamId === team.teamId"
          @detail="navigateToDetail"
          @join="handleJoin"
        />
      </view>

      <view v-else class="course-group-page__empty">
        <view class="i-carbon-user-multiple text-96rpx text-hex-d9d9d9" />
        <text class="course-group-page__empty-title">还没有可加入的团队</text>
        <text class="course-group-page__empty-desc">{{ emptyHint }}</text>
        <wd-button v-if="canOpenTeam" type="primary" custom-class="empty-open-button" @click="openCreatePopup">
          我要开团
        </wd-button>
      </view>
    </view>

    <wd-popup
      :model-value="openPopupVisible"
      position="bottom"
      :safe-area-inset-bottom="true"
      @update:model-value="openPopupVisible = $event"
    >
      <view class="open-popup">
        <view class="open-popup__header">
          <text class="open-popup__title">发起拼课团</text>
          <text class="open-popup__subtitle">{{ tenantLabel }}</text>
        </view>

        <view class="open-popup__form">
          <wd-input v-model="openForm.classAddress" label="上课地址" placeholder="请输入门店详细地址" />
          <wd-input v-model="openForm.classStartTime" label="开课时间" placeholder="例如 2026-04-20 19:30" />
          <wd-input v-model="openForm.classEndTime" label="结束时间" placeholder="例如 2026-04-20 21:00" />
          <view class="open-popup__tips">
            <text>建议填写完整时间，方便学员判断是否适合参团。</text>
            <text v-if="formatDateTimeLabel(openForm.classStartTime)">
              当前开课：{{ formatDateTimeLabel(openForm.classStartTime) }}
            </text>
          </view>
        </view>

        <view class="open-popup__actions">
          <wd-button plain custom-class="open-popup__cancel" @click="closeCreatePopup">取消</wd-button>
          <wd-button :loading="opening" type="primary" custom-class="open-popup__submit" @click="submitOpen('self')">
            立即开团
          </wd-button>
        </view>

        <view v-if="allowProxyOpen" class="open-popup__proxy">
          <wd-button plain :loading="opening" custom-class="open-popup__proxy-button" @click="submitOpen('proxy')">
            门店代开
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style lang="scss" scoped>
.course-group-page {
  min-height: 100vh;
  background-color: var(--color-mine-page-tail);

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

  &__hero-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  &__team-count {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 8rpx 16rpx;
    border-radius: var(--radius-pill);
    background: var(--color-bg-surface);
    font-size: var(--font-caption);
    font-weight: 600;
    line-height: var(--lh-snug);
    color: var(--color-text-secondary);
  }

  &__store-pill {
    display: inline-flex;
    align-items: center;
    flex: 1;
    min-width: 0;
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
    padding: var(--space-xs) var(--space-md) var(--space-xl);
    background-color: var(--color-mine-page-tail);
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
  }

  &__section-title {
    display: block;
    font-size: var(--font-title-medium);
    color: var(--color-text-primary);
    font-weight: 700;
  }

  &__section-desc {
    display: block;
    margin-top: var(--space-xs);
    font-size: var(--font-caption);
    color: var(--color-text-secondary);
  }

  &__loading,
  &__error,
  &__empty {
    display: flex;
    min-height: 480rpx;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18rpx;
    border-radius: var(--radius-popup);
    background: var(--color-bg-surface);
    color: var(--color-text-secondary);
    text-align: center;
    padding: 40rpx;
  }

  &__list {
    display: grid;
    gap: 20rpx;
  }

  &__empty-title {
    font-size: var(--font-title-medium);
    color: var(--color-text-primary);
    font-weight: 700;
  }

  &__empty-desc {
    font-size: var(--font-body-medium);
    line-height: var(--lh-relaxed);
  }
}

.open-popup {
  padding: 32rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));

  &__header {
    display: flex;
    flex-direction: column;
    gap: 10rpx;
    margin-bottom: 24rpx;
  }

  &__title {
    font-size: 34rpx;
    color: #111827;
    font-weight: 700;
  }

  &__subtitle {
    font-size: 24rpx;
    color: #6b7280;
  }

  &__form {
    display: grid;
    gap: 18rpx;
  }

  &__tips {
    display: grid;
    gap: 8rpx;
    padding: 20rpx 24rpx;
    border-radius: 20rpx;
    background: #fff7ed;
    font-size: 22rpx;
    color: #9a3412;
  }

  &__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16rpx;
    margin-top: 28rpx;
  }

  &__proxy {
    margin-top: 16rpx;
  }

  :deep(.open-popup__submit) {
    border: none !important;
    border-radius: 999rpx !important;
    background: linear-gradient(90deg, #ff7a45 0%, #ff4d4f 100%) !important;
  }

  :deep(.open-popup__cancel),
  :deep(.open-popup__proxy-button) {
    border-radius: 999rpx !important;
  }
}

:deep(.toolbar-refresh) {
  border-radius: 999rpx !important;
}

:deep(.empty-open-button) {
  min-width: 240rpx !important;
  border: none !important;
  border-radius: 999rpx !important;
  background: linear-gradient(90deg, #ff7a45 0%, #ff4d4f 100%) !important;
}
</style>
