<script lang="ts" setup>
import defu from 'defu';
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, ref, useAttrs, watch } from 'vue';
import type { UmoEditorOptions } from '@umoteam/editor';
import { UmoEditor } from '@umoteam/editor';
import { fetchBatchDeleteOss, fetchUploadFile } from '@/service/api/system/oss';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';

/** 运行时暴露方法未完全体现在类型上 */
type UmoEditorInstance = InstanceType<typeof UmoEditor> & {
  getVanillaHTML?: () => Promise<string>;
};

defineOptions({
  name: 'UmoDocEditor',
});

const props = withDefaults(
  defineProps<{
    /**
     * 为 true 时允许工具栏「导入 Word」并加载 mammoth（需能访问 `cdnUrl` 下脚本，默认 unpkg）。
     * 默认 false：通过 `disableExtensions: ['import-word']` 彻底不挂载 ImportWord（仅 `importWord.enabled` 无效，见 umo 8.x 实现）。
     */
    allowImportWord?: boolean;
  }>(),
  { allowImportWord: false },
);

const attrs = useAttrs();

/** 由本组件提供，禁止从 attrs 透传覆盖，否则 Umo 选项校验会得到 undefined 或非函数 */
const UMO_CALLBACK_OPTION_KEYS = ['onSave', 'onFileUpload', 'onFileDelete'] as const;

const appStore = useAppStore();
const themeStore = useThemeStore();
const umoEditorRef = ref<UmoEditorInstance>();
const isSave = ref(false);

/**
 * KeepAlive 离开或卸载时 Umo 可能批量触发 file-delete：此时既不弹窗也不调 OSS 删除，避免误删与连环弹窗。
 * 正常编辑时由用户在编辑器内删图，不再弹确认框（打开编辑/同步 HTML 时也会误触 file-delete，弹窗体验差）。
 */
const suppressFileDeleteSideEffects = ref(false);

onDeactivated(() => {
  suppressFileDeleteSideEffects.value = true;
});

onBeforeUnmount(() => {
  suppressFileDeleteSideEffects.value = true;
});

onActivated(() => {
  suppressFileDeleteSideEffects.value = false;
});

/** 外部 v-model 写入并 setContent 后，Umo 可能短暂误报 file-delete，此窗口内不调 OSS 删除 */
const ignoreFileDeleteUntil = ref(0);

const value = defineModel<string>('value', { required: true, default: '' });

watch(
  value,
  () => {
    nextTick(() => {
      if (isSave.value) {
        isSave.value = false;
        return;
      }

      ignoreFileDeleteUntil.value = Date.now() + 600;
      const inst = umoEditorRef.value;
      if (!inst || typeof inst.setContent !== 'function') {
        return;
      }
      try {
        const ret = inst.setContent(value.value) as unknown;
        if (ret && typeof (ret as Promise<unknown>).then === 'function') {
          void (ret as Promise<unknown>).catch(() => {
            /* Umo 未就绪或内部取消，避免未捕获 Promise 刷屏 */
          });
        }
      } catch {
        /* 同步路径：editor is not ready 等 */
      }
    });
  },
  {
    immediate: true,
  },
);

watch(
  () => appStore.locale,
  () => {
    const inst = umoEditorRef.value;
    if (!inst || typeof inst.setLocale !== 'function') {
      return;
    }
    try {
      const ret = inst.setLocale(appStore.locale) as unknown;
      if (ret && typeof (ret as Promise<unknown>).then === 'function') {
        void (ret as Promise<unknown>).catch(() => {});
      }
    } catch {
      /* 编辑器未挂载完成 */
    }
  },
);

async function handleSave(content: { html: string }) {
  isSave.value = true;
  value.value = content.html;
  return true;
}

async function handleFileUpload(file: File) {
  try {
    const { data } = await fetchUploadFile(file);

    return {
      id: data.ossId,
      url: data.url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '上传失败';
    throw new Error(message, { cause: error });
  }
}

/** Umo 选项校验要求 onFileDelete 为普通 function；async 或仅模板监听合并时可能校验失败 */
function handleFileDelete(id: CommonType.IdType): boolean {
  if (suppressFileDeleteSideEffects.value || Date.now() < ignoreFileDeleteUntil.value) {
    return true;
  }
  const ossId = String(id ?? '').trim();
  if (!ossId) {
    return true;
  }
  void fetchBatchDeleteOss([ossId]).catch(() => {
    /* 失败由 request 统一提示 */
  });
  return true;
}

/**
 * Umo 8.x：`import-word` 在 mounted 拉 mammoth；`disableExtensions` 含 `import-word` 才不挂载。
 * 回调必须放在 options 里且为函数引用，避免 v-bind 与 v-on 合并出非法 `onFileDelete`。
 */
const editorOptions = computed<UmoEditorOptions>(() => {
  const incoming = { ...(attrs as Record<string, unknown>) };
  for (const k of UMO_CALLBACK_OPTION_KEYS) {
    delete incoming[k];
  }

  const parentDisabled = Array.isArray(incoming.disableExtensions)
    ? [...(incoming.disableExtensions as string[])]
    : [];
  delete incoming.disableExtensions;

  const disableExtensions = props.allowImportWord
    ? parentDisabled
    : parentDisabled.includes('import-word')
      ? parentDisabled
      : [...parentDisabled, 'import-word'];

  return defu(incoming, {
    importWord: { enabled: props.allowImportWord },
    disableExtensions,
    onSave: handleSave,
    onFileUpload: handleFileUpload,
    onFileDelete: handleFileDelete,
  }) as UmoEditorOptions;
});

async function getVanillaHTML(): Promise<string | undefined> {
  const inst = umoEditorRef.value;
  const fn = inst?.getVanillaHTML;
  if (typeof fn !== 'function') {
    return undefined;
  }
  return fn.call(inst);
}

defineExpose({
  saveContent: () => umoEditorRef.value?.saveContent(),
  getVanillaHTML,
});
</script>

<template>
  <div class="umo-editor size-full">
    <UmoEditor v-bind="editorOptions" ref="umoEditorRef" :theme="themeStore.darkMode ? 'dark' : 'light'" />
  </div>
</template>

<style>
body .flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

.umo-editor .flex-center {
  display: inherit !important;
  align-items: inherit !important;
  justify-content: inherit !important;
}
</style>
