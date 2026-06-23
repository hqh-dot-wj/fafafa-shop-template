/**
 * 真网发送探测：在 apps/backend 目录配置 .env 或导出环境变量后执行：
 *   pnpm test:aliyun-sms
 *
 * 必填：ALIYUN_SMS_ACCESS_KEY_ID、ALIYUN_SMS_ACCESS_KEY_SECRET、ALIYUN_SMS_SIGN_NAME、
 *       ALIYUN_SMS_TEMPLATE_MEMBER_LOGIN（或与 scene 对应的模板）、ALIYUN_SMS_TEST_PHONE
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AliyunSmsProvider } from '../src/module/notification/channels/providers/aliyun-sms.provider';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const phone = process.env.ALIYUN_SMS_TEST_PHONE?.trim();
  if (!phone) {
    console.error('缺少 ALIYUN_SMS_TEST_PHONE');
    process.exit(1);
  }

  const provider = new AliyunSmsProvider();
  if (!provider.isReady()) {
    console.error('isReady() 为 false：请检查 ALIYUN_SMS_ACCESS_KEY_ID / SECRET / SIGN_NAME');
    process.exit(1);
  }

  const code = process.env.ALIYUN_SMS_TEST_CODE?.trim() || String(100000 + Math.floor(Math.random() * 900000));

  await provider.sendVerificationCode({
    phone,
    code,
    scene: 'member_login',
    tenantId: 'test',
    validMinutes: Number(process.env.ALIYUN_SMS_TEST_MINUTES) || 5,
  });

  console.log('SendSms 返回 OK，请到手机确认是否收到短信。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
