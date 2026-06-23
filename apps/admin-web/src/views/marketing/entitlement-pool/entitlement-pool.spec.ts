// quality-gate allow-source-string-test
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('entitlement pool workspace', () => {
  it('should mount product/coupon/points pickers in workspace page', () => {
    const source = readSource('src/views/marketing/entitlement-pool/index.vue');

    expect(source).toContain('ProductSelectModal');
    expect(source).toContain('CouponTemplateSelectModal');
    expect(source).toContain('PointsTaskSelectModal');
  });

  it('should keep notification/share out of selectable touchpoint options', () => {
    const source = readSource('src/views/marketing/entitlement-pool/modules/entitlement-pool-operate-drawer.vue');

    expect(source).toContain("value: 'audience'");
    expect(source).toContain("value: 'product'");
    expect(source).toContain("value: 'coupon'");
    expect(source).toContain("value: 'points'");
    expect(source).not.toContain("value: 'notification'");
    expect(source).not.toContain("value: 'share'");
  });
});
