import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export function setupMonacoEditorPlugin(viteEnv: Env.ImportMeta) {
  const { VITE_MONACO_DEV } = viteEnv;

  if (VITE_MONACO_DEV !== 'Y') {
    return null;
  }

  return (monacoEditorPlugin as any).default({
    languageWorkers: ['editorWorkerService', 'css', 'html', 'json', 'typescript'],
  });
}
