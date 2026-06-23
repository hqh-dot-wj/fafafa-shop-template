import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CampaignAdminController } from './campaign-admin.controller';
import { CampaignAdminService } from './campaign-admin.service';
import { CampaignRepository } from './campaign.repository';
import { CampaignShellController } from './campaign-shell.controller';
import { CampaignShellService } from './campaign-shell.service';

@Module({
  imports: [PrismaModule],
  controllers: [CampaignShellController, CampaignAdminController],
  providers: [CampaignShellService, CampaignAdminService, CampaignRepository],
  exports: [CampaignShellService, CampaignAdminService],
})
export class CampaignShellModule {}
