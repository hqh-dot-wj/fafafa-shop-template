import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { AddressService } from './address.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { Result } from 'src/common/response';
import { Member } from '../common/decorators/member.decorator';
import { AddressListVo, AddressVo } from './vo/address.vo';

/**
 * C端地址管理接口
 */
@ApiTags('C端-地址管理')
@ApiBearerAuth()
@UseGuards(AuthGuard('member-jwt'))
@Controller('client/address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  /**
   * 获取地址列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('list')
  @ApiOperation({ summary: '获取地址列表' })
  @Api({ summary: '获取地址列表', type: AddressListVo })
  async getAddressList(@Member('memberId') memberId: string) {
    const result = await this.addressService.getAddressList(memberId);
    return Result.ok(result);
  }

  /**
   * 获取默认地址
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get('default')
  @ApiOperation({ summary: '获取默认地址' })
  @Api({ summary: '获取默认地址', type: AddressVo })
  async getDefaultAddress(@Member('memberId') memberId: string) {
    const result = await this.addressService.getDefaultAddress(memberId);
    return Result.ok(result);
  }

  /**
   * 获取地址详情
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Get(':id')
  @ApiOperation({ summary: '获取地址详情' })
  @Api({ summary: '获取地址详情', type: AddressVo })
  async getAddressDetail(@Member('memberId') memberId: string, @Param('id') id: string) {
    const result = await this.addressService.getAddressDetail(memberId, id);
    return Result.ok(result);
  }

  /**
   * 创建地址
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Post()
  @ApiOperation({ summary: '创建地址' })
  @Api({ summary: '创建地址', type: AddressVo })
  async createAddress(@Member('memberId') memberId: string, @Body() dto: CreateAddressDto) {
    const result = await this.addressService.createAddress(memberId, dto);
    return Result.ok(result, '创建成功');
  }

  /**
   * 更新地址
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Put()
  @ApiOperation({ summary: '更新地址' })
  @Api({ summary: '更新地址', type: AddressVo })
  async updateAddress(@Member('memberId') memberId: string, @Body() dto: UpdateAddressDto) {
    const result = await this.addressService.updateAddress(memberId, dto);
    return Result.ok(result, '更新成功');
  }

  /**
   * 删除地址
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除地址' })
  async deleteAddress(@Member('memberId') memberId: string, @Param('id') id: string) {
    await this.addressService.deleteAddress(memberId, id);
    return Result.ok(null, '删除成功');
  }

  /**
   * 设置默认地址
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Put(':id/default')
  @ApiOperation({ summary: '设为默认地址' })
  async setDefaultAddress(@Member('memberId') memberId: string, @Param('id') id: string) {
    await this.addressService.setDefaultAddress(memberId, id);
    return Result.ok(null, '设置成功');
  }
}
