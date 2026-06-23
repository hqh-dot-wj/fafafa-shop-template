/**
 * 商品查询容量估算脚本
 *
 * 用法：
 * node scripts/loadtests/product-query-capacity-estimator.mjs
 *
 * 可选环境变量：
 * - TARGET_QPS: 目标总 QPS（默认 1200）
 * - INSTANCE_COUNT: 应用实例数（默认 1）
 * - PRISMA_CONNECTION_LIMIT: 单实例连接池上限（默认 10）
 * - DB_QUERY_AVG_MS: 单条 SQL 平均耗时（默认 25ms）
 * - SQL_PER_MISS: 单次缓存未命中请求触发 SQL 条数（默认 3）
 * - CACHE_MISS_RATIO: 缓存未命中率 0~1（默认 0.08）
 * - DB_MAX_CONNECTIONS: 数据库 max_connections（默认 300）
 * - DB_RESERVED_CONNECTIONS: 预留给运维/迁移/只读工具连接数（默认 60）
 */

const num = (raw, fallback) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const targetQps = Math.max(1, Math.trunc(num(process.env.TARGET_QPS, 1200)));
const instanceCount = Math.max(1, Math.trunc(num(process.env.INSTANCE_COUNT, 1)));
const poolPerInstance = Math.max(1, Math.trunc(num(process.env.PRISMA_CONNECTION_LIMIT, 10)));
const dbQueryAvgMs = clamp(num(process.env.DB_QUERY_AVG_MS, 25), 1, 5000);
const sqlPerMiss = clamp(Math.trunc(num(process.env.SQL_PER_MISS, 3)), 1, 20);
const cacheMissRatio = clamp(num(process.env.CACHE_MISS_RATIO, 0.08), 0, 1);
const dbMaxConnections = Math.max(1, Math.trunc(num(process.env.DB_MAX_CONNECTIONS, 300)));
const dbReservedConnections = Math.max(0, Math.trunc(num(process.env.DB_RESERVED_CONNECTIONS, 60)));

const totalPool = poolPerInstance * instanceCount;
const dbConnBudget = Math.max(0, dbMaxConnections - dbReservedConnections);
const maxPoolPerInstanceByBudget = Math.floor(dbConnBudget / instanceCount);

const connMsPerRequest = cacheMissRatio * sqlPerMiss * dbQueryAvgMs;
const estimatedQpsByDb =
  connMsPerRequest <= 0 ? Number.POSITIVE_INFINITY : (totalPool * 1000) / connMsPerRequest;

const requiredTotalPool =
  connMsPerRequest <= 0 ? 0 : Math.ceil((targetQps * connMsPerRequest) / 1000);
const requiredPoolPerInstance = Math.ceil(requiredTotalPool / instanceCount);

const canMeetTarget = connMsPerRequest <= 0 ? true : estimatedQpsByDb >= targetQps;

const line = (label, value) => {
  // eslint-disable-next-line no-console
  console.log(`${label.padEnd(32)} ${value}`);
};

// eslint-disable-next-line no-console
console.log('\n=== 商品查询容量估算（连接池视角） ===');
line('目标 QPS', targetQps);
line('应用实例数', instanceCount);
line('当前单实例连接池', poolPerInstance);
line('当前总连接池', totalPool);
line('缓存未命中率', `${(cacheMissRatio * 100).toFixed(2)}%`);
line('单次 miss SQL 数', sqlPerMiss);
line('单条 SQL 平均耗时', `${dbQueryAvgMs} ms`);
line('单请求 DB 连接占用', `${connMsPerRequest.toFixed(2)} conn-ms`);
line('估算 DB 可承载 QPS', Number.isFinite(estimatedQpsByDb) ? estimatedQpsByDb.toFixed(2) : '无限制(全命中)');
line('目标是否可达', canMeetTarget ? '可达' : '不可达');
line('目标所需单实例连接池', requiredPoolPerInstance);
line('数据库预算单实例上限', maxPoolPerInstanceByBudget);
line('数据库 max_connections', dbMaxConnections);
line('数据库预留连接', dbReservedConnections);

if (!canMeetTarget) {
  // eslint-disable-next-line no-console
  console.log('\n建议：');
  // eslint-disable-next-line no-console
  console.log(`1) 优先降低 CACHE_MISS_RATIO（提升 L1/L2 命中），再考虑放大连接池。`);
  // eslint-disable-next-line no-console
  console.log(`2) 若要达成目标，单实例连接池建议至少 ${requiredPoolPerInstance}。`);
}

if (requiredPoolPerInstance > maxPoolPerInstanceByBudget) {
  // eslint-disable-next-line no-console
  console.log('\n风险提示：');
  // eslint-disable-next-line no-console
  console.log(
    `当前目标需要的连接池(${requiredPoolPerInstance})超过数据库预算上限(${maxPoolPerInstanceByBudget})，需要增加实例数、降低 miss、或扩容数据库。`,
  );
}

