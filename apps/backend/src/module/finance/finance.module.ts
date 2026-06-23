import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DistributionModule } from '../store/distribution/distribution.module';
import { PaymentModule } from '../payment/payment.module';
import { WalletService } from './wallet/wallet.service';
import { WalletAdminService } from './wallet/wallet-admin.service';
import { WalletQueueService } from './wallet/wallet-queue.service';
import { WalletProcessor } from './wallet/wallet.processor';
import { CommissionService } from './commission/commission.service';
import { CommissionAdminService } from './commission/commission-admin.service';
import { CommissionProcessor } from './commission/commission.processor';
import { WithdrawalService } from './withdrawal/withdrawal.service';
import { WithdrawalAdminService } from './withdrawal/withdrawal-admin.service';
import { WithdrawalAuditService } from './withdrawal/withdrawal-audit.service';
import { WithdrawalPaymentService } from './withdrawal/withdrawal-payment.service';
import { WithdrawalReconciliationScheduler } from './withdrawal/withdrawal-reconciliation.scheduler';
import { FinRefundService } from './refund/fin-refund.service';
import { SettlementScheduler } from './settlement/settlement.scheduler';
import { SettlementLogService } from './settlement/settlement-log.service';
import { SettlementController } from './settlement/settlement.controller';
import { SettlementCoreService } from './settlement-core/settlement-core.service';
import { SettlementExecutionService } from './settlement-core/settlement-execution.service';
import { SettlementReconciliationCenterService } from './settlement-core/settlement-reconciliation-center.service';
import { SettlementReconciliationScheduler } from './settlement-core/settlement-reconciliation.scheduler';
import { WithdrawalController } from './withdrawal/withdrawal.controller';
import { WithdrawalRepository } from './withdrawal/withdrawal.repository';
import { CommissionRepository } from './commission/commission.repository';
import { CommissionCompensationScheduler } from './commission/commission-compensation.scheduler';
import { WalletRepository } from './wallet/wallet.repository';
import { TransactionRepository } from './wallet/transaction.repository';
// Commission sub-services
import { DistConfigService } from './commission/services/dist-config.service';
import { CommissionValidatorService } from './commission/services/commission-validator.service';
import { BaseCalculatorService } from './commission/services/base-calculator.service';
import { L1CalculatorService } from './commission/services/l1-calculator.service';
import { L2CalculatorService } from './commission/services/l2-calculator.service';
import { CommissionCalculatorService } from './commission/services/commission-calculator.service';
import { CommissionSettlerService } from './commission/services/commission-settler.service';
// Events
import { FinanceEventsModule } from './events/finance-events.module';
// Ports & Adapters (A-T1, A-T2: 跨模块解耦)
import { OrderQueryPort } from './ports/order-query.port';
import { MemberQueryPort } from './ports/member-query.port';
import { DistributionQualificationQueryPort } from './ports/distribution-qualification-query.port';
import { CommissionQueryPort } from './ports/commission-query.port';
import { WithdrawalQueryPort } from './ports/withdrawal-query.port';
import { WalletQueryPort } from './ports/wallet-query.port';
import { FinanceCommandPort } from './ports/finance-command.port';
import { OrderQueryAdapter } from './adapters/order-query.adapter';
import { MemberQueryAdapter } from './adapters/member-query.adapter';
import { DistributionQualificationQueryAdapter } from './adapters/distribution-qualification-query.adapter';
import { CommissionQueryAdapter } from './adapters/commission-query.adapter';
import { WithdrawalQueryAdapter } from './adapters/withdrawal-query.adapter';
import { WalletQueryAdapter } from './adapters/wallet-query.adapter';
import { FinanceCommandAdapter } from './adapters/finance-command.adapter';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'CALC_COMMISSION' },
      { name: 'WALLET_OPERATIONS' }, // A-T4: 钱包操作队列
    ),
    DistributionModule,
    FinanceEventsModule,
    PaymentModule,
  ],
  controllers: [WithdrawalController, SettlementController],
  providers: [
    WalletService,
    WalletAdminService,
    WalletQueueService, // A-T4
    WalletProcessor, // A-T4
    CommissionService,
    CommissionAdminService,
    CommissionProcessor,
    CommissionCompensationScheduler,
    WithdrawalService,
    WithdrawalAdminService,
    WithdrawalAuditService,
    WithdrawalPaymentService,
    WithdrawalReconciliationScheduler,
    FinRefundService,
    SettlementScheduler,
    SettlementLogService,
    SettlementCoreService,
    SettlementExecutionService,
    SettlementReconciliationCenterService,
    SettlementReconciliationScheduler,
    // Commission sub-services
    DistConfigService,
    CommissionValidatorService,
    BaseCalculatorService,
    L1CalculatorService,
    L2CalculatorService,
    CommissionCalculatorService,
    CommissionSettlerService,
    // Repositories
    WithdrawalRepository,
    CommissionRepository,
    WalletRepository,
    TransactionRepository,
    // Ports & Adapters (A-T1, A-T2)
    { provide: OrderQueryPort, useClass: OrderQueryAdapter },
    { provide: MemberQueryPort, useClass: MemberQueryAdapter },
    { provide: DistributionQualificationQueryPort, useClass: DistributionQualificationQueryAdapter },
    { provide: CommissionQueryPort, useClass: CommissionQueryAdapter },
    { provide: WithdrawalQueryPort, useClass: WithdrawalQueryAdapter },
    { provide: WalletQueryPort, useClass: WalletQueryAdapter },
    { provide: FinanceCommandPort, useClass: FinanceCommandAdapter },
  ],
  exports: [
    WalletAdminService,
    CommissionAdminService,
    WithdrawalAdminService,
    FinRefundService,
    SettlementScheduler,
    SettlementLogService,
    SettlementCoreService,
    SettlementExecutionService,
    SettlementReconciliationCenterService,
    // 导出事件模块
    FinanceEventsModule,
    // 导出 Ports 供其他模块只读访问财务事实
    OrderQueryPort,
    MemberQueryPort,
    DistributionQualificationQueryPort,
    CommissionQueryPort,
    WithdrawalQueryPort,
    WalletQueryPort,
    FinanceCommandPort,
  ],
})
export class FinanceModule {}
