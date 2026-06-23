// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchAdjustPoints,
  fetchCreatePointTask,
  fetchDeletePointTask,
  fetchExportPointsTransactions,
  fetchGetPointTaskList,
  fetchGetPointsAccounts,
  fetchGetPointsBalanceStatistics,
  fetchGetPointsConsumeAllocations,
  fetchGetPointsDebts,
  fetchGetPointsEarnStatistics,
  fetchGetPointsExpireStatistics,
  fetchGetPointsFreezeAllocations,
  fetchGetPointsLots,
  fetchGetPointsRanking,
  fetchGetPointsRefundAllocations,
  fetchGetPointsRuleConfig,
  fetchGetPointsTransactions,
  fetchGetPointsUseStatistics,
  fetchUpdatePointTask,
  fetchUpdatePointsRuleConfig,
} from './points';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Marketing Points API', () => {
  it('fetchGetPointsRuleConfig should GET /admin/marketing/points/rules', async () => {
    const res = await fetchGetPointsRuleConfig();
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/rules', method: 'get' });
  });

  it('fetchUpdatePointsRuleConfig should PUT /admin/marketing/points/rules', async () => {
    const data: Api.Marketing.PointsRuleUpdate = { orderPointsRatio: 10, pointsValidityDays: 365 };
    const res = await fetchUpdatePointsRuleConfig(data);
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/rules', method: 'put', data });
  });

  it('fetchGetPointTaskList should GET /admin/marketing/points/tasks', async () => {
    const params: Api.Marketing.PointTaskSearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetPointTaskList(params);
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/tasks', method: 'get', params });
  });

  it('fetchCreatePointTask should POST /admin/marketing/points/tasks', async () => {
    const data: Api.Marketing.PointTaskCreate = {
      taskKey: 'SIGNIN_DAILY',
      taskName: '每日签到',
      pointsReward: 10,
    };
    const res = await fetchCreatePointTask(data);
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/tasks', method: 'post', data });
  });

  it('fetchUpdatePointTask should PUT /admin/marketing/points/tasks/:id', async () => {
    const data: Api.Marketing.PointTaskUpdate = { pointsReward: 20 };
    const res = await fetchUpdatePointTask('task-1', data);
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/tasks/task-1', method: 'put', data });
  });

  it('fetchDeletePointTask should DELETE /admin/marketing/points/tasks/:id', async () => {
    const res = await fetchDeletePointTask('task-1');
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/tasks/task-1', method: 'delete' });
  });

  it('fetchGetPointsAccounts should GET /admin/marketing/points/accounts', async () => {
    const params = { pageNum: 1, pageSize: 10, memberId: 'm1' };
    const res = await fetchGetPointsAccounts(params);
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/accounts', method: 'get', params });
  });

  it('fetchAdjustPoints should POST /admin/marketing/points/adjust', async () => {
    const data = { memberId: 'm1', amount: 100, type: 'ADD', remark: '补偿' };
    const res = await fetchAdjustPoints(data);
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/adjust', method: 'post', data });
  });

  it('fetchGetPointsTransactions should GET /admin/marketing/points/transactions', async () => {
    const res = await fetchGetPointsTransactions();
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/transactions', method: 'get' });
  });

  it('fetchGetPointsLots should GET /admin/marketing/points/lots', async () => {
    const params = { pageNum: 1, pageSize: 10, memberId: 'm1', status: 'ACTIVE' as const };
    const res = await fetchGetPointsLots(params);
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/lots', method: 'get', params });
  });

  it('fetchGetPointsFreezeAllocations should GET /admin/marketing/points/freeze-allocations', async () => {
    const params = { pageNum: 1, pageSize: 10, relatedId: 'order-1' };
    const res = await fetchGetPointsFreezeAllocations(params);
    expect(res.data).toMatchObject({
      url: '/admin/marketing/points/freeze-allocations',
      method: 'get',
      params,
    });
  });

  it('fetchGetPointsConsumeAllocations should GET /admin/marketing/points/consume-allocations', async () => {
    const params = { pageNum: 1, pageSize: 10, relatedId: 'order-1' };
    const res = await fetchGetPointsConsumeAllocations(params);
    expect(res.data).toMatchObject({
      url: '/admin/marketing/points/consume-allocations',
      method: 'get',
      params,
    });
  });

  it('fetchGetPointsRefundAllocations should GET /admin/marketing/points/refund-allocations', async () => {
    const params = { pageNum: 1, pageSize: 10, relatedId: 'order-1' };
    const res = await fetchGetPointsRefundAllocations(params);
    expect(res.data).toMatchObject({
      url: '/admin/marketing/points/refund-allocations',
      method: 'get',
      params,
    });
  });

  it('fetchGetPointsDebts should GET /admin/marketing/points/debts', async () => {
    const params = { pageNum: 1, pageSize: 10, relatedId: 'order-1', status: 'OPEN' as const };
    const res = await fetchGetPointsDebts(params);
    expect(res.data).toMatchObject({
      url: '/admin/marketing/points/debts',
      method: 'get',
      params,
    });
  });

  it('fetchGetPointsEarnStatistics should GET /admin/marketing/points/statistics/earn', async () => {
    const params = { startTime: '2026-01-01', endTime: '2026-01-31' };
    const res = await fetchGetPointsEarnStatistics(params);
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/statistics/earn', method: 'get', params });
  });

  it('fetchGetPointsUseStatistics should GET /admin/marketing/points/statistics/use', async () => {
    const res = await fetchGetPointsUseStatistics();
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/statistics/use', method: 'get' });
  });

  it('fetchGetPointsBalanceStatistics should GET /admin/marketing/points/statistics/balance', async () => {
    const res = await fetchGetPointsBalanceStatistics();
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/statistics/balance', method: 'get' });
  });

  it('fetchGetPointsExpireStatistics should GET /admin/marketing/points/statistics/expire', async () => {
    const res = await fetchGetPointsExpireStatistics();
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/statistics/expire', method: 'get' });
  });

  it('fetchGetPointsRanking should GET /admin/marketing/points/ranking', async () => {
    const res = await fetchGetPointsRanking({ limit: 10 });
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/ranking', method: 'get', params: { limit: 10 } });
  });

  it('fetchExportPointsTransactions should GET /admin/marketing/points/export with blob responseType', async () => {
    const res = await fetchExportPointsTransactions({ memberId: 'm1' });
    expect(res.data).toMatchObject({
      url: '/admin/marketing/points/export',
      method: 'get',
      responseType: 'blob',
    });
  });
});
