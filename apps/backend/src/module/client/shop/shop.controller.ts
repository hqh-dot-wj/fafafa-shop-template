import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { ClientShopService } from './shop.service';
import { ClientShopBrandingVo } from './vo/shop-branding.vo';

@ApiTags('C端-店铺')
@Controller('client/shop')
export class ClientShopController {
  constructor(private readonly shopService: ClientShopService) {}

  @Api({
    summary: '店铺品牌信息',
    description: '读取当前租户店铺名称、Logo、主题色、客服与协议（登录前可访问）',
    type: ClientShopBrandingVo,
  })
  @Get('branding')
  getBranding() {
    return this.shopService.getBranding();
  }
}
