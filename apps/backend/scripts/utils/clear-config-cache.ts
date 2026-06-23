import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

async function main() {
  Logger.log('🧹 清理旧的配置缓存...', 'ClearCache');

  // 使用生产环境Redis配置
  const redisConfig = {
    host: 'localhost',
    port: 6379,
    password: '123456',
    db: 2,
  };

  Logger.log(`连接 Redis: ${redisConfig.host}:${redisConfig.port} (DB: ${redisConfig.db})`, 'ClearCache');

  const client = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
  });

  try {
    // 查找所有配置缓存键
    const keys = await client.keys('SYS_CONFIG:*');

    Logger.log(`找到 ${keys.length} 个旧缓存键`, 'ClearCache');

    if (keys.length > 0) {
      Logger.log('将删除以下缓存键:', 'ClearCache');
      keys.forEach((key) => Logger.log(`  - ${key}`, 'ClearCache'));

      // 删除所有旧缓存
      const deleted = await client.del(keys);
      Logger.log(`✅ 成功删除 ${deleted} 个缓存键`, 'ClearCache');
    } else {
      Logger.log('✅ 没有需要清理的缓存', 'ClearCache');
    }
  } catch (error) {
    Logger.error('❌ 清理缓存失败:', error, 'ClearCache');
  } finally {
    await client.quit();
  }
}

main()
  .then(() => {
    Logger.log('✨ 清理完成！', 'ClearCache');
    process.exit(0);
  })
  .catch((e) => {
    Logger.error('❌ 执行失败:', e, 'ClearCache');
    process.exit(1);
  });
