import VueDevtools from 'vite-plugin-vue-devtools';

export function setupDevtoolsPlugin(viteEnv: Env.ImportMeta) {
  const { VITE_DEVTOOLS_LAUNCH_EDITOR, VITE_VUE_DEVTOOLS } = viteEnv;

  if (VITE_VUE_DEVTOOLS !== 'Y') {
    return null;
  }

  return VueDevtools({
    launchEditor: VITE_DEVTOOLS_LAUNCH_EDITOR,
  });
}
