/**
 * 在终端打印 C 端营销运行时 sys_config 键台账（与后台「C端运行时开关台账」同源结构）。
 */
import { MARKETING_CLIENT_RUNTIME_REGISTRY } from 'src/module/marketing/marketing-client-runtime.registry';

console.table(
  MARKETING_CLIENT_RUNTIME_REGISTRY.map((row) => ({
    配置键: row.configKey,
    名称: row.displayName,
    平台默认展示: row.platformDefaultDisplay,
    说明: row.remark,
  })),
);
