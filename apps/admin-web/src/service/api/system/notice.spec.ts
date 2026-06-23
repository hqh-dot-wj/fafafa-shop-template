// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import { fetchBatchDeleteNotice, fetchCreateNotice, fetchGetNoticeList, fetchUpdateNotice } from './notice';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('System Notice API', () => {
  it('fetchGetNoticeList should GET /system/notice/list', async () => {
    const params: Api.System.NoticeSearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetNoticeList(params);
    expect(res.data).toMatchObject({ url: '/system/notice/list', method: 'get', params });
  });

  it('fetchCreateNotice should POST /system/notice', async () => {
    const data: Api.System.NoticeOperateParams = { noticeTitle: '公告标题', noticeContent: '内容' };
    const res = await fetchCreateNotice(data);
    expect(res.data).toMatchObject({ url: '/system/notice', method: 'post', data });
  });

  it('fetchUpdateNotice should PUT /system/notice', async () => {
    const data: Api.System.NoticeOperateParams = { noticeId: 1, noticeTitle: '改标题' };
    const res = await fetchUpdateNotice(data);
    expect(res.data).toMatchObject({ url: '/system/notice', method: 'put', data });
  });

  it('fetchBatchDeleteNotice should DELETE /system/notice/:ids (joined)', async () => {
    const res = await fetchBatchDeleteNotice([1, 2]);
    expect(res.data).toMatchObject({ url: '/system/notice/1,2', method: 'delete' });
  });
});
