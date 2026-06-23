import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { ServiceSlotService } from './service-slot.service';
import { TimeSlotDto, LockSlotDto } from './dto/service-slot.dto';
import { ResponseCode, Result } from 'src/common/response';
import { Member } from '../common/decorators/member.decorator';
import { BusinessException } from 'src/common/exceptions';
import { AvailableDatesVo, TimeSlotsVo } from './vo/service-slot.vo';

@ApiTags('C端-服务预约')
@Controller('client/service')
export class ServiceSlotController {
  constructor(private readonly serviceSlotService: ServiceSlotService) {}

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('available-dates')
  @ApiOperation({ summary: '获取可预约日期' })
  @Api({ summary: '获取可预约日期', type: AvailableDatesVo })
  async getAvailableDates() {
    const result = await this.serviceSlotService.getAvailableDates();
    return Result.ok({ dates: result });
  }

  /**
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('time-slots')
  @ApiOperation({ summary: '获取可用时间段' })
  @Api({ summary: '获取可用时间段', type: TimeSlotsVo })
  async getTimeSlots(@Query() dto: TimeSlotDto) {
    const result = await this.serviceSlotService.getTimeSlots(dto.date);
    return Result.ok({ slots: result });
  }

  /**
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Post('lock-slot')
  @ApiOperation({ summary: '锁定时间段' })
  async lockSlot(@Member('memberId') memberId: string, @Body() dto: LockSlotDto) {
    const locked = await this.serviceSlotService.lockSlot(dto.date, dto.time, memberId);
    if (!locked) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '当前时间段已被占用');
    }
    return Result.ok(null, '锁定成功');
  }
}
