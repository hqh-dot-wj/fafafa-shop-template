import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findMissingReasons } from './check-forwardref-reason.mjs';

test('findMissingReasons flags forwardRef without @reason comment', () => {
  const code = `
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [forwardRef(() => UserModule)],
})
export class RoleModule {}
`;
  const findings = findMissingReasons(code);
  assert.equal(findings.length, 1);
  assert.match(findings[0].text, /forwardRef/);
});

test('findMissingReasons accepts forwardRef with @reason comment on previous line', () => {
  const code = `
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    // @reason: User <-> Role multi-to-multi inherent bidirectional dependency
    forwardRef(() => UserModule),
  ],
})
export class RoleModule {}
`;
  const findings = findMissingReasons(code);
  assert.equal(findings.length, 0);
});

test('findMissingReasons accepts @reason within 3-line window', () => {
  const code = `
// @reason: legacy module boundary
@Module({
  imports: [forwardRef(() => UserModule)],
})
export class RoleModule {}
`;
  const findings = findMissingReasons(code);
  assert.equal(findings.length, 0);
});

test('findMissingReasons reports multiple unannotated forwardRefs separately', () => {
  const code = `
@Module({
  imports: [forwardRef(() => AModule), forwardRef(() => BModule)],
})
class X {}

@Module({
  imports: [forwardRef(() => CModule)],
})
class Y {}
`;
  const findings = findMissingReasons(code);
  // Single line with two forwardRefs counted once (per-line based)
  assert.equal(findings.length, 2);
});

test('findMissingReasons skips when there is no forwardRef', () => {
  const code = `
@Module({ imports: [UserModule, RoleModule] })
export class X {}
`;
  assert.equal(findMissingReasons(code).length, 0);
});

test('findMissingReasons ignores DI-style forwardRef(() => XxxService) — only Module form is in scope', () => {
  const code = `
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { DeptService } from '../dept/dept.service';

@Injectable()
export class PostService {
  constructor(
    @Inject(forwardRef(() => DeptService))
    private readonly deptService: DeptService,
  ) {}
}
`;
  assert.equal(findMissingReasons(code).length, 0);
});

test('findMissingReasons ignores arbitrary non-Module forwardRef targets', () => {
  const code = `
const factory = forwardRef(() => SomeProvider);
const lazy = forwardRef(() => buildThing());
`;
  assert.equal(findMissingReasons(code).length, 0);
});

test('findMissingReasons still flags Module form without @reason', () => {
  const code = `
@Module({
  imports: [forwardRef(() => UserModule)],
})
export class RoleModule {}
`;
  const findings = findMissingReasons(code);
  assert.equal(findings.length, 1);
  assert.match(findings[0].text, /UserModule/);
});

test('findMissingReasons flags require-based Module forwardRef', () => {
  const code = `
@Module({
  imports: [
    forwardRef(() => require('../../marketing/marketing.module').MarketingModule),
  ],
})
export class ClientOrderModule {}
`;
  const findings = findMissingReasons(code);
  assert.equal(findings.length, 1);
  assert.match(findings[0].text, /forwardRef/);
});

test('findMissingReasons flags block callback Module forwardRef', () => {
  const code = `
@Module({
  imports: [
    forwardRef(() => {
      return require('../../../client/order/order.module').ClientOrderModule;
    }),
  ],
})
export class CouponDistributionModule {}
`;
  const findings = findMissingReasons(code);
  assert.equal(findings.length, 1);
  assert.match(findings[0].text, /forwardRef/);
});

test('findMissingReasons accepts @reason before block callback Module forwardRef', () => {
  const code = `
@Module({
  imports: [
    // @reason: legacy module cycle needs dynamic import until order port lands
    forwardRef(() => {
      return require('../../../client/order/order.module').ClientOrderModule;
    }),
  ],
})
export class CouponDistributionModule {}
`;
  assert.equal(findMissingReasons(code).length, 0);
});
