import { Module, forwardRef } from '@nestjs/common';
import { PlayInstanceController } from './instance.controller';
import { PlayInstanceService } from './instance.service';
import { InstanceProbeService } from './instance-probe.service';
import { PlayInstanceRepository } from './instance.repository';
import { IdempotencyService } from './idempotency.service';

/**
 * 营销实例模块
 */
import { UserAssetModule } from '../asset/asset.module';
import { FinanceModule } from 'src/module/finance/finance.module';

import { MarketingEventsModule } from '../events/events.module';
import { GrayModule } from '../gray/gray.module';
import { MarketingStockModule } from '../stock/stock.module';

@Module({
  imports: [
    UserAssetModule,
    FinanceModule,
    // 运行时延迟解析，打破实例与玩法模块的静态循环依赖
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 动态模块需延迟加载
    forwardRef(() => require('../play/play.module').MarketingPlayModule),
    MarketingEventsModule, // 导入事件模块
    GrayModule, // 导入灰度发布模块
    MarketingStockModule,
  ],
  controllers: [PlayInstanceController],
  providers: [PlayInstanceService, InstanceProbeService, PlayInstanceRepository, IdempotencyService],
  exports: [PlayInstanceService, InstanceProbeService, PlayInstanceRepository, IdempotencyService],
})
export class PlayInstanceModule {}
