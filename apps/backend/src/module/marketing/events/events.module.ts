import { Module, forwardRef } from '@nestjs/common';
import { NotificationModule } from 'src/module/notification/notification.module';

import { MessageTouchpointDispatcher } from './message-touchpoint.dispatcher';
import { TouchpointOrchestratorService } from './touchpoint-orchestrator.service';
import { EventCatalogController } from './event-catalog.controller';
import { EventCatalogService } from './event-catalog.service';

/**
 * 营销事件模块
 *
 * @description
 * 提供营销事件目录、统计记录和消息触点编排。业务侧需要记录事件统计或触发消息触点时，
 * 直接注入 MessageTouchpointDispatcher，不再通过 EventEmitter2 中转。
 */
@Module({
  imports: [
    NotificationModule,
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- 延迟加载，避免 events ↔ activity ↔ distribution 的静态模块初始化环
      return require('../activity/activity.module').ActivityModule;
    }),
  ],
  controllers: [EventCatalogController],
  providers: [MessageTouchpointDispatcher, TouchpointOrchestratorService, EventCatalogService],
  exports: [MessageTouchpointDispatcher],
})
export class MarketingEventsModule {}
