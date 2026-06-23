import { alignPmsAttrTemplateAndAttributeSequences } from './pms-attr-sequence.util';

describe('alignPmsAttrTemplateAndAttributeSequences', () => {
  it('对两张表各执行一次 setval', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const prisma = { $executeRawUnsafe: execute } as Pick<import('src/prisma/prisma.service').PrismaService, '$executeRawUnsafe'>;

    await alignPmsAttrTemplateAndAttributeSequences(
      prisma as import('src/prisma/prisma.service').PrismaService,
    );

    expect(execute).toHaveBeenCalledTimes(2);
    expect(String(execute.mock.calls[0][0])).toContain('pms_attr_template');
    expect(String(execute.mock.calls[1][0])).toContain('pms_attribute');
  });
});
