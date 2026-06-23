import { DiscoveryService } from '@nestjs/core';
import { MarketingStockMode, MktCampaignKind, PlayDefinition } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PlayDispatcher } from './play.dispatcher';

function makeDefinition(overrides: Partial<PlayDefinition>): PlayDefinition {
  const now = new Date('2026-05-17T00:00:00.000Z');
  return {
    id: 'pd-1',
    code: 'FLASH_SALE',
    name: '限时秒杀',
    hasInstance: true,
    hasState: true,
    canFail: true,
    canParallel: true,
    defaultStockMode: MarketingStockMode.STRONG_LOCK,
    handlerClassName: 'FlashSaleService',
    description: null,
    isActive: true,
    createTime: now,
    updateTime: now,
    ...overrides,
  };
}

describe('PlayDispatcher', () => {
  const previousRetryMs = process.env.PLAY_DISPATCHER_BOOT_RETRY_MS;

  const flashHandler = {
    code: 'FLASH_SALE',
    checkEligibility: jest.fn(),
    resolvePrice: jest.fn(),
    applyRewards: jest.fn(),
    validateConfig: jest.fn(),
  };

  const policyHandler = {
    code: 'POLICY_EVAL',
    checkEligibility: jest.fn(),
    resolvePrice: jest.fn(),
    applyRewards: jest.fn(),
    validateConfig: jest.fn(),
  };

  class FlashSaleService {}
  class PolicyEvaluatorAdapter {}

  function createDispatcher(definitions: PlayDefinition[], providers: unknown[] = []) {
    const prisma = {
      playDefinition: {
        findMany: jest.fn().mockResolvedValue(definitions),
      },
    } as unknown as jest.Mocked<PrismaService>;
    const discovery = {
      getProviders: jest.fn(() => providers),
    } as unknown as jest.Mocked<DiscoveryService>;

    return {
      dispatcher: new PlayDispatcher(prisma, discovery),
      prisma,
      discovery,
    };
  }

  beforeEach(() => {
    process.env.PLAY_DISPATCHER_BOOT_RETRY_MS = '0';
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (previousRetryMs === undefined) {
      delete process.env.PLAY_DISPATCHER_BOOT_RETRY_MS;
    } else {
      process.env.PLAY_DISPATCHER_BOOT_RETRY_MS = previousRetryMs;
    }
  });

  it('boots from active play_definition rows and resolves handlers by code', async () => {
    const flashDefinition = makeDefinition({
      id: 'pd-flash',
      code: 'FLASH_SALE',
      handlerClassName: 'FlashSaleService',
    });
    const policyDefinition = makeDefinition({
      id: 'pd-policy',
      code: 'POLICY_EVAL',
      name: '政策活动评估',
      handlerClassName: 'PolicyEvaluatorAdapter',
      hasInstance: false,
      hasState: false,
      canFail: false,
      canParallel: false,
      defaultStockMode: MarketingStockMode.NONE,
    });

    const { dispatcher, prisma } = createDispatcher(
      [flashDefinition, policyDefinition],
      [
        { instance: flashHandler, metatype: FlashSaleService },
        { instance: policyHandler, metatype: PolicyEvaluatorAdapter },
      ],
    );

    await dispatcher.onModuleInit();

    expect(prisma.playDefinition.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    expect(dispatcher.resolve({ code: 'FLASH_SALE', rules: {} })).toBe(flashHandler);
    expect(
      dispatcher.resolve({
        type: 'FIRST_ORDER',
        kind: MktCampaignKind.POLICY,
        audienceJson: {},
        stagesJson: {},
        rightsJson: {},
        policyJson: {},
      }),
    ).toBe(policyHandler);
    expect(dispatcher.getAllPlayTypes().map((play) => play.code)).toEqual(['FLASH_SALE']);
  });

  it('fails fast when play_definition handlerClassName has no matching provider', async () => {
    const { dispatcher } = createDispatcher(
      [makeDefinition({ handlerClassName: 'MissingHandler' })],
      [{ instance: flashHandler, metatype: FlashSaleService }],
    );

    await expect(dispatcher.onModuleInit()).rejects.toThrow('[PlayDispatcher] CONFIG_MISMATCH');
  });

  it('fails boot after three unsuccessful play_definition reads', async () => {
    const prisma = {
      playDefinition: {
        findMany: jest.fn().mockRejectedValue(new Error('connection refused')),
      },
    } as unknown as jest.Mocked<PrismaService>;
    const discovery = {
      getProviders: jest.fn(() => []),
    } as unknown as jest.Mocked<DiscoveryService>;
    const dispatcher = new PlayDispatcher(prisma, discovery);

    await expect(dispatcher.onModuleInit()).rejects.toThrow('[PlayDispatcher] DB_UNREACHABLE');
    expect(prisma.playDefinition.findMany).toHaveBeenCalledTimes(3);
  });
});
