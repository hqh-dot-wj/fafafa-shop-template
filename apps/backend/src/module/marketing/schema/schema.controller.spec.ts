import { Test } from '@nestjs/testing';
import { Result } from 'src/common/response';
import { MarketingSchemaController } from './schema.controller';
import { MarketingSchemaService } from './schema.service';

describe('MarketingSchemaController', () => {
  let controller: MarketingSchemaController;
  let service: jest.Mocked<
    Pick<MarketingSchemaService, 'getPolicySchema' | 'getPlayRuleSchema' | 'getSceneTemplateSchema'>
  >;

  beforeEach(async () => {
    service = {
      getPolicySchema: jest.fn(),
      getPlayRuleSchema: jest.fn(),
      getSceneTemplateSchema: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MarketingSchemaController],
      providers: [{ provide: MarketingSchemaService, useValue: service }],
    }).compile();

    controller = moduleRef.get(MarketingSchemaController);
  });

  it('returns policy schema envelope', async () => {
    const schema = { type: 'object', properties: { discountAmount: { type: 'string' } } } as never;
    service.getPolicySchema.mockReturnValue(schema);

    const result = await controller.getPolicySchema('FIRST_ORDER');

    expect(service.getPolicySchema).toHaveBeenCalledWith('FIRST_ORDER');
    expect(result).toEqual(Result.ok(schema));
  });

  it('returns play rule schema envelope', async () => {
    const schema = { type: 'object', properties: { price: { type: 'number' } } } as never;
    service.getPlayRuleSchema.mockResolvedValue(schema);

    const result = await controller.getPlayRuleSchema('COURSE_GROUP_BUY');

    expect(service.getPlayRuleSchema).toHaveBeenCalledWith('COURSE_GROUP_BUY');
    expect(result).toEqual(Result.ok(schema));
  });

  it('returns scene template schema envelope', async () => {
    const schema = { type: 'object', properties: { modules: { type: 'object' } } } as never;
    service.getSceneTemplateSchema.mockResolvedValue(schema);

    const result = await controller.getSceneTemplateSchema('NEW_CUSTOMER_ZONE');

    expect(service.getSceneTemplateSchema).toHaveBeenCalledWith('NEW_CUSTOMER_ZONE');
    expect(result).toEqual(Result.ok(schema));
  });
});
