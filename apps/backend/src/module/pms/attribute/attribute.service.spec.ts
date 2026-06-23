import { AttributeService } from './attribute.service';
import { AttributeRepository } from './attribute.repository';
import { TemplateRepository } from './template.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';

describe('AttributeService', () => {
  describe('findAll', () => {
    it('分页查询模板时包含 _count.attributes 供列表展示属性数量', async () => {
      const templateRepo = {
        findPage: jest.fn().mockResolvedValue({
          rows: [{ templateId: 1, name: '百货商品参数', _count: { attributes: 4 } }],
          total: 1,
          pageNum: 1,
          pageSize: 10,
          pages: 1,
        }),
      } as unknown as TemplateRepository;

      const service = new AttributeService(
        {} as PrismaService,
        {} as AttributeRepository,
        templateRepo,
      );

      const res = await service.findAll({ pageNum: 1, pageSize: 10 });

      expect(templateRepo.findPage).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            _count: { select: { attributes: true } },
          },
        }),
      );
      expect(res.data?.rows?.[0]).toMatchObject({
        templateId: 1,
        _count: { attributes: 4 },
      });
    });
  });

  describe('batchRemove', () => {
    it('应返回批量删除成功/失败统计', async () => {
      const service = new AttributeService(
        {} as PrismaService,
        {} as AttributeRepository,
        {} as TemplateRepository,
      );
      const spy = jest.spyOn(service, 'remove').mockImplementation(async (id: number) => {
        if (id === 2) {
          throw new BusinessException(ResponseCode.BUSINESS_ERROR, '该属性模板已被分类使用，无法删除');
        }
        return { code: ResponseCode.SUCCESS, msg: 'ok', data: null };
      });

      const result = await service.batchRemove([1, 2, 3]);
      expect(spy).toHaveBeenCalledTimes(3);
      expect(result.data?.successCount).toBe(2);
      expect(result.data?.failCount).toBe(1);
    });
  });
});
