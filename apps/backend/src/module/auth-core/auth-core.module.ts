import { Module } from '@nestjs/common';
import { SmsOutboundModule } from 'src/module/notification/channels/sms-outbound.module';
import { AuthAuditService } from './services/auth-audit.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { PasswordResetService } from './services/password-reset.service';
import { SmsCodeService } from './services/sms-code.service';
import { VerificationCodeService } from './services/verification-code.service';

@Module({
  imports: [SmsOutboundModule],
  providers: [VerificationCodeService, SmsCodeService, PasswordPolicyService, PasswordResetService, AuthAuditService],
  exports: [VerificationCodeService, SmsCodeService, PasswordPolicyService, PasswordResetService, AuthAuditService],
})
export class AuthCoreModule {}
