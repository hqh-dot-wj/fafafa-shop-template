// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchAiPromptCreate,
  fetchAiPromptDelete,
  fetchAiPromptDetail,
  fetchAiPromptList,
  fetchAiPromptUpdate,
  fetchAiPromptUpdateStatus,
} from './ai-prompt';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('ai-platform-prompt API', () => {
  it('fetchAiPromptList GET /ai-platform-prompt/list', async () => {
    const params = { pageNum: 1, pageSize: 10, platformCode: 'X', status: 1 };
    const res = await fetchAiPromptList(params);
    expect(res.data).toMatchObject({
      url: '/ai-platform-prompt/list',
      method: 'get',
      params: { pageNum: 1, pageSize: 10, platformCode: 'X', status: 1 },
    });
  });

  it('fetchAiPromptDetail GET /ai-platform-prompt/:id', async () => {
    const res = await fetchAiPromptDetail('abc');
    expect(res.data).toMatchObject({ url: '/ai-platform-prompt/abc', method: 'get' });
  });

  it('fetchAiPromptCreate POST /ai-platform-prompt', async () => {
    const body = {
      platformCode: 'P',
      platformName: 'N',
      systemPrompt: 's',
      outputSchema: { a: 'string' },
    };
    const res = await fetchAiPromptCreate(body);
    expect(res.data).toMatchObject({ url: '/ai-platform-prompt', method: 'post', data: body });
  });

  it('fetchAiPromptUpdate PUT /ai-platform-prompt/:id', async () => {
    const res = await fetchAiPromptUpdate('id1', { platformName: 'x' });
    expect(res.data).toMatchObject({
      url: '/ai-platform-prompt/id1',
      method: 'put',
      data: { platformName: 'x' },
    });
  });

  it('fetchAiPromptUpdateStatus PUT /ai-platform-prompt/:id/status', async () => {
    const res = await fetchAiPromptUpdateStatus('id1', 0);
    expect(res.data).toMatchObject({
      url: '/ai-platform-prompt/id1/status',
      method: 'put',
      data: { status: 0 },
    });
  });

  it('fetchAiPromptDelete DELETE /ai-platform-prompt/:id', async () => {
    const res = await fetchAiPromptDelete('id1');
    expect(res.data).toMatchObject({ url: '/ai-platform-prompt/id1', method: 'delete' });
  });
});
