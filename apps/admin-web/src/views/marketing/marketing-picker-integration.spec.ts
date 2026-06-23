// quality-gate allow-source-string-test
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('marketing picker integration', () => {
  it('instance search should use readonly member picker input', () => {
    const source = readSource('src/views/marketing/instance/modules/instance-search.vue');

    expect(source).toContain('MemberSelectModal');
    expect(source).toContain('memberDisplayValue');
    expect(source).toContain('readonly');
  });

  it('points accounts should use member picker for search and drawer display', () => {
    const source = readSource('src/views/marketing/points/accounts/index.vue');

    expect(source).toContain('MemberSelectModal');
    expect(source).toContain('memberDisplayValue');
    expect(source).toContain('adjustMemberDisplayName');
    expect(source).toContain('readonly');
  });

  it('resolution simulator should use member and product pickers with readonly selection input', () => {
    const source = readSource('src/views/marketing/resolution/simulator/index.vue');

    expect(source).toContain('MemberSelectModal');
    expect(source).toContain('ProductSelectModal');
    expect(source).toContain('tenantId');
    expect(source).toContain('memberDisplayValue');
    expect(source).toContain('productDisplayValue');
    expect(source).toContain('readonly');
  });

  it('entitlement pool should wire product/coupon/task pickers', () => {
    const source = readSource('src/views/marketing/entitlement-pool/index.vue');

    expect(source).toContain('ProductSelectModal');
    expect(source).toContain('CouponTemplateSelectModal');
    expect(source).toContain('PointsTaskSelectModal');
    expect(source).toContain('@pick-product');
    expect(source).toContain('@pick-coupon-template');
    expect(source).toContain('@pick-points-task');
  });

  it('legacy group-buy route chain should be removed', () => {
    const importsSource = readSource('src/router/elegant/imports.ts');
    const transformSource = readSource('src/router/elegant/transform.ts');
    const typingSource = readSource('src/typings/elegant-router.d.ts');
    const legacyPath = ['course-group', 'buy'].join('-');

    expect(importsSource).not.toContain(legacyPath);
    expect(transformSource).not.toContain(legacyPath);
    expect(typingSource).not.toContain(legacyPath);
  });
});
