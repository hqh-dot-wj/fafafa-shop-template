#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const BLOCKING_ADMIN_SCAN_DIRS = ['store', 'pms', 'marketing', 'member'];
const ADVISORY_ADMIN_SCAN_DIRS = ['_builtin', 'home', 'system', 'monitor', 'finance', 'tool'];
const MINIAPP_SCAN_DIRS = ['pages', 'pages-auth', 'api', 'store', 'components'];
const ALLOWED_EXTENSIONS = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export const DEFAULT_SCAN_TARGETS = [
  {
    id: 'admin-web-core-views',
    label: 'admin-web 核心业务 views',
    root: 'apps/admin-web/src/views',
    dirs: BLOCKING_ADMIN_SCAN_DIRS,
    level: 'fail',
  },
  {
    id: 'admin-web-expanded-views',
    label: 'admin-web 扩展 views',
    root: 'apps/admin-web/src/views',
    dirs: ADVISORY_ADMIN_SCAN_DIRS,
    level: 'warn',
  },
  {
    id: 'miniapp-client-runtime',
    label: 'miniapp-client 运行时代码',
    root: 'apps/miniapp-client/src',
    dirs: MINIAPP_SCAN_DIRS,
    level: 'warn',
  },
];

function uniqueStrings(values) {
  return [...new Set((values || []).filter((value) => typeof value === 'string' && value.length > 0))];
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function collectFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  const entries = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      entries.push(...collectFiles(fullPath));
      continue;
    }
    if (ALLOWED_EXTENSIONS.has(path.extname(entry.name)) && shouldScanRuntimeFile(fullPath)) {
      entries.push(fullPath);
    }
  }
  return entries;
}

function shouldScanRuntimeFile(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  return !/(^|\/)(__tests__|test)\//.test(normalized) && !/\.(spec|test)\.[cm]?[jt]sx?$/.test(normalized);
}

function extractDictTypesFromContent(content, patterns) {
  const types = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
      types.push(match[1]);
    }
  }
  return types;
}

function extractDictValueMapFromInitSql(initSqlContent) {
  const map = new Map();
  const pattern =
    /INSERT INTO\s+"public"\."sys_dict_data"[\s\S]*?VALUES\s*\(\s*[^,]+,\s*'[^']*',\s*\d+,\s*'[^']*',\s*'([^']+)',\s*'([^']+)'/g;

  pattern.lastIndex = 0;
  for (let match = pattern.exec(initSqlContent); match; match = pattern.exec(initSqlContent)) {
    const dictValue = match[1];
    const dictType = match[2];
    if (!map.has(dictType)) {
      map.set(dictType, new Set());
    }
    map.get(dictType).add(dictValue);
  }

  return map;
}

export function detectMissingDictTypes(registryTypes, seedTypes) {
  const seedSet = new Set(uniqueStrings(seedTypes));
  const missing = [];
  const seen = new Set();

  for (const dictType of uniqueStrings(registryTypes)) {
    if (seedSet.has(dictType) || seen.has(dictType)) {
      continue;
    }
    seen.add(dictType);
    missing.push(dictType);
  }

  return missing;
}

export function detectHardcodedOptions(content) {
  const lines = content.split(/\r?\n/);
  const matches = [];
  const pattern = /^\s*(?:export\s+)?const\s+([A-Za-z0-9_]+Options)\s*=\s*\[/;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(pattern);
    if (match) {
      matches.push({ name: match[1], line: index + 1 });
    }
  }

  return matches;
}

function extractOptionValuesByLine(content, startLine) {
  const lines = content.split(/\r?\n/);
  const startIndex = Math.max(0, startLine - 1);
  const source = lines.slice(startIndex).join('\n');
  const endIndex = source.indexOf('];');
  const block = endIndex >= 0 ? source.slice(0, endIndex + 2) : source;

  const values = [];
  const valuePattern = /value\s*:\s*['"]([^'"]+)['"]/g;
  valuePattern.lastIndex = 0;
  for (let match = valuePattern.exec(block); match; match = valuePattern.exec(block)) {
    values.push(match[1]);
  }
  return uniqueStrings(values);
}

function extractUsedDictTypesFromContent(content) {
  return uniqueStrings(
    extractDictTypesFromContent(content, [/useDict\(\s*['"]([^'"]+)['"]/g, /getDict\(\s*['"]([^'"]+)['"]/g]),
  );
}

export function detectGovernedHardcodedOptions(content, dictValueMap) {
  const hardcodedOptions = detectHardcodedOptions(content);
  const usedDictTypes = new Set(extractUsedDictTypesFromContent(content));
  const dictEntries = [...dictValueMap.entries()];

  const hits = [];
  for (const option of hardcodedOptions) {
    const values = extractOptionValuesByLine(content, option.line);
    if (values.length < 2) {
      continue;
    }

    const candidateDictTypes = [];
    for (const [dictType, dictValues] of dictEntries) {
      const allMatched = values.every((value) => dictValues.has(value));
      if (allMatched) {
        candidateDictTypes.push(dictType);
      }
    }

    if (candidateDictTypes.length === 0) {
      continue;
    }

    if (candidateDictTypes.some((dictType) => usedDictTypes.has(dictType))) {
      continue;
    }

    hits.push({
      ...option,
      candidateDictTypes,
      values,
    });
  }

  return hits;
}

export function collectHardcodedOptionFindings(workspaceRoot, dictValueMap, scanTargets = DEFAULT_SCAN_TARGETS) {
  const findings = [];

  for (const target of scanTargets) {
    const targetRoot = path.join(workspaceRoot, target.root);
    for (const dirName of target.dirs) {
      const dirPath = path.join(targetRoot, dirName);
      for (const filePath of collectFiles(dirPath)) {
        const content = readText(filePath);
        const matches = detectGovernedHardcodedOptions(content, dictValueMap);
        if (matches.length > 0) {
          findings.push({
            scope: target.id,
            label: target.label,
            level: target.level,
            filePath: path.relative(workspaceRoot, filePath).replaceAll('\\', '/'),
            matches,
          });
        }
      }
    }
  }

  return findings;
}

export function loadDictGovernanceReport(workspaceRoot = root) {
  const registryPath = path.join(workspaceRoot, 'libs/common-constants/src/dict-governance/registry.ts');
  const seedPath = path.join(workspaceRoot, 'apps/backend/prisma/seed.ts');
  const seedsDir = path.join(workspaceRoot, 'apps/backend/prisma/seeds');
  const initSqlPath = path.join(workspaceRoot, 'apps/backend/db/init.sql');

  const registryContent = readText(registryPath);
  const seedParts = [readText(seedPath)];
  for (const filePath of collectFiles(seedsDir)) {
    if (filePath.endsWith('.ts')) {
      seedParts.push(readText(filePath));
    }
  }
  const seedContent = seedParts.join('\n');
  const initSqlContent = readText(initSqlPath);

  const registryTypes = extractDictTypesFromContent(registryContent, [/dictType:\s*['"]([^'"]+)['"]/g]);
  const seedTypes = [
    ...extractDictTypesFromContent(seedContent, [/dictType:\s*['"]([^'"]+)['"]/g]),
    ...extractDictTypesFromContent(initSqlContent, [
      /INSERT INTO\s+"public"\."sys_dict_type"[\s\S]*?VALUES\s*\(\s*[^,]+,\s*'[^']*',\s*'[^']*',\s*'([^']+)'/g,
      /INSERT INTO\s+"public"\."sys_dict_data"[\s\S]*?VALUES\s*\(\s*[^,]+,\s*'[^']*',\s*\d+,\s*'[^']*',\s*'[^']*',\s*'([^']+)'/g,
    ]),
  ];
  const missingDictTypes = detectMissingDictTypes(registryTypes, seedTypes);
  const dictValueMap = extractDictValueMapFromInitSql(initSqlContent);

  const allHardcodedOptions = collectHardcodedOptionFindings(workspaceRoot, dictValueMap);
  const hardcodedOptions = allHardcodedOptions.filter((item) => item.level === 'fail');
  const advisoryHardcodedOptions = allHardcodedOptions.filter((item) => item.level !== 'fail');

  return {
    advisoryHardcodedOptions,
    allHardcodedOptions,
    hardcodedOptions,
    missingDictTypes,
    registryTypes,
    scanTargets: DEFAULT_SCAN_TARGETS,
    seedTypes,
  };
}

export function main(workspaceRoot = root) {
  const report = loadDictGovernanceReport(workspaceRoot);
  const failed = [];
  const warnings = [];

  if (report.missingDictTypes.length > 0) {
    warnings.push(`registry 缺失于 seed/init 的 dictType: ${report.missingDictTypes.join(', ')}`);
  }

  if (report.hardcodedOptions.length > 0) {
    const details = report.hardcodedOptions
      .map(
        (item) =>
          `${item.filePath}(${item.matches
            .map((match) => `${match.name}->${match.candidateDictTypes.join('|')}`)
            .join(', ')})`,
      )
      .join('; ');
    failed.push(`admin-web 存在可映射到治理字典的硬编码 Options: ${details}`);
  }

  if (report.advisoryHardcodedOptions.length > 0) {
    const details = report.advisoryHardcodedOptions
      .map(
        (item) =>
          `${item.filePath}(${item.matches
            .map((match) => `${match.name}->${match.candidateDictTypes.join('|')}`)
            .join(', ')})`,
      )
      .join('; ');
    warnings.push(`扩展扫描发现可映射到治理字典的硬编码 Options: ${details}`);
  }

  console.log('--- Dict Governance 校验结果 ---');
  for (const message of warnings) {
    console.log('⚠', message);
  }
  if (failed.length === 0) {
    console.log('✓ 字典治理检查通过');
    return { ok: true, failed: [], warnings, report };
  }

  for (const message of failed) {
    console.log('✗', message);
  }
  return { ok: false, failed, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = main();
  if (!result.ok) {
    process.exit(1);
  }
}
