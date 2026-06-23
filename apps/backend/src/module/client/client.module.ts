import { Module } from '@nestjs/common';
import { ClientAuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ClientProductModule } from './product/product.module';
import { ClientLocationModule } from './location/location.module';
import { ClientCartModule } from './cart/cart.module';
import { ClientOrderModule } from './order/order.module';
import { ClientAddressModule } from './address/address.module';
import { ServiceSlotModule } from './service/service-slot.module';
import { PaymentModule } from './payment/payment.module';
import { ClientFinanceModule } from './finance/client-finance.module';
import { UpgradeModule } from './upgrade/upgrade.module';
import { ClientMarketingModule } from './marketing/client-marketing.module';
import { ClientAiContentModule } from './ai-content/client-ai-content.module';
import { ClientUploadModule } from './upload/client-upload.module';
import { ClientDistributionModule } from './distribution/distribution.module';
import { ClientShopModule } from './shop/shop.module';
import { ErrorEventReportModule } from '../common/error-event/error-event-report.module';

@Module({
  imports: [
    ErrorEventReportModule,
    ClientAuthModule,
    ClientUploadModule,
    UserModule,
    ClientProductModule,
    ClientLocationModule,
    ClientCartModule,
    ClientOrderModule,
    ClientAddressModule,
    ServiceSlotModule,
    PaymentModule,
    ClientFinanceModule,
    UpgradeModule,
    ClientDistributionModule,
    ClientShopModule,
    ClientMarketingModule,
    ClientAiContentModule,
  ],
  controllers: [],
  providers: [],
  exports: [
    ErrorEventReportModule,
    ClientAuthModule,
    ClientProductModule,
    ClientLocationModule,
    ClientCartModule,
    ClientOrderModule,
    ClientAddressModule,
    ServiceSlotModule,
    PaymentModule,
    ClientDistributionModule,
  ],
})
export class ClientModule {}
