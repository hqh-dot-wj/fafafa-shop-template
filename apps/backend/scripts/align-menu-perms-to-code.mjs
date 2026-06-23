/**
 * 将 sys-menu-and-role-menu.ts 中历史 perms 批量替换为与后端 @RequirePermission 一致的字符串。
 *
 * 用法（须在仓库内、任意 cwd 均可）：
 *   node apps/backend/scripts/align-menu-perms-to-code.mjs
 * 或：
 *   cd apps/backend ; node scripts/align-menu-perms-to-code.mjs
 *
 * 已对齐过的仓库再次执行不会产生替换，也不会刷屏「报错」；加 --verbose 可查看每条规则是否命中。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, '../prisma/seeds/00-platform/sys-menu-and-role-menu.ts');
const verbose = process.argv.includes('--verbose');

const pairs = [
  ["perms: 'store:finance:commission:list'", "perms: 'store:finance:commission'"],
  ["perms: 'store:finance:dashboard:list'", "perms: 'store:finance:dashboard'"],
  ["perms: 'store:finance:ledger:list'", "perms: 'store:finance:ledger'"],
  ["perms: 'store:finance:withdrawal:list'", "perms: 'store:finance:withdrawal'"],
  ["perms: 'store:order:detail'", "perms: 'store:order:query'"],
  ["perms: 'store:order:dispatch:list'", "perms: 'store:order:dispatch'"],
  ["perms: 'store:distribution:activity:list'", "perms: 'marketing:activity:list'"],
  ["perms: 'store:distribution:coupon:list'", "perms: 'marketing:coupon:distribute'"],
  ["perms: 'store:distribution:coupon-usage:list'", "perms: 'marketing:coupon:usage-record:list'"],
  ["perms: 'store:distribution:list'", "perms: 'store:distribution:config:query'"],
  ["perms: 'store:distribution:dashboard:list'", "perms: 'store:distribution:dashboard:query'"],
  ["perms: 'member:list'", "perms: 'admin:member:list'"],
  ["perms: 'member:upgrade:list'", "perms: 'admin:upgrade:list'"],
  ["perms: 'marketing:points:accounts:list'", "perms: 'marketing:points:account:list'"],
  ["perms: 'marketing:points:rules:list'", "perms: 'marketing:points:rule:query'"],
  ["perms: 'marketing:points:statistics:list'", "perms: 'marketing:points:statistics:earn'"],
  ["perms: 'marketing:points:tasks:list'", "perms: 'marketing:points:task:list'"],
  ["perms: 'marketing:scene:module:list'", "perms: 'marketing:scene:list'"],
  ["perms: 'marketing:statistics:coupon:list'", "perms: 'marketing:coupon:statistics:query'"],
  ["perms: 'marketing:course:list'", "perms: 'marketing:play:type:list'"],
  ["perms: 'marketing:course:schedule:list'", "perms: 'marketing:play:course:query'"],
  ["perms: 'marketing:course:attendance:list'", "perms: 'marketing:play:course:attendance'"],
  ["perms: 'pms:product:add'", "perms: 'pms:product:create'"],
  ["perms: 'monitor:jobLog:list'", "perms: 'monitor:job:list'"],
  ["perms: 'monitor:logininfor:export'", "perms: 'monitor:logininfor:list'"],
  ["perms: 'monitor:logininfor:query'", "perms: 'monitor:logininfor:list'"],
  ["perms: 'monitor:online:batchLogout'", "perms: 'monitor:online:forceLogout'"],
  ["perms: 'monitor:online:query'", "perms: 'monitor:online:list'"],
  ["perms: 'monitor:druid:list'", "perms: ''"],
  ["perms: 'store:product:market:list'", "perms: 'store:product:list'"],
  ["perms: 'system:user:import'", "perms: 'system:user:add'"],
  ["perms: 'tool:build:list'", "perms: ''"],
  ["perms: 'tool:gen:list'", "perms: ''"],
  ["perms: 'tool:swagger:list'", "perms: ''"],
  ["perms: 'tool:gen:query'", "perms: ''"],
  ["perms: 'tool:gen:edit'", "perms: ''"],
  ["perms: 'tool:gen:remove'", "perms: ''"],
  ["perms: 'tool:gen:import'", "perms: ''"],
  ["perms: 'tool:gen:preview'", "perms: ''"],
  ["perms: 'tool:gen:code'", "perms: ''"],
];

if (!fs.existsSync(target)) {
  console.error('找不到种子文件:', target);
  process.exit(1);
}

let s = fs.readFileSync(target, 'utf8');
const original = s;
let totalReplaced = 0;

for (const [a, b] of pairs) {
  if (!s.includes(a)) {
    if (verbose) {
      console.log('[跳过] 源串不存在（通常表示已替换过）:', a);
    }
    continue;
  }
  const count = s.split(a).length - 1;
  s = s.split(a).join(b);
  totalReplaced += count;
  console.log('已替换', count, '处 ←', a);
}

if (s === original) {
  console.log('菜单权限已与映射表一致，未写入任何更改。');
  process.exit(0);
}

fs.writeFileSync(target, s, 'utf8');
console.log('完成：共写入', totalReplaced, '处替换 →', target);
