import type { components, operations } from '@libs/common-types';
import { request } from '@/service/request';

/**
 * 积分后台接口集合。
 * 规则/任务属于运营配置，账户调整和资产批次属于积分资产高风险链路；
 * 本文件只做请求封装，金额/积分增减、冻结、消费、退款分摊口径以 backend service 为事实源。
 */

export type PointsLot = components['schemas']['PointsLotVo'];
export type PointsFreezeAllocation = components['schemas']['PointsFreezeAllocationVo'];
export type PointsConsumeAllocation = components['schemas']['PointsConsumeAllocationVo'];
export type PointsDebt = components['schemas']['PointsDebtVo'];
export type PointsRefundAllocation = components['schemas']['PointsRefundAllocationVo'];
export type PointsLotQuery = NonNullable<operations['PointsAccountAdminController_getLots']['parameters']['query']>;
export type PointsFreezeAllocationQuery = NonNullable<
  operations['PointsAccountAdminController_getFreezeAllocations']['parameters']['query']
>;
export type PointsConsumeAllocationQuery = NonNullable<
  operations['PointsAccountAdminController_getConsumeAllocations']['parameters']['query']
>;
export type PointsRefundAllocationQuery = NonNullable<
  operations['PointsAccountAdminController_getRefundAllocations']['parameters']['query']
>;
export type PointsDebtQuery = NonNullable<operations['PointsAccountAdminController_getDebts']['parameters']['query']>;

/** 查询积分规则配置，对应 PointsRuleController.getRules。 */
export function fetchGetPointsRuleConfig() {
  return request<Api.Marketing.PointsRule>({
    url: '/admin/marketing/points/rules',
    method: 'get',
  });
}

/** 更新积分规则配置，会影响后续发放与防套利判断。 */
export function fetchUpdatePointsRuleConfig(data: Api.Marketing.PointsRuleUpdate) {
  return request<Api.Marketing.PointsRule>({
    url: '/admin/marketing/points/rules',
    method: 'put',
    data,
  });
}

/** 查询积分任务列表，对应 PointsTaskAdminController.findAll。 */
export function fetchGetPointTaskList(params?: Api.Marketing.PointTaskSearchParams) {
  return request<Api.Marketing.PointTaskList>({
    url: '/admin/marketing/points/tasks',
    method: 'get',
    params,
  });
}

/** 创建积分任务，任务完成与奖励发放的幂等由后端任务服务控制。 */
export function fetchCreatePointTask(data: Api.Marketing.PointTaskCreate) {
  return request<Api.Marketing.PointTask>({
    url: '/admin/marketing/points/tasks',
    method: 'post',
    data,
  });
}

/** 更新积分任务配置；状态、奖励和完成条件变更需与客户端任务展示保持一致。 */
export function fetchUpdatePointTask(id: string, data: Api.Marketing.PointTaskUpdate) {
  return request<Api.Marketing.PointTask>({
    url: `/admin/marketing/points/tasks/${id}`,
    method: 'put',
    data,
  });
}

/** 删除积分任务配置入口，不代表清理历史完成记录。 */
export function fetchDeletePointTask(id: string) {
  return request({
    url: `/admin/marketing/points/tasks/${id}`,
    method: 'delete',
  });
}

/** 查询积分账户列表，只读展示会员积分余额。 */
export function fetchGetPointsAccounts(params?: { pageNum?: number; pageSize?: number; memberId?: string }) {
  return request<Common.PaginatingQueryRecord<Api.Marketing.PointsAccount>>({
    url: '/admin/marketing/points/accounts',
    method: 'get',
    params,
  });
}

/** 管理端人工调积分是高风险写入口；前端只提交调整意图，审计、余额和批次入账由后端收口。 */
export function fetchAdjustPoints(data: { memberId: string; amount: number; type: string; remark?: string }) {
  return request({
    url: '/admin/marketing/points/adjust',
    method: 'post',
    data,
  });
}

/** 查询积分交易明细，只读审计积分来源、消费、退款和人工调整事实。 */
export function fetchGetPointsTransactions(params?: Api.Marketing.PointsTransactionSearchParams) {
  return request<Common.PaginatingQueryRecord<Api.Marketing.PointsTransaction>>({
    url: '/admin/marketing/points/transactions',
    method: 'get',
    params,
  });
}

/** 查询积分资产批次，只读展示批次余额、有效期和冻结状态。 */
export function fetchGetPointsLots(params?: PointsLotQuery) {
  return request<Common.PaginatingQueryRecord<PointsLot>>({
    url: '/admin/marketing/points/lots',
    method: 'get',
    params,
  });
}

/** 查询冻结分摊，只读解释订单/履约占用积分的批次来源。 */
export function fetchGetPointsFreezeAllocations(params?: PointsFreezeAllocationQuery) {
  return request<Common.PaginatingQueryRecord<PointsFreezeAllocation>>({
    url: '/admin/marketing/points/freeze-allocations',
    method: 'get',
    params,
  });
}

/** 查询消费分摊，只读解释实际扣减了哪些积分批次。 */
export function fetchGetPointsConsumeAllocations(params?: PointsConsumeAllocationQuery) {
  return request<Common.PaginatingQueryRecord<PointsConsumeAllocation>>({
    url: '/admin/marketing/points/consume-allocations',
    method: 'get',
    params,
  });
}

/** 查询退款分摊，只读解释退款返还积分与原消费批次的关系。 */
export function fetchGetPointsRefundAllocations(params?: PointsRefundAllocationQuery) {
  return request<Common.PaginatingQueryRecord<PointsRefundAllocation>>({
    url: '/admin/marketing/points/refund-allocations',
    method: 'get',
    params,
  });
}

/** 查询积分欠账/追扣风险，只读展示退款或撤销后待补偿的风险记录。 */
export function fetchGetPointsDebts(params?: PointsDebtQuery) {
  return request<Common.PaginatingQueryRecord<PointsDebt>>({
    url: '/admin/marketing/points/debts',
    method: 'get',
    params,
  });
}

/** 查询积分发放统计。 */
export function fetchGetPointsEarnStatistics(params?: { startTime?: string; endTime?: string }) {
  return request<Api.Marketing.PointsEarnStatistics>({
    url: '/admin/marketing/points/statistics/earn',
    method: 'get',
    params,
  });
}

/** 查询积分使用统计。 */
export function fetchGetPointsUseStatistics(params?: { startTime?: string; endTime?: string }) {
  return request<Api.Marketing.PointsUseStatistics>({
    url: '/admin/marketing/points/statistics/use',
    method: 'get',
    params,
  });
}

/** 查询积分余额统计。 */
export function fetchGetPointsBalanceStatistics() {
  return request<Api.Marketing.PointsBalanceStatistics>({
    url: '/admin/marketing/points/statistics/balance',
    method: 'get',
  });
}

/** 查询积分过期统计。 */
export function fetchGetPointsExpireStatistics(params?: { startTime?: string; endTime?: string }) {
  return request({
    url: '/admin/marketing/points/statistics/expire',
    method: 'get',
    params,
  });
}

/** 查询积分排行榜，limit 只控制展示条数。 */
export function fetchGetPointsRanking(params?: { limit?: number }) {
  return request<{ ranking: Api.Marketing.PointsRankingItem[] }>({
    url: '/admin/marketing/points/ranking',
    method: 'get',
    params,
  });
}

/** 导出积分交易明细，筛选口径应与交易列表保持一致。 */
export function fetchExportPointsTransactions(params?: {
  memberId?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
}) {
  return request<Blob, 'blob'>({
    url: '/admin/marketing/points/export',
    method: 'get',
    params,
    responseType: 'blob',
  });
}
