/**
 * 业务常量定义
 * 用于消除代码中的魔法数字(Magic Numbers)
 */
export const BusinessConstants = {
  /**
   * 分销系统默认配置
   */
  DISTRIBUTION: {
    DEFAULT_LEVEL1_RATE: 0.1, // 一级分佣默认 10%
    DEFAULT_LEVEL2_RATE: 0.05, // 二级分佣默认 5%
    DEFAULT_CROSS_TENANT_RATE: 1.0, // 默认跨店折扣 100% (不打折)
    DEFAULT_CROSS_DAILY_LIMIT: 500, // 默认跨店日限额 500元
    DEFAULT_SHARE_LINK_EXPIRE_MINUTES: 24 * 60, // 分享链接默认有效期 24 小时
    DEFAULT_SHARE_MAX_CLICK_COUNT: 100, // 分享链接默认点击上限
    DEFAULT_SHARE_MAX_BIND_COUNT: 20, // 分享链接默认绑定上限
    DEFAULT_SHARE_MAX_ORDER_COUNT: 20, // 分享链接默认归因订单上限
    DEFAULT_ATTRIBUTION_WINDOW_MINUTES: 7 * 24 * 60, // 归因有效期默认 7 天
    SHARE_CLICK_DEDUPE_WINDOW_MINUTES: 5, // 同 member + sid 点击去重窗口
    DEFAULT_SHARE_ENTRY_PAGE: 'pages/distribution/entry', // 默认小程序落地页
  },

  /**
   * 财务系统限额
   */
  FINANCE: {
    MIN_WITHDRAWAL_AMOUNT: 1.0, // 最小提现金额 1元
    MAX_SINGLE_AMOUNT: 50000, // 单笔金额上限 5万元
    MAX_DAILY_WITHDRAWAL_COUNT: 3, // 单日提现次数上限
    MAX_DAILY_WITHDRAWAL_AMOUNT: 50000, // 单日提现金额上限 5万元
    WITHDRAWAL_FEE_RATE: 0, // 提现手续费率（0 表示免手续费）
    WITHDRAWAL_FEE_MIN: 0, // 最低手续费
    MAX_PAYMENT_RETRY_COUNT: 3, // 打款失败最大重试次数
    SETTLEMENT_BATCH_SIZE: 100, // S-T9: 结算批量大小
  },

  /**
   * 锁过期时间
   *
   * 单位口径警示：原 `SETTLEMENT_TTL` 是「秒」（配合 ioredis `'EX'` 参数）。
   * 新增 `SETTLEMENT_TTL_MS` 是「毫秒」，供 `RedisService.tryLock / renewLock`
   * （底层 `'PX'`、`pexpire`）使用。两个常量值必须等价，调用方按 API 单位选用。
   */
  REDIS_LOCK: {
    SETTLEMENT_TTL: 300, // 秒，保留兼容；逐步迁移到 SETTLEMENT_TTL_MS
    SETTLEMENT_TTL_MS: 300_000, // 毫秒，结算/对账类锁保持 5 分钟
  },

  /**
   * 门店商品库存预警
   */
  STOCK_ALERT: {
    DEFAULT_THRESHOLD: 10, // 默认低库存阈值
    CONFIG_KEY: 'store.product.stockAlertThreshold',
  },

  /**
   * 定时任务通用阈值（Phase D 治理引入）
   *
   * 集中维护 13 个 self-managed scheduler 的锁 TTL、保留天数等阈值，
   * 避免散落在各 scheduler 文件里产生「魔法数字 + 单位混淆」。
   * 单位口径：所有 `*_LOCK_TTL_MS` 均为毫秒，配合 RedisService.tryLock 的 PX 参数。
   */
  SCHEDULER: {
    // 营销观测预筛告警锁 TTL。原 4 分钟在 ETL 阻塞时会过早释放导致并发扫描，
    // Phase D3 抬到 6 分钟，给单次扫描充足窗口。
    RESOLUTION_ALERT_LOCK_TTL_MS: 6 * 60 * 1000,
    // 营销资源用量聚合锁 TTL（15 分钟，沿用现值）。
    AGGREGATE_USAGE_LOCK_TTL_MS: 15 * 60 * 1000,
    // 营销决议归档清理锁 TTL（30 分钟，沿用现值）。
    RESOLUTION_AUDIT_ARCHIVE_LOCK_TTL_MS: 30 * 60 * 1000,
    // 拼课团队补位/重算锁 TTL。原 55s 与 cron 周期 60s 余量过薄，
    // Phase D3 抬到 90s，避免单次扫描跨周期重入。
    COURSE_GROUP_LOCK_TTL_MS: 90 * 1000,
    // sys_job_log 保留天数。Phase D4 新增清理定时任务，默认保留 90 天。
    SYS_JOB_LOG_RETENTION_DAYS: 90,
  },
};
