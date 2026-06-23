import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RuleModule } from '../rule/rule.module';
import { MarketingSchemaController } from './schema.controller';
import { MarketingSchemaService } from './schema.service';

@Module({
  imports: [PrismaModule, RuleModule],
  controllers: [MarketingSchemaController],
  providers: [MarketingSchemaService],
  exports: [MarketingSchemaService],
})
export class MarketingSchemaModule {}
