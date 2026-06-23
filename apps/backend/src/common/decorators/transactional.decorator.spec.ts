import 'reflect-metadata';
import { IsolationLevel, Propagation, TRANSACTIONAL_KEY, Transactional } from './transactional.decorator';

class MockClsRuntime {
  private readonly store = new Map<string, unknown>();

  get<T>(key?: string): T {
    if (!key) {
      return Object.fromEntries(this.store) as T;
    }
    return this.store.get(key) as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  run<T>(callback: () => T): T {
    return callback();
  }

  isActive(): boolean {
    return true;
  }
}

describe('Transactional Decorator', () => {
  type TxClient = { marker: string };
  const txClient = { marker: 'tx-client' } as TxClient;
  const existingTx = { marker: 'existing-tx' } as TxClient;

  let cls: MockClsRuntime;
  let prisma: { $transaction: jest.Mock };

  class DemoService {
    constructor(
      public readonly prismaHost: { $transaction: jest.Mock },
      public readonly cls: MockClsRuntime,
    ) {}

    get prisma() {
      return this.prismaHost;
    }

    @Transactional()
    async requiredMethod() {
      return this.cls.get<TxClient>('PRISMA_TX');
    }

    @Transactional({ propagation: Propagation.MANDATORY })
    async mandatoryMethod() {
      return 'ok';
    }

    @Transactional({ propagation: Propagation.NOT_SUPPORTED })
    async notSupportedMethod() {
      return this.cls.get<TxClient | undefined>('PRISMA_TX') ?? null;
    }

    @Transactional({
      isolationLevel: IsolationLevel.Serializable,
      timeout: 1234,
      noRollbackFor: [RangeError],
      rollbackFor: [TypeError],
    })
    async noRollbackMethod() {
      throw new RangeError('no rollback');
    }
  }

  class RepoOnlyService {
    constructor(
      public readonly repo: { prisma: { $transaction: jest.Mock } },
      public readonly cls: MockClsRuntime,
    ) {}

    @Transactional()
    async run() {
      return this.cls.get<TxClient>('PRISMA_TX');
    }
  }

  beforeEach(() => {
    cls = new MockClsRuntime();
    prisma = { $transaction: jest.fn(async (callback: (tx: TxClient) => Promise<unknown>) => await callback(txClient)) };
  });

  it('Given @Transactional method, When reading metadata, Then contains default options', () => {
    const metadata = Reflect.getMetadata(TRANSACTIONAL_KEY, DemoService.prototype.requiredMethod);
    expect(metadata).toEqual(
      expect.objectContaining({
        isolationLevel: IsolationLevel.ReadCommitted,
        propagation: Propagation.REQUIRED,
        readOnly: false,
      }),
    );
  });

  it('Given no active tx, When calling REQUIRED method, Then open transaction and inject PRISMA_TX', async () => {
    const service = new DemoService(prisma, cls);

    const result = await service.requiredMethod();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toBe(txClient);
    expect(cls.get('PRISMA_TX')).toBeUndefined();
  });

  it('Given active tx exists, When calling REQUIRED method, Then join existing tx without new transaction', async () => {
    cls.set('PRISMA_TX', existingTx);
    const service = new DemoService(prisma, cls);

    const result = await service.requiredMethod();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toBe(existingTx);
  });

  it('Given no active tx, When calling MANDATORY method, Then throw explicit error', async () => {
    const service = new DemoService(prisma, cls);
    await expect(service.mandatoryMethod()).rejects.toThrow('要求存在活动事务');
  });

  it('Given active tx exists, When calling NOT_SUPPORTED method, Then suspend and restore tx', async () => {
    cls.set('PRISMA_TX', existingTx);
    const service = new DemoService(prisma, cls);

    const result = await service.notSupportedMethod();

    expect(result).toBeNull();
    expect(cls.get('PRISMA_TX')).toBe(existingTx);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('Given noRollbackFor matched error, When method throws, Then transaction commits and rethrows', async () => {
    const service = new DemoService(prisma, cls);
    await expect(service.noRollbackMethod()).rejects.toThrow('no rollback');

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: 'Serializable',
        timeout: 1234,
      }),
    );
  });

  it('Given service has no this.prisma but repository owns prisma, When calling @Transactional method, Then still opens transaction', async () => {
    const service = new RepoOnlyService({ prisma }, cls);

    const result = await service.run();

    expect(result).toBe(txClient);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
