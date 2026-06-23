<script lang="ts" setup>
import type { ClientProductDetail } from '@libs/common-types';
import type { TeamMemberAvatar } from './components/marketing-detail/marketing-detail.types';
import type { CourseGroupTeamMember, CourseGroupTeamSummary } from '@/api/course-group';
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { computed, ref, watch } from 'vue';
import { getCourseGroupTeamDetail, listCourseGroupTeams, openCourseGroupTeam } from '@/api/course-group';
import { getCommissionPreview } from '@/api/distribution';
import { getProductDetail } from '@/api/product';
import DistShareSheet from '@/components/distribution/dist-share-sheet.vue';
import { useDistShare } from '@/composables/use-dist-share';
import { isCourseGroupActivityType } from '@/constants/course-group';
import { useMarketingDisplay } from '@/hooks/useMarketingDisplay';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useLocationStore } from '@/store/location';
import { useUserStore } from '@/store/user';
import { formatClassDateTimeText } from '@/utils/format-class-datetime';
import { Money } from '@/utils/money';
import CourseGroupOpenPopup from './components/course-group-open-popup.vue';
import CourseGroupPendingCard from './components/marketing-detail/course-group-pending-card.vue';
import FulfillmentInfoCard from './components/marketing-detail/fulfillment-info-card.vue';
import MarketingOfferCard from './components/marketing-detail/marketing-offer-card.vue';
import ProductSummaryCard from './components/marketing-detail/product-summary-card.vue';
import RecommendedTeamCard from './components/marketing-detail/recommended-team-card.vue';
import SimpleRuntimeCard from './components/marketing-detail/simple-runtime-card.vue';

definePage({
  style: {
    navigationBarTitleText: '商品详情',
  },
});

const cartStore = useCartStore();
const authStore = useAuthStore();
const userStore = useUserStore();
const locationStore = useLocationStore();
const {
  preparing: sharePreparing,
  sheetVisible: shareSheetVisible,
  sharePreview,
  prepareProductShare,
  openSheet,
  copyShareLink,
  goPosterPage,
  goQrcodePage,
  hintTimelineShare,
  trackEvent,
} = useDistShare();

type ProductSku = ClientProductDetail['skus'][number] & {
  stock?: number;
};

const product = ref<ClientProductDetail | null>(null);
const loading = ref(true);
const selectedSku = ref<ProductSku | null>(null);
const quantity = ref(1);

const currentActivityContextKey = ref<string | undefined>(undefined);
const routeTeamId = ref<string | undefined>(undefined);
const routeIsLeader = ref<boolean | undefined>(undefined);
const entrySceneCode = ref<string | undefined>(undefined);
const entryModuleCode = ref<string | undefined>(undefined);
const marketingEntrySource = ref<string | undefined>(undefined);

type MarketingEntryGroup = 'operations_resource' | 'activity_orchestration' | 'runtime_control' | 'monitoring_analysis';

const entryGroup = ref<MarketingEntryGroup>('activity_orchestration');

const courseGroupPopupVisible = ref(false);
const courseGroupOpening = ref(false);
const commissionHint = ref('');
const canEarnCommission = ref(false);

const recommendedTeam = ref<CourseGroupTeamSummary | null>(null);
const recommendedTeamMembers = ref<CourseGroupTeamMember[]>([]);

function normalizeEntryGroup(value: unknown): MarketingEntryGroup {
  if (typeof value !== 'string') return 'activity_orchestration';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'operations_resource') return 'operations_resource';
  if (normalized === 'runtime_control') return 'runtime_control';
  if (normalized === 'monitoring_analysis') return 'monitoring_analysis';
  return 'activity_orchestration';
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildMarketingEntrySource(action: 'add_to_cart' | 'buy_now' | 'course_group'): string {
  const baseSource = marketingEntrySource.value?.trim() || 'unknown';
  return `${action}:product_detail:${baseSource}:${entryGroup.value}`;
}

const isService = computed(() => product.value?.type === 'SERVICE');
const isReal = computed(() => product.value?.type === 'REAL');

const {
  displayPrice,
  originalPrice,
  activityLabel,
  activityKind,
  activityExplainItems,
  activeActivity,
  getSkuActivityPrice,
  selectedSkuInActivity,
  skuActivityBadgeText,
} = useMarketingDisplay(product, selectedSku);
const isCourseGroupActivity = computed(() => isCourseGroupActivityType(activeActivity.value?.activityType));

const courseGroupRules = computed(() => toRecord(activeActivity.value?.rules));
const courseGroupDisplayData = computed(() => toRecord(activeActivity.value?.displayData));

const courseGroupMinCount = computed(() => Math.max(1, Number(readNumber(courseGroupRules.value.minCount) ?? 1)));
const courseGroupMaxCount = computed(() =>
  Math.max(courseGroupMinCount.value, Number(readNumber(courseGroupRules.value.maxCount) ?? courseGroupMinCount.value)),
);

const courseGroupCountText = computed(() => {
  return (
    readString(courseGroupDisplayData.value.countText) ||
    `${courseGroupMinCount.value}人成班，最多${courseGroupMaxCount.value}人`
  );
});

const courseGroupScheduleText = computed(() => {
  const display = readString(courseGroupDisplayData.value.scheduleText);
  if (display) return display;
  const start = formatClassDateTimeText(courseGroupRules.value.classStartTime);
  const end = formatClassDateTimeText(courseGroupRules.value.classEndTime);
  if (start && end) return `${start} - ${end}`;
  return start || end || '开课时间待定';
});

const courseGroupAddressText = computed(() => {
  return (
    readString(courseGroupDisplayData.value.addressText) ||
    readString(courseGroupRules.value.classAddress) ||
    '上课地点待定'
  );
});

const courseGroupStoreName = computed(() => {
  return readString(courseGroupDisplayData.value.storeName) || locationStore.currentCompanyName || '当前定位门店';
});

const courseGroupJoinableTeamCount = computed(() => {
  const count =
    readNumber(courseGroupDisplayData.value.joinableTeamCount) ??
    readNumber(courseGroupDisplayData.value.availableTeamCount) ??
    readNumber(courseGroupRules.value.joinableTeamCount) ??
    0;
  return Math.max(0, Number(count));
});

const courseGroupLatestTeamSummary = computed(() => {
  return (
    readString(courseGroupDisplayData.value.latestTeamSummary) ||
    (courseGroupJoinableTeamCount.value > 0 ? `最近有${courseGroupJoinableTeamCount.value}个可加入团` : '')
  );
});

const courseGroupCanOpen = computed(() => {
  const mustDistributor = courseGroupRules.value.leaderMustBeDistributor === true;
  if (!mustDistributor) return true;
  return userStore.isDistributor;
});

const courseGroupOpenQualificationText = computed(() => {
  if (!courseGroupCanOpen.value) return '当前账号不满足开团资格，可先参与拼课';
  return readString(courseGroupDisplayData.value.openQualificationText) || '满足条件后可发起拼课团';
});

const courseGroupFailureHint = computed(() => {
  return readString(courseGroupDisplayData.value.failurePolicyText) || '成班失败将按活动规则处理（退款或转班）';
});

const courseGroupStoreMatched = computed(() => Boolean(locationStore.currentTenantId));

const courseGroupStoreParticipatingFlag = computed(() =>
  parseBoolean(courseGroupDisplayData.value.storeParticipating ?? courseGroupRules.value.storeParticipating),
);

const courseGroupStoreReadyFlag = computed(() =>
  parseBoolean(courseGroupDisplayData.value.storeReady ?? courseGroupRules.value.storeReady),
);

const courseGroupStoreParticipating = computed(() => courseGroupStoreParticipatingFlag.value === true);

const courseGroupStoreReady = computed(() => courseGroupStoreReadyFlag.value === true);

const hasValidCourseGroupActivity = computed(() =>
  Boolean(isCourseGroupActivity.value && activeActivity.value?.activityContextKey && activeActivity.value?.configId),
);

/** 商品挂了拼课活动（与当前 SKU 是否参与无关），用于切换非拼课规格时的页面形态 */
const isCourseGroupProduct = computed(() => hasValidCourseGroupActivity.value);

const nonParticipatingSkuHint = computed(() => {
  if (!isCourseGroupProduct.value || selectedSkuInActivity.value) return '';
  const tagged = (product.value?.skus ?? []).find((sku) => getSkuActivityPrice(sku.skuId) != null);
  const spec = tagged ? Object.values(tagged.specValues || {}).join(' / ') : '带「拼课」标签';
  return `当前规格不参与拼课，请选择${spec || '参与拼课的规格'}`;
});

/** 当前 SKU 参与拼课活动（有 skuPrices 时仅命中 SKU 展示拼课区） */
const showCourseGroupForSku = computed(() => hasValidCourseGroupActivity.value && selectedSkuInActivity.value);

const showCourseGroupStoreCard = computed(
  () =>
    showCourseGroupForSku.value &&
    courseGroupStoreMatched.value &&
    courseGroupStoreParticipating.value &&
    courseGroupStoreReady.value,
);

const courseGroupBlockedReason = computed(() => {
  if (!showCourseGroupForSku.value) return '';
  if (!courseGroupStoreMatched.value) return '请先定位到当前门店后查看拼课信息';
  if (courseGroupStoreParticipatingFlag.value !== true) {
    return courseGroupStoreParticipatingFlag.value === false
      ? '当前门店未参与该拼课活动'
      : '当前门店参与状态未确认，暂不可开团或参团';
  }
  if (courseGroupStoreReadyFlag.value !== true) {
    return courseGroupStoreReadyFlag.value === false
      ? '当前门店拼课规则未就绪，暂不可开团或参团'
      : '当前门店拼课就绪状态未确认，暂不可开团或参团';
  }
  return '';
});

const isRecruitingTeam = (team: CourseGroupTeamSummary) => String(team.teamStatus || '').toUpperCase() === 'RECRUITING';

/** 有可展示的推荐团：招募中且可加入，用于头像墙卡片 */
const showRecommendedTeamCard = computed(() => {
  const team = recommendedTeam.value;
  if (!showCourseGroupStoreCard.value || !team) return false;
  return isRecruitingTeam(team) && team.joinable === true;
});

/** 拼课 SKU 已就绪但无合适推荐团（无团 / 仅已成团） */
const showCourseGroupPendingCard = computed(
  () => showCourseGroupStoreCard.value && !courseGroupBlockedReason.value && !showRecommendedTeamCard.value,
);

const courseGroupPendingHint = computed(() => {
  if (recommendedTeam.value && !recommendedTeam.value.joinable) {
    return readString(recommendedTeam.value.joinBlockReasonText) || '当前推荐团已满或已成团，可查看其他团或自己开团';
  }
  if (courseGroupJoinableTeamCount.value > 0) {
    return `附近有${courseGroupJoinableTeamCount.value}个团在招募，可查看后选择加入`;
  }
  return '可先自己开团，或查看全部正在招募的团';
});

const recommendedTeamLeaderName = computed(() => recommendedTeam.value?.leader?.name ?? '');

const recommendedTeamMemberAvatars = computed<TeamMemberAvatar[]>(() => {
  return recommendedTeamMembers.value.map((m) => ({
    memberId: m.memberId,
    avatar: m.avatar,
    role: m.role,
  }));
});

const recommendedTeamScheduleText = computed(() => {
  if (recommendedTeam.value?.classStartTime) {
    const start = formatClassDateTimeText(recommendedTeam.value.classStartTime);
    const end = recommendedTeam.value.classEndTime ? formatClassDateTimeText(recommendedTeam.value.classEndTime) : '';
    if (start && end) return `${start} - ${end}`;
    return start || courseGroupScheduleText.value;
  }
  return courseGroupScheduleText.value;
});

const recommendedTeamAddressText = computed(() => {
  return recommendedTeam.value?.classAddress || courseGroupAddressText.value;
});

const recommendedTeamReasonText = computed(() => {
  const team = recommendedTeam.value;
  if (!team || !showRecommendedTeamCard.value) return '';
  const min = team.minCount ?? courseGroupMinCount.value;
  const current = team.currentMembers ?? 0;
  const remainToForm = Math.max(min - current, 0);
  if (remainToForm > 0) return `离您最近，还差${remainToForm}人即可成团`;
  return '离您最近，可直接加入';
});

const marketingOfferTitle = computed(() => {
  const configured =
    readString(courseGroupDisplayData.value.offerTitle) || readString(toRecord(activeActivity.value).offerTitle);
  if (configured) return configured;
  if (showCourseGroupForSku.value) return '这个课可以拼课报名';
  if (!selectedSkuInActivity.value) return '';
  const activityName = readString(activeActivity.value?.activityName);
  if (activityKind.value === 'flash') return activityName || '限时秒杀';
  if (activityKind.value === 'member') return activityName || '会员专享价';
  if (activityName) return activityName;
  return '';
});

const marketingOfferDesc = computed(() => {
  const configured =
    readString(courseGroupDisplayData.value.offerDesc) || readString(toRecord(activeActivity.value).offerDesc);
  if (configured) return configured;
  if (showCourseGroupForSku.value) {
    return showRecommendedTeamCard.value
      ? '系统已根据您的位置，优先选择最合适的团。'
      : '当前规格可拼课，可先开团或浏览全部招募中的团。';
  }
  if (!selectedSkuInActivity.value) return '';
  if (activityKind.value === 'flash') return '当前规格享受秒杀价，优惠有时间限制。';
  if (activityKind.value === 'member') return '当前规格享受会员价，以结算页为准。';
  return '';
});

const marketingExplainItems = computed<string[]>(() => {
  const raw = courseGroupDisplayData.value.explainItems ?? toRecord(activeActivity.value).explainItems;
  if (Array.isArray(raw) && raw.length > 0) return raw.map(String).filter(Boolean);

  if (showCourseGroupForSku.value) {
    return [
      `${courseGroupMinCount.value}人成班，最多${courseGroupMaxCount.value}人`,
      readString(courseGroupDisplayData.value.failurePolicyText) || '不成班可退款或转班',
      '每个团时间和地址可能不同',
    ];
  }
  return activityExplainItems.value;
});

watch(displayPrice, () => {
  void calculateCommission();
});

watch(selectedSku, () => {
  if (showCourseGroupForSku.value) {
    void loadRecommendedTeam();
    return;
  }
  recommendedTeam.value = null;
  recommendedTeamMembers.value = [];
});

onLoad(async (options) => {
  const productId = options?.id;
  if (typeof options?.activityContextKey === 'string') currentActivityContextKey.value = options.activityContextKey;
  if (typeof options?.teamId === 'string') routeTeamId.value = options.teamId;
  if (options?.isLeader !== undefined) routeIsLeader.value = parseBoolean(options.isLeader);
  if (typeof options?.entrySceneCode === 'string') entrySceneCode.value = options.entrySceneCode;
  if (typeof options?.entryModuleCode === 'string') entryModuleCode.value = options.entryModuleCode;
  if (typeof options?.entrySource === 'string') marketingEntrySource.value = options.entrySource;
  if (options?.entryGroup !== undefined) entryGroup.value = normalizeEntryGroup(options.entryGroup);

  if (productId) {
    await loadProductDetail(String(productId));
  }
});

onShareAppMessage(() => {
  const preview = sharePreview.value;
  if (preview) {
    void trackEvent('CLICK', { action: 'product_detail_share_friend' });
    const content = {
      title: preview.title,
      path: preview.path,
    };
    if (preview.imageUrl) return { ...content, imageUrl: preview.imageUrl };
    return content;
  }

  const detailPath = product.value?.productId
    ? `/pages/product/detail?id=${encodeURIComponent(product.value.productId)}`
    : '/pages/index/index';
  const content = {
    title: product.value?.name || '商品推荐',
    path: detailPath,
  };
  const imageUrl = product.value?.mainImages?.[0];
  if (imageUrl) return { ...content, imageUrl };
  return content;
});

onShareTimeline(() => {
  const preview = sharePreview.value;
  if (preview) {
    void trackEvent('CLICK', { action: 'product_detail_share_timeline' });
    const content = {
      title: preview.title,
      query: preview.query,
    };
    if (preview.imageUrl) return { ...content, imageUrl: preview.imageUrl };
    return content;
  }
  const content = {
    title: product.value?.name || '商品推荐',
    query: '',
  };
  const imageUrl = product.value?.mainImages?.[0];
  if (imageUrl) return { ...content, imageUrl };
  return content;
});

async function loadProductDetail(id: string) {
  loading.value = true;
  try {
    const result = await getProductDetail(id, currentActivityContextKey.value);
    if (result) {
      product.value = result;
      if (Array.isArray(result.skus) && result.skus.length > 0) {
        const firstSku = result.skus[0];
        if (firstSku) selectedSku.value = firstSku;
      }
      await Promise.all([calculateCommission(), loadRecommendedTeam()]);
    }
  } catch (error) {
    console.error('加载商品详情失败:', error);
    uni.showToast({ title: '商品加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function loadRecommendedTeam() {
  if (!product.value || !showCourseGroupForSku.value || !activeActivity.value) return;
  if (!locationStore.currentTenantId) return;

  try {
    const teamsResult = await listCourseGroupTeams(product.value.productId, {
      tenantId: locationStore.currentTenantId,
      activityContextKey: activeActivity.value.activityContextKey,
    });
    const teams = teamsResult?.teams ?? [];
    recommendedTeam.value = null;
    recommendedTeamMembers.value = [];

    if (!teams.length) return;

    const joinableRecruiting = teams.find((t) => t.joinable && isRecruitingTeam(t));
    const recruiting = teams.find((t) => isRecruitingTeam(t));
    const fallback = teams.find((t) => t.recommended) ?? teams[0];
    const bestTeam = joinableRecruiting ?? recruiting ?? fallback;
    if (!bestTeam) return;

    // 仅招募中可加入团展示推荐团卡片；已成团等走 pending 卡
    if (!isRecruitingTeam(bestTeam) || bestTeam.joinable !== true) {
      recommendedTeam.value = bestTeam;
      return;
    }

    recommendedTeam.value = bestTeam;

    const detail = await getCourseGroupTeamDetail(bestTeam.teamId, {
      tenantId: locationStore.currentTenantId,
    });
    if (detail?.members) {
      recommendedTeamMembers.value = detail.members;
    }
  } catch (error) {
    console.error('加载推荐团失败:', error);
  }
}

async function calculateCommission() {
  if (!userStore.isDistributor) {
    commissionHint.value = '';
    canEarnCommission.value = false;
    return;
  }
  if (!product.value || !locationStore.currentTenantId || !userStore.userInfo) return;

  try {
    const res = await getCommissionPreview({
      tenantId: locationStore.currentTenantId,
      shareUserId: String(userStore.userInfo.userId),
    });
    if (!res) return;
    if (res.notice) {
      commissionHint.value = res.notice;
      canEarnCommission.value = res.isCrossEnabled;
      return;
    }
    if (res.commissionRate) {
      const rate = new Money(res.commissionRate).div(100);
      const amount = new Money(displayPrice.value).mul(rate).format();
      commissionHint.value = `推广赚 ¥${amount}`;
      canEarnCommission.value = true;
    }
  } catch (error) {
    console.error(error);
  }
}

function isSkuSoldOut(sku: ProductSku | null | undefined) {
  return typeof sku?.stock === 'number' && sku.stock <= 0;
}

const selectedSkuSoldOut = computed(() => isSkuSoldOut(selectedSku.value));

function onSelectSku(sku: ProductSku) {
  selectedSku.value = sku;
}

function checkPreconditions(actionCallback: () => void): boolean {
  if (!selectedSku.value) {
    uni.showToast({ title: isService.value ? '请选择服务类型' : '请选择规格', icon: 'none' });
    return false;
  }
  if (isSkuSoldOut(selectedSku.value)) {
    uni.showToast({ title: '该规格已售罄', icon: 'none' });
    return false;
  }
  if (!authStore.requireAuth(actionCallback)) {
    return false;
  }
  if (!locationStore.currentTenantId) {
    uni.showToast({ title: '请先选择门店', icon: 'none' });
    return false;
  }
  return true;
}

async function addToCart() {
  if (!checkPreconditions(() => void addToCart())) return;
  const activity = activeActivity.value;
  const activityContext = activity
    ? {
        activityContextKey: activity.activityContextKey,
        entrySource: buildMarketingEntrySource('add_to_cart'),
      }
    : undefined;

  const success = await cartStore.addToCart(selectedSku.value!.skuId, quantity.value, activityContext);
  if (!success) {
    uni.showToast({ title: '加入购物车失败', icon: 'none' });
  }
}

async function buyNow() {
  if (!checkPreconditions(() => void buyNow())) return;
  const checkoutTenantId = locationStore.currentTenantId ?? '';
  if (!(await locationStore.ensureCheckoutAddressAligned(checkoutTenantId))) return;

  const params: Record<string, string> = {
    mode: 'direct',
    tenantId: locationStore.currentTenantId!,
    skuId: selectedSku.value!.skuId,
    quantity: String(quantity.value),
  };

  const activity = activeActivity.value;
  if (activity) {
    params.activityContextKey = activity.activityContextKey;
  }

  if (entrySceneCode.value) params.entrySceneCode = entrySceneCode.value;
  if (entryModuleCode.value) params.entryModuleCode = entryModuleCode.value;
  params.entryGroup = entryGroup.value;
  params.entrySource = buildMarketingEntrySource('buy_now');

  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  uni.navigateTo({ url: `/pages/order/create?${queryString}` });
}

function bookNow() {
  void buyNow();
}

async function handleCourseGroupCheckout(
  activity: { activityContextKey: string; activityType: string; configId: string },
  options?: { teamId?: string; isLeader?: boolean },
) {
  if (!checkPreconditions(() => void handleCourseGroupCheckout(activity, options))) return;
  const checkoutTenantId = locationStore.currentTenantId ?? '';
  if (!(await locationStore.ensureCheckoutAddressAligned(checkoutTenantId))) return;

  const isCourseGroup = isCourseGroupActivityType(activity.activityType);
  const explicitIsLeader = options?.isLeader ?? routeIsLeader.value;
  const rawTeamId = options?.teamId ?? routeTeamId.value;
  const joinMode = isCourseGroup ? (explicitIsLeader === true ? false : Boolean(rawTeamId)) : Boolean(rawTeamId);
  const teamId = joinMode ? rawTeamId : undefined;
  const resolvedIsLeader = isCourseGroup ? !joinMode : undefined;

  if (isCourseGroup && resolvedIsLeader && !courseGroupCanOpen.value) {
    uni.showToast({ title: '当前账号无开团资格', icon: 'none' });
    return;
  }

  const params: Record<string, string> = {
    mode: 'course_group',
    tenantId: locationStore.currentTenantId!,
    skuId: selectedSku.value!.skuId,
    quantity: String(quantity.value),
    activityContextKey: activity.activityContextKey,
  };

  if (teamId) params.teamId = teamId;
  if (isCourseGroup && resolvedIsLeader !== undefined) params.isLeader = String(resolvedIsLeader);
  if (entrySceneCode.value) params.entrySceneCode = entrySceneCode.value;
  if (entryModuleCode.value) params.entryModuleCode = entryModuleCode.value;
  params.entryGroup = entryGroup.value;
  params.entrySource = buildMarketingEntrySource('course_group');

  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  uni.navigateTo({ url: `/pages/order/create?${queryString}` });
}

function goCourseGroupTeams() {
  if (!product.value || !selectedSku.value || !activeActivity.value) return;
  const params: Record<string, string> = {
    productId: product.value.productId,
    skuId: selectedSku.value.skuId,
    tenantId: locationStore.currentTenantId || '',
    activityContextKey: activeActivity.value.activityContextKey,
    canOpen: String(courseGroupCanOpen.value),
  };
  const queryString = Object.entries(params)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  uni.navigateTo({ url: `/pages/course-group/teams?${queryString}` });
}

function onJoinCourseGroup() {
  if (!checkPreconditions(() => void onJoinCourseGroup())) return;
  if (!showCourseGroupForSku.value) {
    uni.showToast({ title: '当前规格不参与拼课活动', icon: 'none' });
    return;
  }
  if (!showCourseGroupStoreCard.value) {
    uni.showToast({ title: '当前门店暂不可参与拼课', icon: 'none' });
    return;
  }
  if (routeTeamId.value && activeActivity.value) {
    void handleCourseGroupCheckout(activeActivity.value, { teamId: routeTeamId.value, isLeader: false });
    return;
  }
  goCourseGroupTeams();
}

function onOpenCourseGroup() {
  if (!checkPreconditions(() => void onOpenCourseGroup())) return;
  if (!showCourseGroupStoreCard.value) {
    uni.showToast({ title: '当前门店暂不可开团', icon: 'none' });
    return;
  }
  if (!courseGroupCanOpen.value) {
    uni.showToast({ title: '当前账号无开团资格', icon: 'none' });
    return;
  }
  courseGroupPopupVisible.value = true;
}

async function onConfirmOpenGroup(payload: { classAddress: string; classStartTime: string; classEndTime: string }) {
  if (!product.value || !selectedSku.value || !activeActivity.value || !locationStore.currentTenantId) {
    uni.showToast({ title: '开团参数不完整', icon: 'none' });
    return;
  }
  courseGroupOpening.value = true;
  try {
    const result = await openCourseGroupTeam(
      {
        tenantId: locationStore.currentTenantId,
        productId: product.value.productId,
        skuId: selectedSku.value.skuId,
        activityContextKey: activeActivity.value.activityContextKey,
        classAddress: payload.classAddress,
        classStartTime: payload.classStartTime,
        classEndTime: payload.classEndTime,
      },
      { timeout: 10_000 },
    );
    courseGroupPopupVisible.value = false;
    const teamId = readString((result as Record<string, unknown> | null)?.teamId);
    if (teamId) {
      uni.navigateTo({ url: `/pages/course-group/detail?teamId=${encodeURIComponent(teamId)}` });
      return;
    }
    goCourseGroupTeams();
  } catch (error) {
    console.error('开团失败:', error);
    uni.showToast({ title: '开团失败，请稍后重试', icon: 'none' });
  } finally {
    courseGroupOpening.value = false;
  }
}

function goCart() {
  uni.switchTab({ url: '/pages/cart/cart' });
}

function goHome() {
  uni.switchTab({ url: '/pages/index/index' });
}

async function ensureSharePreview() {
  if (!product.value) {
    uni.showToast({ title: '商品信息未加载完成', icon: 'none' });
    return false;
  }
  const shareOptions: Parameters<typeof prepareProductShare>[0] = {
    productId: product.value.productId,
    productName: product.value.name,
  };
  const productImage = product.value.mainImages?.[0];
  if (productImage) shareOptions.productImage = productImage;
  await prepareProductShare(shareOptions);
  return true;
}

async function openSharePanel() {
  const ready = await ensureSharePreview();
  if (!ready) return;
  openSheet();
}

async function handleShareFriend() {
  await trackEvent('CLICK', { action: 'product_detail_sheet_friend' });
}

async function handleShareTimeline() {
  await hintTimelineShare();
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

function formatRadius(meters?: number): string {
  if (!meters) return '';
  if (meters < 1000) return `${meters}米`;
  return `${(meters / 1000).toFixed(1)}公里`;
}
</script>

<template>
  <view class="page-wrap">
    <!-- Loading -->
    <view v-if="loading" class="page-empty">
      <wd-loading />
    </view>

    <!-- 主内容 -->
    <template v-else-if="product">
      <!-- 主图轮播 -->
      <swiper class="page-swiper" indicator-dots autoplay circular>
        <swiper-item v-for="(img, index) in product.mainImages" :key="index">
          <image class="page-swiper__img" :src="img" mode="aspectFill" />
        </swiper-item>
        <swiper-item v-if="!product.mainImages?.length">
          <image class="page-swiper__img" src="/static/images/placeholder.png" mode="aspectFill" />
        </swiper-item>
      </swiper>

      <!-- 营销区块 -->
      <ProductSummaryCard
        :name="product.name"
        :sub-title="product.subTitle"
        :activity-badge="selectedSkuInActivity ? activityLabel : undefined"
        :store-name="showCourseGroupForSku ? courseGroupStoreName : undefined"
      />

      <MarketingOfferCard
        v-if="!activeActivity || selectedSkuInActivity"
        :display-price="displayPrice"
        :original-price="originalPrice"
        :price-label="activityLabel"
        :offer-title="selectedSkuInActivity ? marketingOfferTitle : ''"
        :offer-desc="selectedSkuInActivity ? marketingOfferDesc : ''"
        :explain-items="selectedSkuInActivity ? marketingExplainItems : []"
        :commission-hint="commissionHint"
        :can-earn-commission="canEarnCommission"
      />

      <view v-else-if="isCourseGroupProduct" class="plain-price-card">
        <view class="plain-price-card__row">
          <text class="plain-price-card__label">售价</text>
          <text class="plain-price-card__symbol">¥</text>
          <text class="plain-price-card__amount">{{ displayPrice }}</text>
        </view>
        <text v-if="nonParticipatingSkuHint" class="plain-price-card__hint">{{ nonParticipatingSkuHint }}</text>
      </view>

      <RecommendedTeamCard
        v-if="showRecommendedTeamCard && activeActivity"
        :store-name="courseGroupStoreName"
        :schedule-text="recommendedTeamScheduleText"
        :address-text="recommendedTeamAddressText"
        :reason-text="recommendedTeamReasonText"
        :leader-name="recommendedTeamLeaderName"
        :member-avatars="recommendedTeamMemberAvatars"
        :min-count="recommendedTeam?.minCount ?? courseGroupMinCount"
        :max-count="recommendedTeam?.maxCount ?? courseGroupMaxCount"
        :current-members="recommendedTeam?.currentMembers ?? 0"
        :remaining-slots="recommendedTeam?.remainingSlots ?? 0"
        :team-status="recommendedTeam?.teamStatus"
        :can-open="courseGroupCanOpen"
        :opening="courseGroupOpening"
        :team-id="recommendedTeam?.teamId"
        :joinable="recommendedTeam?.joinable ?? false"
        @change-team="goCourseGroupTeams"
        @open-group="onOpenCourseGroup"
        @join-team="(teamId) => handleCourseGroupCheckout(activeActivity!, { teamId, isLeader: false })"
      />

      <CourseGroupPendingCard
        v-else-if="showCourseGroupPendingCard"
        :store-name="courseGroupStoreName"
        :hint-text="courseGroupPendingHint"
        :count-text="courseGroupCountText"
        :schedule-text="courseGroupScheduleText"
        :address-text="courseGroupAddressText"
        :can-open="courseGroupCanOpen"
        :opening="courseGroupOpening"
        @browse-teams="goCourseGroupTeams"
        @open-group="onOpenCourseGroup"
      />

      <SimpleRuntimeCard
        v-if="!isCourseGroupProduct && (isService || isReal)"
        :is-service="isService"
        :is-real="isReal"
        :service-duration="product.serviceDuration"
        :service-radius="product.serviceRadius"
        :need-booking="product.needBooking"
        :is-free-ship="product.isFreeShip"
      />

      <FulfillmentInfoCard
        v-if="showCourseGroupForSku"
        :is-course-group="showCourseGroupForSku"
        :address-text="showRecommendedTeamCard ? recommendedTeamAddressText : courseGroupAddressText"
        :schedule-text="showRecommendedTeamCard ? recommendedTeamScheduleText : courseGroupScheduleText"
        :count-text="courseGroupCountText"
        :failure-hint="courseGroupFailureHint"
        :blocked-reason="courseGroupBlockedReason"
      />

      <CourseGroupOpenPopup
        v-model="courseGroupPopupVisible"
        :store-name="courseGroupStoreName"
        :submitting="courseGroupOpening"
        @confirm="onConfirmOpenGroup"
      />

      <!-- 规格选择 -->
      <view v-if="product.skus?.length > 0" class="sku-section">
        <text class="sku-section__title">
          {{ isService ? '选择服务类型' : '选择规格' }}
        </text>
        <view class="sku-section__list">
          <view
            v-for="sku in product.skus"
            :key="sku.skuId"
            class="sku-section__item"
            :class="{
              'sku-section__item--active': selectedSku?.skuId === sku.skuId,
              'sku-section__item--disabled': isSkuSoldOut(sku),
            }"
            @click="onSelectSku(sku)"
          >
            <view class="sku-section__spec-row">
              <text class="sku-section__spec">{{ Object.values(sku.specValues || {}).join(' / ') || '默认' }}</text>
              <text v-if="getSkuActivityPrice(sku.skuId) != null" class="sku-section__activity-tag">
                {{ skuActivityBadgeText || '活动' }}
              </text>
            </view>
            <template v-if="getSkuActivityPrice(sku.skuId) != null && !isSkuSoldOut(sku)">
              <text class="sku-section__price sku-section__price--activity">
                ¥{{ getSkuActivityPrice(sku.skuId) }}
              </text>
              <text class="sku-section__price--original">¥{{ sku.price }}</text>
            </template>
            <text v-else class="sku-section__price" :class="{ 'sku-section__price--disabled': isSkuSoldOut(sku) }">
              ¥{{ sku.price }}
            </text>
            <text v-if="isSkuSoldOut(sku)" class="sku-section__sold-out">已售罄</text>
          </view>
        </view>
      </view>

      <!-- 商品详情 -->
      <view class="detail-section">
        <text class="detail-section__title">商品详情</text>
        <rich-text class="detail-section__content" :nodes="product.detailHtml || '<p>暂无详情</p>'" />
      </view>

      <!-- 底部固定操作栏 -->
      <view class="bottom-bar">
        <view class="bottom-bar__tools">
          <view class="bottom-bar__tool" @click="goHome">
            <view class="i-carbon-home bottom-bar__tool-icon" />
            <text>首页</text>
          </view>
          <view class="bottom-bar__tool" @click="goCart">
            <view class="i-carbon-shopping-cart bottom-bar__tool-icon" />
            <text>购物车</text>
          </view>
          <view class="bottom-bar__tool" @click="openSharePanel">
            <view class="i-carbon-share bottom-bar__tool-icon" />
            <text>分享</text>
          </view>
        </view>

        <view class="bottom-bar__actions">
          <template v-if="showCourseGroupStoreCard && activeActivity">
            <!-- 有可参团的推荐团：直接参团（全宽主按钮） -->
            <button
              v-if="showRecommendedTeamCard && recommendedTeam"
              class="bottom-bar__btn bottom-bar__btn--primary bottom-bar__btn--full"
              :class="{ 'bottom-bar__btn--disabled': selectedSkuSoldOut }"
              @click="handleCourseGroupCheckout(activeActivity!, { teamId: recommendedTeam.teamId, isLeader: false })"
            >
              参与拼课
            </button>
            <!-- 有推荐团但不可直接参（已满等）：参与拼课浏览其他团 -->
            <button
              v-else-if="recommendedTeam"
              class="bottom-bar__btn bottom-bar__btn--primary bottom-bar__btn--full"
              :class="{ 'bottom-bar__btn--disabled': selectedSkuSoldOut }"
              @click="goCourseGroupTeams"
            >
              参与拼课
            </button>
            <!-- 无推荐团：参与拼课 + 我要开团 -->
            <template v-else>
              <button
                class="bottom-bar__btn bottom-bar__btn--secondary"
                :class="{ 'bottom-bar__btn--disabled': selectedSkuSoldOut }"
                @click="onJoinCourseGroup"
              >
                参与拼课
              </button>
              <button
                class="bottom-bar__btn bottom-bar__btn--primary"
                :class="{ 'bottom-bar__btn--disabled': selectedSkuSoldOut || !courseGroupCanOpen }"
                @click="onOpenCourseGroup"
              >
                我要开团
              </button>
            </template>
          </template>

          <template v-else>
            <button
              class="bottom-bar__btn bottom-bar__btn--cart"
              :class="{ 'bottom-bar__btn--disabled': selectedSkuSoldOut }"
              @click="addToCart"
            >
              加入购物车
            </button>

            <button
              v-if="isReal"
              class="bottom-bar__btn bottom-bar__btn--primary"
              :class="{ 'bottom-bar__btn--disabled': selectedSkuSoldOut }"
              @click="buyNow"
            >
              {{ selectedSkuSoldOut ? '已售罄' : '立即购买' }}
            </button>

            <button
              v-else-if="isService"
              class="bottom-bar__btn bottom-bar__btn--service"
              :class="{ 'bottom-bar__btn--disabled': isSkuSoldOut(selectedSku) }"
              @click="bookNow"
            >
              {{ isSkuSoldOut(selectedSku) ? '已售罄' : '立即预约' }}
            </button>
          </template>
        </view>
      </view>

      <DistShareSheet
        v-model="shareSheetVisible"
        :loading="sharePreparing"
        @share-friend="handleShareFriend"
        @share-timeline="handleShareTimeline"
        @copy-link="copyShareLink"
        @generate-poster="goPosterPage"
        @generate-qrcode="goQrcodePage"
      />

      <!-- 底部栏占位 -->
      <view class="bottom-bar__spacer" />
    </template>

    <!-- 空态 -->
    <view v-else class="page-empty">
      <view class="i-carbon-warning page-empty__icon" />
      <text class="page-empty__text">商品不存在或已下架</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
// ======================== 页面框架 ========================
.page-wrap {
  min-height: 100vh;
  background: var(--color-bg-body);
  padding-bottom: env(safe-area-inset-bottom);
}

.page-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  gap: var(--space-md);
}

.page-empty__icon {
  font-size: 80rpx;
  color: var(--color-text-tertiary);
}

.page-empty__text {
  font-size: var(--font-body-large);
  color: var(--color-text-tertiary);
}

// ======================== 主图轮播 ========================
.page-swiper {
  width: 100%;
  height: 750rpx;
}

.page-swiper__img {
  width: 100%;
  height: 100%;
}

// ======================== 非拼课规格 plain 价卡 ========================
.plain-price-card {
  margin: var(--space-sm) var(--space-sm) 0;
  padding: var(--space-lg);
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  box-shadow: var(--shadow-card);
}

.plain-price-card__row {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
}

.plain-price-card__label {
  padding: 4rpx 12rpx;
  border-radius: var(--radius-sm);
  background: var(--color-bg-body);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  font-weight: 600;
}

.plain-price-card__symbol {
  font-size: var(--font-caption);
  color: var(--color-price);
  font-weight: 600;
}

.plain-price-card__amount {
  font-size: var(--font-display-md);
  font-weight: 700;
  color: var(--color-price);
  line-height: 1;
}

.plain-price-card__hint {
  display: block;
  margin-top: var(--space-md);
  font-size: var(--font-body-large);
  color: var(--color-text-secondary);
  line-height: var(--lh-relaxed);
}

// ======================== 规格选择 ========================
.sku-section {
  margin: var(--space-sm) var(--space-sm) 0;
  padding: var(--space-lg);
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  box-shadow: var(--shadow-card);
}

.sku-section__title {
  display: block;
  font-size: var(--font-title-medium);
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-md);
}

.sku-section__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.sku-section__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-card);
  border: 2rpx solid var(--color-border-default);
  background: var(--color-bg-surface);
  transition: all var(--duration-fast);

  &:active {
    opacity: 0.8;
  }
}

.sku-section__item--active {
  border-color: var(--color-brand-primary);
  background: var(--color-brand-light);
}

.sku-section__item--disabled {
  background: var(--color-bg-body);
  opacity: 0.6;
}

.sku-section__spec-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.sku-section__activity-tag {
  font-size: var(--font-micro);
  font-weight: 600;
  color: var(--color-brand-primary);
  background: var(--color-brand-light);
  padding: 2rpx 10rpx;
  border-radius: var(--radius-pill);
}

.sku-section__spec {
  font-size: var(--font-body-large);
  color: var(--color-text-primary);

  .sku-section__item--active & {
    color: var(--color-brand-primary);
  }

  .sku-section__item--disabled & {
    color: var(--color-text-tertiary);
  }
}

.sku-section__price {
  font-size: var(--font-body-large);
  font-weight: 700;
  color: var(--color-price);
}

.sku-section__price--activity {
  color: var(--color-error);
}

.sku-section__price--original {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  text-decoration: line-through;
  margin-left: 4rpx;
}

.sku-section__price--disabled {
  color: var(--color-text-tertiary);
}

.sku-section__sold-out {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  padding: 2rpx 10rpx;
  border-radius: var(--radius-sm);
  background: var(--color-text-tertiary);
  color: var(--color-bg-surface);
  font-size: var(--font-micro);
  transform: scale(0.9);
}

// ======================== 商品详情 ========================
.detail-section {
  margin: var(--space-sm) var(--space-sm) 0;
  padding: var(--space-lg);
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  box-shadow: var(--shadow-card);
}

.detail-section__title {
  display: block;
  font-size: var(--font-title-medium);
  font-weight: 700;
  color: var(--color-text-primary);
  padding-bottom: var(--space-md);
  margin-bottom: var(--space-md);
  border-bottom: 2rpx solid var(--color-border-default);
}

.detail-section__content {
  font-size: var(--font-body-large);
  color: var(--color-text-primary);
  line-height: var(--lh-relaxed);
}

// ======================== 底部操作栏 ========================
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-cart-bar);
  display: flex;
  align-items: center;
  padding: var(--space-sm) var(--space-lg);
  padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom));
  background: var(--color-bg-surface);
  box-shadow: var(--shadow-popup);
}

.bottom-bar__spacer {
  height: 120rpx;
}

.bottom-bar__tools {
  display: flex;
  gap: var(--space-lg);
}

.bottom-bar__tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: var(--font-micro);
  color: var(--color-text-secondary);
  min-width: var(--tap-target-min);

  &:active {
    opacity: 0.7;
  }
}

.bottom-bar__tool-icon {
  font-size: 40rpx;
  margin-bottom: 4rpx;
}

.bottom-bar__actions {
  flex: 1;
  display: flex;
  gap: var(--space-sm);
  margin-left: var(--space-lg);
}

.bottom-bar__btn {
  margin: 0;
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: var(--radius-pill);
  border: none;
  font-size: var(--font-body-large);
  font-weight: 700;
  text-align: center;
}

.bottom-bar__btn::after {
  border: none;
}

.bottom-bar__btn--primary {
  background: var(--color-brand-primary);
  color: var(--color-bg-surface);
}

.bottom-bar__btn--secondary {
  background: var(--color-bg-surface);
  color: var(--color-brand-primary);
  border: 2rpx solid var(--color-brand-primary);
}

.bottom-bar__btn--cart {
  background: var(--color-func-warning);
  color: var(--color-bg-surface);
}

.bottom-bar__btn--service {
  background: var(--color-func-link);
  color: var(--color-bg-surface);
}

.bottom-bar__btn--full {
  flex: 1 1 100%;
}

.bottom-bar__btn--disabled {
  opacity: 0.5;
}
</style>
