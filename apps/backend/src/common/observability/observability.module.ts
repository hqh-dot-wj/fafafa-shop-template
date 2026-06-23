import { Global, Module } from '@nestjs/common';
import { ErrorEventService } from './error-event.service';
import { StepTraceService } from './step-trace.service';

@Global()
@Module({
  providers: [ErrorEventService, StepTraceService],
  exports: [ErrorEventService, StepTraceService],
})
export class ObservabilityModule {}
