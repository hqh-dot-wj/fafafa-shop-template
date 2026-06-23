import { request } from '@/service/request';

/**
 * 营销活动中心接口，对应 backend CampaignAdminController。
 * 后端路由前缀为 /admin/marketing/campaigns，前端保留 activity 命名是为了贴近页面语义。
 */
export type ActivityJson = Record<string, unknown>;
export type DistributionGrowth = Api.Marketing.DistributionGrowth;

type BaseActivity = Api.Marketing.Activity;
type BaseActivityItem = Api.Marketing.ActivityItem;
type BaseActivityCalendar = Api.Marketing.ActivityCalendar;

export type ActivityStatus = Api.Marketing.ActivityStatus;

export type ActivityListParams = Api.Marketing.ActivityListParams;
export type ActivityCalendarQuery = Api.Marketing.ActivityCalendarQuery;
export type ActivityDashboardQuery = Api.Marketing.ActivityDashboardQuery;

/**
 * 后端 ActivityVo 中 triggerCondition/rules/rewards 是 JSON 配置。
 * 页面需要强类型地读写动态表单，因此在这里收敛为 ActivityJson，而不是把整行对象直接提交。
 */
export interface MarketingActivity extends Omit<
  BaseActivity,
  'triggerCondition' | 'rules' | 'rewards' | 'distributionGrowth'
> {
  triggerCondition: ActivityJson;
  rules: ActivityJson;
  rewards: ActivityJson;
  distributionGrowth?: DistributionGrowth | null;
}

export type ActivityListData = Omit<Api.Marketing.ActivityList, 'rows'> & {
  rows: MarketingActivity[];
};

export type ActivityCalendarDay = Omit<BaseActivityCalendar['days'][number], 'items'> & {
  items: MarketingActivity[];
};

export type ActivityCalendarConflict = BaseActivityCalendar['conflicts'][number];

export type ActivityCalendarData = Omit<BaseActivityCalendar, 'days' | 'conflicts'> & {
  days: ActivityCalendarDay[];
  conflicts: ActivityCalendarConflict[];
};

export type ActivityDashboardData = Api.Marketing.ActivityDashboard;
export type ActivityDashboardSummary = Api.Marketing.ActivityDashboard['summary'];
export type ActivityDashboardTrend = Api.Marketing.ActivityDashboard['trend'][number];

/** 创建与更新 DTO 的必填性不同，前端分开构造提交体以对齐 backend CreateActivityDto / UpdateActivityDto。 */
export interface SaveActivityPayload extends Omit<
  Api.Marketing.ActivityCreate,
  'triggerCondition' | 'rules' | 'rewards' | 'distributionGrowth'
> {
  triggerCondition: ActivityJson;
  rules: ActivityJson;
  rewards: ActivityJson;
  distributionGrowth?: DistributionGrowth;
}

export interface UpdateActivityPayload extends Omit<
  Api.Marketing.ActivityUpdate,
  'triggerCondition' | 'rules' | 'rewards' | 'distributionGrowth'
> {
  triggerCondition?: ActivityJson;
  rules?: ActivityJson;
  rewards?: ActivityJson;
  distributionGrowth?: DistributionGrowth;
}

export interface MarketingActivityItem extends Omit<BaseActivityItem, 'config' | 'ext'> {
  config: ActivityJson;
  ext: ActivityJson;
}

export interface SaveActivityItemPayload extends Omit<Api.Marketing.ActivityItemCreate, 'config' | 'ext'> {
  config?: ActivityJson;
  ext?: ActivityJson;
}

export interface UpdateActivityItemPayload extends Omit<Api.Marketing.ActivityItemUpdate, 'config' | 'ext'> {
  config?: ActivityJson;
  ext?: ActivityJson;
}

export type ActivityListResponse = ActivityListData;
export type ActivityCalendarResponse = ActivityCalendarData;
export type ActivityDashboardResponse = ActivityDashboardData;
export type ActivityDetailResponse = MarketingActivity;
export type CreateActivityRequest = SaveActivityPayload;
export type UpdateActivityRequest = UpdateActivityPayload;
export type DeleteActivityResponse = null;
export type ActivityItemListResponse = MarketingActivityItem[];
export type CreateActivityItemRequest = SaveActivityItemPayload;
export type UpdateActivityItemRequest = UpdateActivityItemPayload;
export type DeleteActivityItemResponse = null;

export function fetchActivityList(params: ActivityListParams = {}) {
  return request<ActivityListResponse>({
    url: '/admin/marketing/campaigns/list',
    method: 'get',
    params,
  });
}

export function fetchActivityCalendar(params: ActivityCalendarQuery = {}) {
  return request<ActivityCalendarResponse>({
    url: '/admin/marketing/campaigns/calendar',
    method: 'get',
    params,
  });
}

export function fetchActivityDashboard(params: ActivityDashboardQuery = {}) {
  return request<ActivityDashboardResponse>({
    url: '/admin/marketing/campaigns/dashboard',
    method: 'get',
    params,
  });
}

export function fetchCreateActivity(data: CreateActivityRequest) {
  return request<ActivityDetailResponse>({
    url: '/admin/marketing/campaigns',
    method: 'post',
    data,
  });
}

export function fetchActivityDetail(activityId: string) {
  return request<ActivityDetailResponse>({
    url: `/admin/marketing/campaigns/detail/${activityId}`,
    method: 'get',
  });
}

export function fetchUpdateActivity(activityId: string, data: UpdateActivityRequest) {
  return request<ActivityDetailResponse>({
    url: `/admin/marketing/campaigns/detail/${activityId}`,
    method: 'put',
    data,
  });
}

export function fetchPublishActivity(activityId: string) {
  return request<ActivityDetailResponse>({
    url: `/admin/marketing/campaigns/${activityId}/publish`,
    method: 'post',
  });
}

export function fetchPauseActivity(activityId: string) {
  return request<ActivityDetailResponse>({
    url: `/admin/marketing/campaigns/${activityId}/pause`,
    method: 'post',
  });
}

export function fetchArchiveActivity(activityId: string) {
  return request<ActivityDetailResponse>({
    url: `/admin/marketing/campaigns/${activityId}/archive`,
    method: 'post',
  });
}

export function fetchDeleteActivity(activityId: string) {
  return request<DeleteActivityResponse>({
    url: `/admin/marketing/campaigns/detail/${activityId}`,
    method: 'delete',
  });
}

export function fetchActivityItemList(activityId: string) {
  return request<ActivityItemListResponse>({
    url: `/admin/marketing/campaigns/${activityId}/items`,
    method: 'get',
  });
}

export function fetchCreateActivityItem(activityId: string, data: CreateActivityItemRequest) {
  return request<MarketingActivityItem>({
    url: `/admin/marketing/campaigns/${activityId}/items`,
    method: 'post',
    data,
  });
}

export function fetchUpdateActivityItem(activityId: string, activityItemId: string, data: UpdateActivityItemRequest) {
  return request<MarketingActivityItem>({
    url: `/admin/marketing/campaigns/${activityId}/items/${activityItemId}`,
    method: 'put',
    data,
  });
}

export function fetchDeleteActivityItem(activityId: string, activityItemId: string) {
  return request<DeleteActivityItemResponse>({
    url: `/admin/marketing/campaigns/${activityId}/items/${activityItemId}`,
    method: 'delete',
  });
}
