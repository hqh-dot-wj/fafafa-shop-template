// quality-gate allow-source-string-test
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('vite optimizeDeps', () => {
  it('should pre-bundle dependencies used by lazy routes', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');

    expect(source).toContain('@amap/amap-jsapi-loader');
    expect(source).toContain('@vue-flow/core');
    expect(source).toContain('cron-parser');
    expect(source).toContain('dagre');
    expect(source).toContain('highlight.js/lib/core');
    expect(source).toContain('highlight.js/lib/languages/json');
    expect(source).toContain('vue-advanced-cropper');
    expect(source).toContain('vue-draggable-plus');
  });
});
