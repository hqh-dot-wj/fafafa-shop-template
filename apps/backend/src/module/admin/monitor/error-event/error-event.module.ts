import { Module } from '@nestjs/common';
import { ErrorEventController } from './error-event.controller';

@Module({
  controllers: [ErrorEventController],
})
export class ErrorEventModule {}
