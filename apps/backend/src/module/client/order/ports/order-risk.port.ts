import { Injectable } from '@nestjs/common';
import { ClientInfoDto } from 'src/common/decorators/common.decorator';
import { RiskService } from 'src/module/risk/risk.service';

@Injectable()
export class OrderRiskPort {
  constructor(private readonly riskService: RiskService) {}

  async checkOrderRisk(memberId: string, tenantId: string, clientInfo?: ClientInfoDto) {
    if (!clientInfo) return;
    await this.riskService.checkOrderRisk(memberId, tenantId, clientInfo.ipaddr, clientInfo.deviceType);
  }
}
