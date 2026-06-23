// quality-gate allow-source-string-test
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('vite dev plugin gating', () => {
  it('should gate heavy dev-only vite plugins behind env flags', () => {
    const devtools = fs.readFileSync(path.resolve(process.cwd(), 'vite/plugins/devtools.ts'), 'utf8');
    const monaco = fs.readFileSync(path.resolve(process.cwd(), 'vite/plugins/monaco-editor.ts'), 'utf8');
    const unplugin = fs.readFileSync(path.resolve(process.cwd(), 'vite/plugins/unplugin.ts'), 'utf8');

    expect(devtools).toContain('VITE_VUE_DEVTOOLS');
    expect(monaco).toContain('VITE_MONACO_DEV');
    expect(unplugin).toContain('autoInstall: false');
  });
});
