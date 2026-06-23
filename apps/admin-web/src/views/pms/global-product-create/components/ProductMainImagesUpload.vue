<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { UploadFileInfo, UploadProps } from 'naive-ui';
import { fetchBatchDeleteOss } from '@/service/api/system/oss';
import { getServiceBaseURL } from '@/utils/service';
import { getAdminUploadHeaders } from '@/utils/admin-upload-headers';
import { AcceptType } from '@/enum/business';

defineOptions({
  name: 'ProductMainImagesUpload',
});

interface Props {
  max?: number;
  fileSize?: number;
  action?: string;
}

const props = withDefaults(defineProps<Props>(), {
  max: 9,
  fileSize: 5,
  action: '/resource/oss/upload',
});

const modelValue = defineModel<string[]>('modelValue', { default: () => [] });

const fileList = ref<UploadFileInfo[]>([]);
/** 从父级同步 fileList 时跳过回写 model，避免循环 */
let syncingFromModel = false;

const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

const uploadHeaders = computed(() => getAdminUploadHeaders());

const accept = AcceptType.Image;

function urlsToFileList(urls: string[]): UploadFileInfo[] {
  return urls.map((url, index) => ({
    id: `legacy-url-${index}`,
    name: `主图${index + 1}`,
    status: 'finished' as const,
    url,
  }));
}

function isLegacyUploadId(id: string): boolean {
  return id.startsWith('legacy-url-');
}

let fileNum = 0;

watch(
  modelValue,
  (urls) => {
    const finishedUrls = fileList.value
      .filter((f) => f.status === 'finished' && Boolean(f.url))
      .map((f) => f.url as string);
    const same = finishedUrls.length === urls.length && finishedUrls.every((u, i) => u === urls[i]);
    if (same) {
      return;
    }
    const uploading = fileList.value.some((f) => f.status === 'uploading' || f.status === 'pending');
    if (uploading) {
      return;
    }
    syncingFromModel = true;
    fileList.value = urlsToFileList(urls);
    nextTick(() => {
      syncingFromModel = false;
    });
  },
  { immediate: true },
);

watch(
  fileList,
  () => {
    if (syncingFromModel) {
      return;
    }
    const urls = fileList.value.filter((f) => f.status === 'finished' && f.url).map((f) => f.url as string);
    const same = urls.length === modelValue.value.length && urls.every((u, i) => u === modelValue.value[i]);
    if (!same) {
      modelValue.value = urls;
    }
  },
  { deep: true },
);

function beforeUpload(options: { file: UploadFileInfo; fileList: UploadFileInfo[] }) {
  fileNum += 1;
  const { file } = options;
  const fileName = file.name.split('.');
  const fileExt = `.${fileName[fileName.length - 1]}`;
  const isTypeOk = accept.split(',').includes(fileExt);
  if (!isTypeOk) {
    window.$message?.error(`文件格式不正确, 请上传 ${accept.replaceAll(',', '/')} 格式文件!`);
    return false;
  }
  if (file.name.includes(',')) {
    window.$message?.error('文件名不正确，不能包含英文逗号!');
    return false;
  }
  if (props.fileSize && file.file?.size) {
    const isLt = file.file.size / 1024 / 1024 < props.fileSize;
    if (!isLt) {
      window.$message?.error(`上传文件大小不能超过 ${props.fileSize} MB!`);
      return false;
    }
  }
  return true;
}

function isErrorState(xhr: XMLHttpRequest) {
  try {
    const responseText = xhr?.responseText;
    if (!responseText) {
      return true;
    }
    const response = JSON.parse(responseText) as { code?: number };
    return response.code !== 200;
  } catch {
    return true;
  }
}

function handleFinish(options: { file: UploadFileInfo; event?: ProgressEvent }) {
  fileNum -= 1;
  const { file, event } = options;
  const target = event?.target as XMLHttpRequest | undefined;
  const responseText = target?.responseText;
  const response = JSON.parse(responseText ?? '{}') as { data?: Api.System.Oss };
  const oss = response.data;
  if (!oss) {
    return file;
  }
  const item = fileList.value.find((x) => x.id === file.id);
  if (item) {
    item.id = String(oss.ossId);
    item.url = oss.url;
    item.name = oss.fileName;
  }
  file.id = String(oss.ossId);
  file.url = oss.url;
  file.name = oss.fileName;
  if (fileNum === 0) {
    window.$message?.success('上传成功');
  }
  return file;
}

function handleError(options: { file: UploadFileInfo; event?: ProgressEvent }) {
  const { event } = options;
  const target = event?.target as XMLHttpRequest | undefined;
  const responseText = target?.responseText;
  try {
    const msg = JSON.parse(responseText ?? '{}') as { msg?: string };
    window.$message?.error(msg.msg ?? '上传失败');
  } catch {
    window.$message?.error('上传失败');
  }
}

async function handleRemove(file: UploadFileInfo): Promise<boolean> {
  if (file.status !== 'finished') {
    return true;
  }
  if (isLegacyUploadId(file.id)) {
    return true;
  }
  const ossId = String(file.id ?? '').trim();
  if (!ossId) {
    return true;
  }
  try {
    await fetchBatchDeleteOss([ossId]);
    window.$message?.success('删除成功');
    return true;
  } catch {
    return false;
  }
}

const uploadAttrs: UploadProps = {};
</script>

<template>
  <div class="w-full flex-col">
    <NUpload
      v-bind="uploadAttrs"
      v-model:file-list="fileList"
      :action="`${baseURL}${action}`"
      :headers="uploadHeaders"
      :max="max"
      :accept="accept"
      :multiple="max > 1"
      directory-dnd
      :default-upload="true"
      list-type="image-card"
      :is-error-state="isErrorState"
      @finish="handleFinish"
      @error="handleError"
      @before-upload="beforeUpload"
      @remove="({ file }) => handleRemove(file)"
    />
    <NP depth="3" class="mt-12px">
      请上传大小不超过
      <b class="text-red-500">{{ fileSize }}MB</b>
      的商品主图，最多 {{ max }} 张；首张将用于列表缩略图。
    </NP>
  </div>
</template>
