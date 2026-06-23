import { Module, forwardRef } from '@nestjs/common';
import { StorePlayConfigController } from './config.controller';
import { StorePlayConfigService } from './config.service';
import { StorePlayConfigRepository } from './config.repository';
import { MarketingTemplateModule } from '../template/template.module';
import { PmsModule } from 'src/module/pms/pms.module';

@Module({
  imports: [
    MarketingTemplateModule,
    PmsModule,
    // 运行时延迟解析，打破配置与玩法模块的静态循环依赖
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 动态模块需延迟加载
    forwardRef(() => require('../play/play.module').MarketingPlayModule),
  ],
  controllers: [StorePlayConfigController],
  providers: [StorePlayConfigService, StorePlayConfigRepository],
  exports: [StorePlayConfigService, StorePlayConfigRepository],
})
export class MarketingConfigModule {}
