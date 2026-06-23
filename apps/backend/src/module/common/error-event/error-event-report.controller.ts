import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Api } from 'src/common/decorators/api.decorator';
import { Result } from 'src/common/response';
import { ErrorEventService } from 'src/common/observability';
import { NotRequireAuth } from 'src/module/admin/system/user/user.decorator';
import { ReportErrorEventDto } from './dto/report-error-event.dto';

@ApiTags('客户端错误事件')
@Controller('client/error-event')
export class ErrorEventReportController {
  constructor(private readonly errorEventService: ErrorEventService) {}

  @Post()
  @Api({ summary: '上报客户端错误事件', body: ReportErrorEventDto })
  @NotRequireAuth()
  async report(@Body() dto: ReportErrorEventDto, @Req() req: Request) {
    const errorId = await this.errorEventService.recordClientEvent(
      {
        app: dto.app,
        level: dto.level || 'error',
        requestId: dto.requestId,
        traceId: dto.traceId,
        errorId: dto.errorId,
        tenantId: dto.tenantId,
        userId: dto.userId,
        route: dto.route,
        method: dto.method,
        module: dto.module,
        operationCode: dto.operationCode,
        stepCode: dto.stepCode,
        stepName: dto.stepName,
        errorCode: dto.errorCode,
        safeMessage: dto.safeMessage,
        technicalMessage: dto.technicalMessage,
        stack: dto.stack,
        durationMs: dto.durationMs,
        metadata: dto.metadata,
        source: 'client-report',
      },
      req,
    );
    return Result.ok({ errorId }, '错误事件已记录');
  }
}
