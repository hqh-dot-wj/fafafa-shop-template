import { Module } from '@nestjs/common';
import { FinanceEventEmitter } from './finance-event.emitter';

/**
 * 财务事件模块
 *
 * @description
 * 提供财务系统的事件驱动能力，用于解耦模块依赖。
 * EventEmitterModule.forRoot() 已在 AppModule 全局注册。
 */
@Module({
  providers: [FinanceEventEmitter],
  exports: [FinanceEventEmitter],
})
export class FinanceEventsModule {}
