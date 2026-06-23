// quality-gate allow-source-string-test
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('activity center copy consistency', () => {
  it('list page wires search/metrics/table modules and drawer i18n actions', () => {
    const content = readSource('./list/index.vue');

    expect(content).toContain('ActivitySearch');
    expect(content).toContain('ActivityMetricsPanel');
    expect(content).toContain('ActivityTableCard');
    expect(content).toContain("$t('common.save')");
    expect(content).toContain("$t('common.cancel')");
  });

  it('search module uses common search/reset semantics', () => {
    const content = readSource('./modules/activity-search.vue');

    expect(content).toContain("$t('common.search')");
    expect(content).toContain("$t('common.reset')");
    expect(content).toContain('活动名称或 ID');
    expect(content).toContain('负责人账号');
  });

  it('detail page uses Chinese operator copy', () => {
    const content = readSource('./detail/index.vue');

    expect(content).toContain('玩法规则');
    expect(content).toContain('活动基础信息已保存');
    expect(content).toContain('请输入门店编号');
    expect(content).toContain('活动商品已新增');
    expect(content).toContain('活动商品已删除');
  });

  it('detail modules use common save/cancel semantics and Chinese labels', () => {
    const header = readSource('./modules/activity-detail-header.vue');
    const itemDrawer = readSource('./modules/activity-item-drawer.vue');
    const publishPanel = readSource('./modules/activity-publish-panel.vue');
    const storeCard = readSource('./modules/activity-store-card.vue');

    expect(header).toContain("$t('common.save')");
    expect(header).toContain('请选择活动');
    expect(header).toContain('发布');

    expect(itemDrawer).toContain("$t('common.add')");
    expect(itemDrawer).toContain("$t('common.edit')");
    expect(itemDrawer).toContain("$t('common.save')");
    expect(itemDrawer).toContain("$t('common.cancel')");
    expect(itemDrawer).toContain('商品/规格');
    expect(itemDrawer).toContain('点击选择商品（可选规格）');
    expect(itemDrawer).toContain('商品名称');
    expect(itemDrawer).toContain('规格名称');

    expect(publishPanel).toContain('发布检查');
    expect(publishPanel).toContain('当前状态');
    expect(publishPanel).toContain('关联场景');
    expect(publishPanel).toContain('预检失败');
    expect(publishPanel).toContain('预检通过');

    expect(storeCard).toContain('门店参与');
    expect(storeCard).toContain('批量绑定');
    expect(storeCard).toContain('批量解绑');
  });
});
