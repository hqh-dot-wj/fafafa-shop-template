import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const eslintPackagePath = require.resolve('eslint/package.json');
const eslintBinPath = path.join(path.dirname(eslintPackagePath), 'bin', 'eslint.js');
const ignoredPatterns = [
  'e2e/**',
  'scripts/**',
  'src/views/**',
  'src/locales/**',
  'src/typings/**/*.d.ts',
  'src/components/custom/**/*.vue',
  'src/components/drag-upload-overlay/**',
  'src/hooks/business/download.ts',
  'src/service/api/pms/product.ts',
  'src/service/request/index.ts',
  'src/store/modules/auth/**',
  'src/store/modules/route/**',
  'tsconfig.typecheck.json',
];
const args = ['.'];

for (const pattern of ignoredPatterns) {
  args.push('--ignore-pattern', pattern);
}

const result = spawnSync(process.execPath, [eslintBinPath, ...args], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
