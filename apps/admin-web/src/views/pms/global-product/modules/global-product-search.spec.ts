// quality-gate allow-source-string-test
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourcePath = path.resolve(process.cwd(), 'src/views/pms/global-product/modules/global-product-search.vue');
const source = fs.readFileSync(sourcePath, 'utf8');

describe('global-product-search 字典治理', () => {
  it('publish status 应来自字典消费', () => {
    expect(source).toContain(`useDict('pms_publish_status', true)`);
  });

  it('不应包含 ON_SHELF/OFF_SHELF fallback', () => {
    expect(source).not.toContain('ON_SHELF');
    expect(source).not.toContain('OFF_SHELF');
  });
});
