import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function fail(message) {
  console.error(`\n[commit-msg] ${message}\n`);
  process.exit(1);
}

const commitMsgFile = process.argv[2];

if (!commitMsgFile) {
  fail('缺少 commit message 文件路径参数。');
}

const commitMsgPath = path.resolve(commitMsgFile);

if (!fs.existsSync(commitMsgPath)) {
  fail(`找不到 commit message 文件: ${commitMsgPath}`);
}

const content = fs.readFileSync(commitMsgPath, 'utf8').replace(/^\uFEFF/, '');
const headerLine =
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#')) ?? '';

if (!headerLine) {
  fail('提交信息不能为空。');
}

// 允许 Git 自动生成的合并提交信息。
if (headerLine.startsWith('Merge ')) {
  process.exit(0);
}

const pattern = /^(feat|fix|docs|refactor|test|chore)\((backend|admin-web|c-web|miniapp-client|libs|deploy)\):\s(.+)$/;
const match = headerLine.match(pattern);

if (!match) {
  fail(
    '提交信息格式不符合要求。\n' + '必须为: <type>(<scope>): <中文描述>\n' + '示例: feat(backend): 新增订单导出接口',
  );
}

const description = match[3].trim();

if (!/[\u4e00-\u9fff]/.test(description)) {
  fail('description 必须包含中文。');
}

if (/[A-Za-z]/.test(description)) {
  fail('description 禁止包含英文字符。');
}

try {
  const escapedPath = commitMsgPath.replace(/"/g, '\\"');
  execSync(`pnpm commitlint --edit "${escapedPath}"`, { stdio: 'inherit' });
} catch {
  process.exit(1);
}
