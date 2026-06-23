/**
 * Property 5: checkP13 文档校验正确性
 * **Validates: Requirements 9.2, 9.3, 9.4**
 *
 * 形式化规约:
 *   function checkRequiredDocs(rootDir, requiredPaths) → { missing, present }
 *   - missing ∪ present = requiredPaths (complete coverage)
 *   - missing ∩ present = ∅ (mutually exclusive)
 *   - ∀ p ∈ present: fs.existsSync(path.join(rootDir, p)) = true
 *   - ∀ p ∈ missing: fs.existsSync(path.join(rootDir, p)) = false
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { REQUIRED_DOCS, checkRequiredDocs } from './check-required-docs.mjs';

/**
 * 创建临时目录，在其中按 existingDocs 创建文件，执行断言，最后清理。
 */
function withTmpDir(existingDocs, assertion) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p13-test-'));
  try {
    for (const doc of existingDocs) {
      const fullPath = path.join(tmpDir, doc);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, '');
    }
    assertion(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Arbitrary: 从 REQUIRED_DOCS 中随机选取一个子集作为"存在的文档"
 */
const existingSubsetArb = fc.subarray(REQUIRED_DOCS, { minLength: 0 });

describe('Property 5: checkP13 文档校验正确性', () => {
  it('missing ∪ present = requiredPaths（完整覆盖）', () => {
    fc.assert(
      fc.property(existingSubsetArb, (existingDocs) => {
        withTmpDir(existingDocs, (tmpDir) => {
          const { missing, present } = checkRequiredDocs(tmpDir, REQUIRED_DOCS);
          const union = [...missing, ...present].sort();
          const expected = [...REQUIRED_DOCS].sort();
          expect(union).toEqual(expected);
        });
      }),
      { numRuns: 100 },
    );
  });

  it('missing ∩ present = ∅（互斥）', () => {
    fc.assert(
      fc.property(existingSubsetArb, (existingDocs) => {
        withTmpDir(existingDocs, (tmpDir) => {
          const { missing, present } = checkRequiredDocs(tmpDir, REQUIRED_DOCS);
          const intersection = missing.filter((p) => present.includes(p));
          expect(intersection).toEqual([]);
        });
      }),
      { numRuns: 100 },
    );
  });

  it('∀ p ∈ present: 文件确实存在于文件系统', () => {
    fc.assert(
      fc.property(existingSubsetArb, (existingDocs) => {
        withTmpDir(existingDocs, (tmpDir) => {
          const { present } = checkRequiredDocs(tmpDir, REQUIRED_DOCS);
          for (const p of present) {
            expect(fs.existsSync(path.join(tmpDir, p))).toBe(true);
          }
        });
      }),
      { numRuns: 100 },
    );
  });

  it('∀ p ∈ missing: 文件确实不存在于文件系统', () => {
    fc.assert(
      fc.property(existingSubsetArb, (existingDocs) => {
        withTmpDir(existingDocs, (tmpDir) => {
          const { missing } = checkRequiredDocs(tmpDir, REQUIRED_DOCS);
          for (const p of missing) {
            expect(fs.existsSync(path.join(tmpDir, p))).toBe(false);
          }
        });
      }),
      { numRuns: 100 },
    );
  });

  it('missing 非空时应报告失败（对应 Req 9.4）', () => {
    fc.assert(
      fc.property(fc.subarray(REQUIRED_DOCS, { minLength: 0, maxLength: REQUIRED_DOCS.length - 1 }), (existingDocs) => {
        withTmpDir(existingDocs, (tmpDir) => {
          const { missing } = checkRequiredDocs(tmpDir, REQUIRED_DOCS);

          // 当不是所有文档都存在时，missing 应非空
          expect(missing.length).toBeGreaterThan(0);

          // 每个 missing 项都应是 REQUIRED_DOCS 中的有效路径
          for (const m of missing) {
            expect(REQUIRED_DOCS).toContain(m);
          }
        });
      }),
      { numRuns: 100 },
    );
  });

  it('所有文档存在时 missing 为空（对应 Req 9.3）', () => {
    withTmpDir(REQUIRED_DOCS, (tmpDir) => {
      const { missing, present } = checkRequiredDocs(tmpDir, REQUIRED_DOCS);
      expect(missing).toEqual([]);
      expect(present.sort()).toEqual([...REQUIRED_DOCS].sort());
    });
  });
});
