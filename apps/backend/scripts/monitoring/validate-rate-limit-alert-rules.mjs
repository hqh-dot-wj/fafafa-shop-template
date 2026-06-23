import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const MONITORING_DIR = path.resolve('scripts/monitoring');
const FILE_BY_ENV = {
  default: 'rate-limit-alert.rules.yml',
  dev: 'rate-limit-alert.rules.dev.yml',
  staging: 'rate-limit-alert.rules.staging.yml',
  prod: 'rate-limit-alert.rules.prod.yml',
};

const fail = (message) => {
  // eslint-disable-next-line no-console
  console.error(`[rate-limit-alert-rules] ${message}`);
  process.exit(1);
};

const targetEnv = (process.env.RATE_LIMIT_ALERT_ENV || 'all').trim().toLowerCase();
const filePaths =
  targetEnv === 'all'
    ? Object.values(FILE_BY_ENV).map((fileName) => path.join(MONITORING_DIR, fileName))
    : FILE_BY_ENV[targetEnv]
      ? [path.join(MONITORING_DIR, FILE_BY_ENV[targetEnv])]
      : [];

if (filePaths.length === 0) {
  fail(`不支持的 RATE_LIMIT_ALERT_ENV: ${targetEnv}`);
}

const validateFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    fail(`文件不存在: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = yaml.load(content);
  } catch (error) {
    fail(`YAML 解析失败: ${path.basename(filePath)} => ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    fail(`配置不能为空: ${path.basename(filePath)}`);
  }

  const groups = parsed.groups;
  if (!Array.isArray(groups) || groups.length === 0) {
    fail(`groups 不能为空: ${path.basename(filePath)}`);
  }

  for (const [groupIndex, group] of groups.entries()) {
    if (!group || typeof group !== 'object') {
      fail(`${path.basename(filePath)} groups[${groupIndex}] 非法`);
    }
    if (typeof group.name !== 'string' || group.name.trim().length === 0) {
      fail(`${path.basename(filePath)} groups[${groupIndex}].name 不能为空`);
    }
    if (!Array.isArray(group.rules) || group.rules.length === 0) {
      fail(`${path.basename(filePath)} groups[${groupIndex}].rules 不能为空`);
    }

    for (const [ruleIndex, rule] of group.rules.entries()) {
      if (!rule || typeof rule !== 'object') {
        fail(`${path.basename(filePath)} groups[${groupIndex}].rules[${ruleIndex}] 非法`);
      }
      if (typeof rule.alert !== 'string' || rule.alert.trim().length === 0) {
        fail(`${path.basename(filePath)} groups[${groupIndex}].rules[${ruleIndex}].alert 不能为空`);
      }
      if (typeof rule.expr !== 'string' || rule.expr.trim().length === 0) {
        fail(`${path.basename(filePath)} groups[${groupIndex}].rules[${ruleIndex}].expr 不能为空`);
      }

      const labels = rule.labels;
      if (!labels || typeof labels !== 'object') {
        fail(`${path.basename(filePath)} groups[${groupIndex}].rules[${ruleIndex}].labels 不能为空`);
      }
      if (typeof labels.severity !== 'string' || labels.severity.trim().length === 0) {
        fail(`${path.basename(filePath)} groups[${groupIndex}].rules[${ruleIndex}].labels.severity 不能为空`);
      }
      if (typeof labels.service !== 'string' || labels.service.trim().length === 0) {
        fail(`${path.basename(filePath)} groups[${groupIndex}].rules[${ruleIndex}].labels.service 不能为空`);
      }
    }
  }
};

for (const filePath of filePaths) {
  validateFile(filePath);
}

// eslint-disable-next-line no-console
console.log(
  `[rate-limit-alert-rules] 校验通过: ${filePaths
    .map((item) => path.basename(item))
    .join(', ')}`,
);
