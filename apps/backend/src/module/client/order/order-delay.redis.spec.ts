import Bull, { Job, Queue, QueueOptions } from 'bull';
import Redis from 'ioredis';

const runRedisIntegration = process.env.ORDER_DELAY_REDIS_INTEGRATION === '1';
const describeRedisIntegration: typeof describe = runRedisIntegration
  ? describe
  : (name, _fn) =>
      describe(name, () => {
        it('is disabled unless ORDER_DELAY_REDIS_INTEGRATION=1', () => {
          expect(process.env.ORDER_DELAY_REDIS_INTEGRATION).not.toBe('1');
        });
      });

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || '123456',
  db: Number(process.env.REDIS_DB || 2),
};

const queueOptions = (prefix: string): QueueOptions => ({
  redis: redisOptions,
  prefix,
  settings: {
    stalledInterval: 500,
    guardInterval: 500,
    retryProcessDelay: 250,
  },
});

async function deleteKeysByPattern(redis: Redis, pattern: string) {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}

function waitForCompletedJob(queue: Queue, timeoutMs: number) {
  return new Promise<Job>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for Bull completed event after ${timeoutMs}ms`));
    }, timeoutMs);

    const onCompleted = (job: Job) => {
      cleanup();
      resolve(job);
    };
    const onFailed = (job: Job | undefined, error: Error) => {
      cleanup();
      reject(new Error(`Bull job ${job?.id ?? 'unknown'} failed: ${error.message}`));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      queue.off('completed', onCompleted);
      queue.off('failed', onFailed);
      queue.off('error', onError);
    };

    queue.on('completed', onCompleted);
    queue.on('failed', onFailed);
    queue.on('error', onError);
  });
}

describeRedisIntegration('ORDER_DELAY Redis/Bull recovery integration', () => {
  jest.setTimeout(20_000);

  const prefix = `order-delay-it-${Date.now()}-${process.pid}`;
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(redisOptions);
    await redis.ping();
  });

  afterAll(async () => {
    await deleteKeysByPattern(redis, `${prefix}:*`);
    redis.disconnect();
  });

  it('Given cancel_unpaid delayed job exists before worker starts, When worker starts after restart, Then job is consumed from Redis', async () => {
    const orderId = `order-${Date.now()}`;
    const producer = new Bull('ORDER_DELAY', queueOptions(prefix));

    await producer.isReady();
    await producer.add(
      'cancel_unpaid',
      {
        orderId,
        reason: 'integration restart recovery',
        timeoutMinutes: 30,
        scheduledAt: new Date().toISOString(),
      },
      {
        delay: 300,
        jobId: `cancel_unpaid:${orderId}`,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    await producer.close();

    const worker = new Bull('ORDER_DELAY', queueOptions(prefix));
    try {
      await worker.isReady();
      const completed = waitForCompletedJob(worker, 8_000);
      worker.process('cancel_unpaid', async (job) => {
        expect(job.name).toBe('cancel_unpaid');
        expect(job.data).toMatchObject({
          orderId,
          reason: 'integration restart recovery',
          timeoutMinutes: 30,
        });
      });

      const completedJob = await completed;
      expect(completedJob.name).toBe('cancel_unpaid');
      expect(completedJob.data.orderId).toBe(orderId);
    } finally {
      await worker.close();
    }
  });
});
