import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  collectInternalImportBoundaryIssues,
  getImportSpecifiersFromSource,
} from './verify-monorepo.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function withWorkspace(files, assertion) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-monorepo-'));
  const packages = {
    'apps/backend': {
      name: '@apps/backend',
      private: true,
      dependencies: {},
    },
    'apps/admin-web': {
      name: '@apps/admin-web',
      private: true,
      dependencies: {
        '@libs/common-constants': 'workspace:*',
        '@libs/common-utils': 'workspace:*',
      },
    },
    'libs/common-utils': {
      name: '@libs/common-utils',
      private: true,
      exports: {
        '.': './src/index.ts',
      },
    },
    'libs/common-constants': {
      name: '@libs/common-constants',
      private: true,
      exports: {
        '.': './src/index.ts',
        './regex': './src/regex.ts',
      },
    },
    'apps/admin-web/packages/hooks': {
      name: '@sa/hooks',
      private: true,
      dependencies: {},
      exports: {
        '.': './src/index.ts',
      },
    },
  };

  try {
    for (const [dir, pkg] of Object.entries(packages)) {
      writeJson(path.join(tmpDir, dir, 'package.json'), pkg);
    }
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }

    assertion(tmpDir, Object.keys(packages));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test('getImportSpecifiersFromSource 只提取真实 import/export/require specifier', () => {
  const content = [
    "import { foo } from '@libs/common-utils';",
    "export { bar } from '@libs/common-constants/regex';",
    "const mod = await import('@sa/hooks');",
    "const legacy = require('@apps/backend');",
    "// import { ignored } from '@apps/admin-web';",
  ].join('\n');

  assert.deepEqual(getImportSpecifiersFromSource(content), [
    '@libs/common-utils',
    '@libs/common-constants/regex',
    '@sa/hooks',
    '@apps/backend',
  ]);
});

test('collectInternalImportBoundaryIssues 禁止 app 之间直接源码引用', () => {
  withWorkspace(
    {
      'apps/admin-web/src/bad.ts': "import { bootstrap } from '@apps/backend/src/main';\n",
    },
    (tmpDir, workspaceDirs) => {
      const issues = collectInternalImportBoundaryIssues(tmpDir, workspaceDirs);

      assert.equal(issues.length, 1);
      assert.equal(issues[0].ruleId, 'app-to-app-import');
      assert.equal(issues[0].specifier, '@apps/backend/src/main');
    },
  );
});

test('collectInternalImportBoundaryIssues 禁止相对路径跨包源码引用', () => {
  withWorkspace(
    {
      'apps/admin-web/src/bad.ts': "import { bootstrap } from '../../backend/src/main';\n",
    },
    (tmpDir, workspaceDirs) => {
      const issues = collectInternalImportBoundaryIssues(tmpDir, workspaceDirs);

      assert.equal(issues.length, 1);
      assert.equal(issues[0].ruleId, 'relative-cross-package-import');
      assert.equal(issues[0].specifier, '../../backend/src/main');
    },
  );
});

test('collectInternalImportBoundaryIssues 禁止 libs 反向依赖 apps', () => {
  withWorkspace(
    {
      'libs/common-utils/src/bad.ts': "import { bootstrap } from '@apps/backend';\n",
    },
    (tmpDir, workspaceDirs) => {
      const issues = collectInternalImportBoundaryIssues(tmpDir, workspaceDirs);

      assert.equal(issues.length, 1);
      assert.equal(issues[0].ruleId, 'libs-to-app-import');
      assert.equal(issues[0].specifier, '@apps/backend');
    },
  );
});

test('collectInternalImportBoundaryIssues 禁止跨包引用未导出的内部路径', () => {
  withWorkspace(
    {
      'apps/admin-web/src/bad.ts': "import { secret } from '@libs/common-constants/internal/secret';\n",
    },
    (tmpDir, workspaceDirs) => {
      const issues = collectInternalImportBoundaryIssues(tmpDir, workspaceDirs);

      assert.equal(issues.length, 1);
      assert.equal(issues[0].ruleId, 'unexported-internal-subpath');
      assert.equal(issues[0].specifier, '@libs/common-constants/internal/secret');
    },
  );
});

test('collectInternalImportBoundaryIssues 禁止未声明依赖的内部包引用', () => {
  withWorkspace(
    {
      'apps/backend/src/bad.ts': "import { DICT_GOVERNANCE_REGISTRY } from '@libs/common-constants';\n",
    },
    (tmpDir, workspaceDirs) => {
      const issues = collectInternalImportBoundaryIssues(tmpDir, workspaceDirs);

      assert.equal(issues.length, 1);
      assert.equal(issues[0].ruleId, 'undeclared-internal-dependency');
      assert.equal(issues[0].specifier, '@libs/common-constants');
    },
  );
});

test('collectInternalImportBoundaryIssues 允许声明依赖并通过 exports 暴露的子路径', () => {
  withWorkspace(
    {
      'apps/admin-web/src/good.ts': "import { REGEXP_EMAIL } from '@libs/common-constants/regex';\n",
    },
    (tmpDir, workspaceDirs) => {
      const issues = collectInternalImportBoundaryIssues(tmpDir, workspaceDirs);

      assert.deepEqual(issues, []);
    },
  );
});

test('collectInternalImportBoundaryIssues 允许 admin-web 应用层依赖 @sa 内部包', () => {
  withWorkspace(
    {
      'apps/admin-web/src/good.ts': "import { useLoading } from '@sa/hooks';\n",
    },
    (tmpDir, workspaceDirs) => {
      const adminPkgPath = path.join(tmpDir, 'apps/admin-web/package.json');
      const adminPkg = JSON.parse(fs.readFileSync(adminPkgPath, 'utf8'));
      adminPkg.dependencies['@sa/hooks'] = 'workspace:*';
      writeJson(adminPkgPath, adminPkg);

      const issues = collectInternalImportBoundaryIssues(tmpDir, workspaceDirs);

      assert.deepEqual(issues, []);
    },
  );
});

test('collectInternalImportBoundaryIssues 禁止 @sa 内部包反向依赖 admin-web 应用层', () => {
  withWorkspace(
    {
      'apps/admin-web/packages/hooks/src/bad.ts': "import { useAuthStore } from '@apps/admin-web';\n",
    },
    (tmpDir, workspaceDirs) => {
      const issues = collectInternalImportBoundaryIssues(tmpDir, workspaceDirs);

      assert.equal(issues.length, 1);
      assert.equal(issues[0].ruleId, 'sa-to-admin-app-import');
      assert.equal(issues[0].specifier, '@apps/admin-web');
    },
  );
});

test('collectInternalImportBoundaryIssues 禁止非 admin-web 包依赖 @sa 内部包', () => {
  withWorkspace(
    {
      'apps/backend/src/bad.ts': "import { useLoading } from '@sa/hooks';\n",
    },
    (tmpDir, workspaceDirs) => {
      const backendPkgPath = path.join(tmpDir, 'apps/backend/package.json');
      const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8'));
      backendPkg.dependencies['@sa/hooks'] = 'workspace:*';
      writeJson(backendPkgPath, backendPkg);

      const issues = collectInternalImportBoundaryIssues(tmpDir, workspaceDirs);

      assert.equal(issues.length, 1);
      assert.equal(issues[0].ruleId, 'non-admin-sa-import');
      assert.equal(issues[0].specifier, '@sa/hooks');
    },
  );
});
