import { Module } from '@nestjs/common';
import { ErrorEventReportController } from './error-event-report.controller';

@Module({
  controllers: [ErrorEventReportController],
})
export class ErrorEventReportModule {}
