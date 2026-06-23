// quality-gate allow-source-string-test
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const marketingRoot = path.resolve(process.cwd(), 'src/views/marketing');

function collectSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    if (!/\.(vue|ts|tsx)$/.test(entry.name) || /\.spec\.ts$/.test(entry.name)) {
      return [];
    }
    return [fullPath];
  });
}

function relativeSourcePath(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, '/');
}

describe('marketing json display', () => {
  it('marketing views should not render raw object data as json text', () => {
    const bannedPatterns = [
      'JSON.stringify',
      'formatJson',
      'JSON 编辑',
      '配置JSON',
      '规则JSON',
      'extraData(JSON)',
      '（JSON）',
      '输出 JSON Schema',
    ];
    const offenders = collectSourceFiles(marketingRoot).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return bannedPatterns
        .filter(pattern => source.includes(pattern))
        .map(pattern => `${relativeSourcePath(filePath)} -> ${pattern}`);
    });

    expect(offenders).toEqual([]);
  });
});
