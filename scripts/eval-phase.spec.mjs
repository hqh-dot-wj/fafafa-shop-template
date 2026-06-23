import assert from 'node:assert/strict';
import test from 'node:test';

import { extractCommands, extractPhaseSection, findOutOfScopeFiles, parseFrontmatter } from './eval-phase.mjs';

const samplePlan = `---
current_phase: 1
---

### Phase 1 — test

- **范围**：\`docs/governance/**\`
- **DoD**：
  - \`pnpm harness:docs\`
  - \`pnpm harness:manifest:check\`
`;

test('parseFrontmatter reads current_phase', () => {
  assert.equal(parseFrontmatter(samplePlan).current_phase, '1');
});

test('extractCommands finds pnpm DoD commands', () => {
  const section = extractPhaseSection(samplePlan, 1);
  const commands = extractCommands(section);
  assert.deepEqual(commands, ['pnpm harness:docs', 'pnpm harness:manifest:check']);
});

test('findOutOfScopeFiles flags paths outside scope', () => {
  const section = extractPhaseSection(samplePlan, 1);
  const prefixes = ['docs/governance/'];
  const out = findOutOfScopeFiles(['docs/governance/HARNESS_ROADMAP.md', 'apps/backend/src/a.ts'], prefixes);
  assert.deepEqual(out, ['apps/backend/src/a.ts']);
});
