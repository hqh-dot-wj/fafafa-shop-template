import { describe, expect, it, vi } from 'vitest';
import {
  buildMarketingTemplateNameByCode,
  fetchAllMarketingPlayTemplates,
  fetchCreateTemplate,
  fetchDeleteTemplate,
  fetchGetTemplateList,
  fetchUpdateTemplate,
} from './template';

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('@/service/request', () => ({
  request: requestMock,
}));

function mockTemplatePage(rows: Api.Marketing.PlayTemplate[], total = rows.length) {
  return {
    data: {
      rows,
      total,
    } as Api.Marketing.PlayTemplateList,
    error: null,
  };
}

describe('Marketing Template API', () => {
  it('模板编码映射应优先使用修剪后的名称，空名称回退为编码', () => {
    const map = buildMarketingTemplateNameByCode([
      { code: 'A', name: '  名称A  ' } as Api.Marketing.PlayTemplate,
      { code: 'B', name: '   ' } as Api.Marketing.PlayTemplate,
      { code: 'C', name: '' } as Api.Marketing.PlayTemplate,
    ]);

    expect(map).toEqual({
      A: '名称A',
      B: 'B',
      C: 'C',
    });
  });

  it('分页聚合应持续拉取模板并合并为完整列表', async () => {
    const firstPageRows = Array.from({ length: 100 }, (_, index) => ({
      code: `TPL_${index + 1}`,
      name: index === 0 ? ' 模板A ' : `模板${index + 1}`,
    })) as Api.Marketing.PlayTemplate[];

    requestMock.mockImplementation(({ params }: { params?: Api.Marketing.PlayTemplateSearchParams }) => {
      if (params?.pageNum === 1) {
        return Promise.resolve(
          mockTemplatePage(
            firstPageRows,
            101,
          ),
        );
      }

      return Promise.resolve(
        mockTemplatePage(
          [{ code: 'TPL_101', name: '模板101' }] as Api.Marketing.PlayTemplate[],
          101,
        ),
      );
    });

    const templates = await fetchAllMarketingPlayTemplates();

    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/marketing/template/list',
        method: 'get',
        params: { pageNum: 1, pageSize: 100 },
      }),
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/marketing/template/list',
        method: 'get',
        params: { pageNum: 2, pageSize: 100 },
      }),
    );
    expect(templates).toHaveLength(101);

    const templateNameMap = buildMarketingTemplateNameByCode(templates);
    expect(templateNameMap).toMatchObject({
      TPL_1: '模板A',
      TPL_2: '模板2',
      TPL_101: '模板101',
    });
  });

  it('模板创建写入时应清洗多余字段并修剪可选组件标识', async () => {
    requestMock.mockResolvedValue({ data: null, error: null });

    await fetchCreateTemplate({
      name: '满减模板',
      unitName: '件',
      ruleSchema: { fields: [] },
      uiComponentId: '  promotion-detail  ',
      code: 'IGNORED_CODE',
      productId: 'prod_001',
      skuId: 'sku_001',
      productName: '测试商品',
    } as any);

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/marketing/template',
        method: 'post',
        data: {
          name: '满减模板',
          unitName: '件',
          ruleSchema: { fields: [] },
          uiComponentId: 'promotion-detail',
        },
      }),
    );
  });

  it('模板更新写入时应清洗多余字段并保留业务正文', async () => {
    requestMock.mockResolvedValue({ data: null, error: null });

    await fetchUpdateTemplate(
      'tpl-1',
      {
        name: '满减模板V2',
        unitName: '件',
        ruleSchema: {
          fields: [{ key: 'discountPrice', label: '优惠价', type: 'number', required: true }],
        },
        uiComponentId: 'promotion-detail-v2',
        code: 'IGNORED_CODE',
        productId: 'prod_002',
        skuId: 'sku_002',
        productName: '测试商品2',
      } as any,
    );

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/marketing/template/tpl-1',
        method: 'put',
        data: {
          name: '满减模板V2',
          unitName: '件',
          ruleSchema: {
            fields: [{ key: 'discountPrice', label: '优惠价', type: 'number', required: true }],
          },
          uiComponentId: 'promotion-detail-v2',
        },
      }),
    );
  });

  it('模板删除应直接指向目标资源', async () => {
    requestMock.mockResolvedValue({ data: null, error: null });

    await fetchDeleteTemplate('tpl-1');

    expect(requestMock).toHaveBeenCalledWith({
      url: '/marketing/template/tpl-1',
      method: 'delete',
    });
  });

  it('列表接口应兼容显式分页参数', async () => {
    requestMock.mockResolvedValue(mockTemplatePage([]));

    await fetchGetTemplateList({ pageNum: 2, pageSize: 500 });

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/marketing/template/list',
        method: 'get',
        params: { pageNum: 2, pageSize: 100 },
      }),
    );
  });
});
