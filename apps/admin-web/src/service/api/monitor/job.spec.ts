// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import { fetchChangeJobStatus, fetchGetJobList, fetchSyncJobDefinitions, fetchUpdateJob } from './job';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Monitor Job API', () => {
  it('fetchGetJobList should GET /monitor/job/list', async () => {
    const params: Api.Monitor.JobSearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetJobList(params);

    expect(res.data).toMatchObject({ url: '/monitor/job/list', method: 'get', params });
  });

  it('fetchUpdateJob should PUT /monitor/job', async () => {
    const data: Api.Monitor.JobOperateParams = { jobId: 1, status: '0', remark: 'ok' };
    const res = await fetchUpdateJob(data);

    expect(res.data).toMatchObject({ url: '/monitor/job', method: 'put', data });
  });

  it('fetchChangeJobStatus should PUT /monitor/job/changeStatus', async () => {
    const res = await fetchChangeJobStatus(1, '1');

    expect(res.data).toMatchObject({
      url: '/monitor/job/changeStatus',
      method: 'put',
      data: { jobId: 1, status: '1' },
    });
  });

  it('fetchSyncJobDefinitions should POST /monitor/job/sync-definitions', async () => {
    const res = await fetchSyncJobDefinitions();

    expect(res.data).toMatchObject({ url: '/monitor/job/sync-definitions', method: 'post' });
  });
});
