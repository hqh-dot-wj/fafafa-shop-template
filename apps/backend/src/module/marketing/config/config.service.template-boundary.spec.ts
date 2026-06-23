import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { CommissionMode } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { PmsProductService } from 'src/module/pms/product.service';
import { PlayDispatcher } from '../play/play.dispatcher';
import { PlayTemplateRepository } from '../template/template.repository';
import { StorePlayConfigRepository } from './config.repository';
import { StorePlayConfigService } from './config.service';

async function expectBusinessMessage(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
    throw new Error('Expected business exception was not thrown');
  } catch (error) {
    const response =
      typeof (error as { getResponse?: unknown }).getResponse === 'function'
        ? (error as { getResponse: () => unknown }).getResponse()
        : null;
    expect(response).toEqual(expect.objectContaining({ msg: expect.stringContaining(message) }));
  }
}

describe('StorePlayConfigService template boundary', () => {
  let service: StorePlayConfigService;
  const repo = {
    findById: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  };
  const templateRepo = {
    findByCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorePlayConfigService,
        { provide: PrismaService, useValue: {} },
        { provide: StorePlayConfigRepository, useValue: repo },
        { provide: PlayTemplateRepository, useValue: templateRepo },
        { provide: PmsProductService, useValue: {} },
        { provide: PlayDispatcher, useValue: { resolve: jest.fn() } },
        getTenantHelperTestProvider(),
        { provide: EventEmitter2, useValue: { emit: jest.fn(), emitAsync: jest.fn() } },
      ],
    }).compile();

    service = module.get(StorePlayConfigService);
    jest.clearAllMocks();
  });

  it('rejects generated PT templates when creating store play config', async () => {
    await expectBusinessMessage(
      service.create(
        {
          serviceId: 'product-1',
          serviceType: 'VIRTUAL',
          templateCode: 'PT_FORM_ONLY',
          rules: {},
          commissionMode: CommissionMode.NONE,
        } as never,
        'tenant-1',
      ),
      '门店玩法配置只能选择可执行玩法模板',
    );

    expect(templateRepo.findByCode).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects generated PT templates when updating store play config templateCode', async () => {
    repo.findById.mockResolvedValue({
      id: 'config-1',
      templateCode: 'COURSE_GROUP_BUY',
      rules: {},
      rulesHistory: [],
    });

    await expectBusinessMessage(
      service.update('config-1', { templateCode: 'PT_FORM_ONLY' } as never, 'admin-1'),
      '门店玩法配置只能选择可执行玩法模板',
    );

    expect(repo.update).not.toHaveBeenCalled();
  });
});
