import { Module } from '@nestjs/common';
import { UpgradeController } from './upgrade.controller';
import { UpgradeService } from './upgrade.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClientCommonModule } from '../common/client-common.module';
import { UploadModule } from 'src/module/admin/upload/upload.module';

@Module({
  imports: [PrismaModule, ClientCommonModule, UploadModule],
  controllers: [UpgradeController],
  providers: [UpgradeService],
  exports: [UpgradeService],
})
export class UpgradeModule {}
