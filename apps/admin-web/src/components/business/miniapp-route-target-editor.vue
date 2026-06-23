<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NAlert, NFormItem, NGrid, NGridItem, NInput, NSelect } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import {
  MARKETING_ROUTE_TARGETS,
  buildMarketingRoutePath,
  getMarketingRouteTargetByKey,
  parseMarketingRoutePath,
} from '@libs/common-constants';

defineOptions({ name: 'MiniappRouteTargetEditor' });

// 小程序营销路由编辑器和 miniapp-client/src/utils/marketing-route.ts 使用同一份 common-constants 白名单。
// 后台只生成受控 path，C 端再解析一次，形成配置端与运行端双重校验。
const props = withDefaults(
  defineProps<{
    modelValue?: string;
    disabled?: boolean;
    defaultTargetKey?: string;
  }>(),
  {
    modelValue: '',
    disabled: false,
    defaultTargetKey: 'product_list',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:valid': [value: boolean];
}>();

const targetOptions: SelectOption[] = MARKETING_ROUTE_TARGETS.map((item) => ({
  label: `${item.name} (${item.routeName})`,
  value: item.key,
}));

const targetKey = ref<string>('');
const paramsModel = reactive<Record<string, string>>({});
const hintMessage = ref('');
const internalSyncing = ref(false);

const currentTarget = computed(() => {
  if (!targetKey.value) return undefined;
  return getMarketingRouteTargetByKey(targetKey.value);
});

const targetDescription = computed(() => currentTarget.value?.description || '');

function ensureParamKeys() {
  const spec = currentTarget.value;
  if (!spec) return;
  // 切换目标页面时删除旧页面参数，只保留当前目标定义里的字段。
  const specKeys = new Set(spec.params.map((item) => item.key));

  for (const key of Object.keys(paramsModel)) {
    if (!specKeys.has(key)) {
      Reflect.deleteProperty(paramsModel, key);
    }
  }

  for (const item of spec.params) {
    if (paramsModel[item.key] === undefined) {
      paramsModel[item.key] = item.defaultValue || '';
    }
  }
}

function hydrateFromPath(path: string) {
  const parsed = parseMarketingRoutePath(path);
  if (!parsed.valid || !parsed.targetKey) {
    // 历史脏路由不强行覆盖，先提示运营重新选择白名单目标。
    hintMessage.value = path.trim() ? parsed.reason || '路由解析失败，请重新选择白名单路由' : '';
    if (!targetKey.value) {
      targetKey.value = props.defaultTargetKey || MARKETING_ROUTE_TARGETS[0]?.key || '';
      ensureParamKeys();
    }
    return;
  }

  hintMessage.value = '';
  targetKey.value = parsed.targetKey;
  ensureParamKeys();

  const nextParams = parsed.params ?? {};
  for (const key of Object.keys(paramsModel)) {
    paramsModel[key] = nextParams[key] ?? paramsModel[key] ?? '';
  }
}

const previewPath = computed(() => {
  if (!targetKey.value) return '';
  return buildMarketingRoutePath(targetKey.value, paramsModel);
});

const validation = computed(() => {
  return parseMarketingRoutePath(previewPath.value);
});

watch(
  () => props.modelValue,
  (value) => {
    if (internalSyncing.value) return;
    hydrateFromPath(value || '');
  },
  { immediate: true },
);

watch(targetKey, () => {
  ensureParamKeys();
});

watch(
  [targetKey, () => JSON.stringify(paramsModel)],
  () => {
    const nextPath = previewPath.value;
    internalSyncing.value = true;
    emit('update:modelValue', nextPath);
    emit('update:valid', validation.value.valid);
    queueMicrotask(() => {
      internalSyncing.value = false;
    });
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex flex-col gap-12px">
    <NFormItem label="跳转页面">
      <NSelect v-model:value="targetKey" :disabled="disabled" :options="targetOptions" placeholder="请选择白名单路由" />
    </NFormItem>

    <NAlert v-if="targetDescription" type="info" :show-icon="false" :bordered="false">
      {{ targetDescription }}
    </NAlert>

    <NGrid v-if="currentTarget?.params.length" :cols="2" :x-gap="12" :y-gap="8">
      <NGridItem v-for="param in currentTarget?.params" :key="param.key">
        <NFormItem :label="param.label">
          <NInput
            v-model:value="paramsModel[param.key]"
            :disabled="disabled"
            :placeholder="param.required ? '必填' : '选填'"
          />
        </NFormItem>
      </NGridItem>
    </NGrid>

    <NFormItem label="路由预览">
      <NInput :value="previewPath" readonly placeholder="自动生成路由" />
    </NFormItem>

    <NAlert v-if="hintMessage" type="warning" :show-icon="false">
      {{ hintMessage }}
    </NAlert>
    <NAlert v-else-if="!validation.valid" type="warning" :show-icon="false">
      {{ validation.reason || '当前路由参数不完整' }}
    </NAlert>
  </div>
</template>
