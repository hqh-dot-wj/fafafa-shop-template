<script setup lang="ts">
/* eslint-disable vue/no-mutating-props, no-continue -- 发布向导父级传入的 formModel 由多步组件就地写回；规格同步处使用 continue 保持可读 */
import { computed, h, nextTick, ref, watch } from 'vue';
import type { DataTableColumns, SelectOption } from 'naive-ui';
import {
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NDataTable,
  NDivider,
  NDynamicTags,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  useMessage,
} from 'naive-ui';
import { Money } from '@/utils/money';
import { $t } from '@/locales';
import type { ProductForm } from '../model';

defineOptions({ name: 'Step3Sku' });

type SkuRow = Api.Pms.GlobalSkuOperate;

/**
 * DefineProps: 定义组件接收的属性
 * @property formModel - 表单数据模型，双向绑定用于存储生成的 SKU 数据
 * @property attributes - 从父组件传递过来的所有属性列表，用于筛选规格属性
 */
const props = defineProps<{
  formModel: ProductForm;
  attributes: Api.Pms.AttributeItem[];
}>();

/**
 * DefineEmits: 定义组件触发的事件
 * @event prev - 返回上一步
 * @event next - 进入下一步
 */
const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
}>();

/**
 * 计算属性: 筛选规格属性
 * 从所有属性中过滤出 usageType 为 'SPEC' (规格) 的属性
 * 这些属性将用于构建 SKU 的不同维度 (如颜色、尺寸)
 */
const specAttributes = computed(() => {
  const list = props.attributes;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((attr) => attr.usageType === 'SPEC');
});

/**
 * 响应式状态: SelectedSpecs
 * 用于存储用户在界面上选中的规格值
 * 结构: { [规格名称]: [选中的值1, 选中的值2] }
 * 例如: { "颜色": ["红色", "蓝色"], "尺寸": ["M", "L"] }
 */
const selectedSpecs = ref<Record<string, string[]>>({});
const message = useMessage();

/** 由 generateSkus 写回 specDef 时暂停「specDef → selectedSpecs」同步，避免与 selectedSpecs watch 震荡触发大量更新 */
let pauseSpecDefToSelectedSync = false;

/** 与 generateSkus 中 oldSkusMap 使用同一规则，避免 specValues 键顺序不同导致无法合并已保存 SKU */
function distFieldSuffix(isRatio: boolean, isFixed: boolean) {
  if (isRatio) return $t('page.pms.globalProductCreate.step3.suffixPercent');
  if (isFixed) return $t('page.pms.globalProductCreate.step3.suffixYuan');
  return '';
}

function stableSpecValuesKey(specValues: Record<string, unknown>): string {
  const entries = Object.entries(specValues).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== '',
  );
  entries.sort(([a], [b]) => a.localeCompare(b));
  const normalized: Record<string, string> = {};
  for (const [k, v] of entries) {
    normalized[k] = String(v).trim();
  }
  return JSON.stringify(normalized);
}

function snapshotSelectedFromSpecDef(): Record<string, string[]> {
  const specList = Array.isArray(props.formModel?.specDef) ? props.formModel.specDef : [];
  const next: Record<string, string[]> = {};
  for (const attr of specAttributes.value) {
    const key = attr?.name;
    if (key) {
      next[key] = [];
    }
  }
  for (const def of specList) {
    if (!def || typeof def !== 'object') {
      continue;
    }
    const name = typeof def.name === 'string' ? def.name : '';
    const raw = (def as { values?: unknown }).values;
    if (!name || !Array.isArray(raw) || raw.length === 0) {
      continue;
    }
    next[name] = raw.map((v) => String(v));
  }
  return next;
}

function isoSpecsSnapshot(map: Record<string, string[]>): string {
  const keys = Object.keys(map).sort();
  const o: Record<string, string[]> = {};
  for (const k of keys) {
    o[k] = [...(map[k] ?? [])].sort();
  }
  return JSON.stringify(o);
}

/**
 * 编辑回显：将 formModel.specDef 同步到勾选区，避免仅表格有 SKU 而复选框为空。
 */
watch(
  [() => specAttributes.value, () => props.formModel?.specDef],
  () => {
    if (pauseSpecDefToSelectedSync) {
      return;
    }
    if (specAttributes.value.length === 0) {
      return;
    }
    const next = snapshotSelectedFromSpecDef();
    if (isoSpecsSnapshot(next) === isoSpecsSnapshot(selectedSpecs.value)) {
      return;
    }
    selectedSpecs.value = next;
  },
  { deep: true, immediate: true },
);

/**
 * 监听 selectedSpecs 的变化
 * 当用户修改选中的规格时，自动重新生成 SKU 列表
 * @param {object} val - 变化后的规格选择对象
 * @param {object} old - 旧值
 */
watch(
  selectedSpecs,
  () => {
    pauseSpecDefToSelectedSync = true;
    try {
      generateSkus();
    } finally {
      nextTick(() => {
        pauseSpecDefToSelectedSync = false;
      });
    }
  },
  { deep: true },
);

/**
 * 核心方法: 生成 SKU 列表
 * 基于选中的规格属性及其值，计算笛卡尔积，生成所有可能的 SKU 组合
 */
function generateSkus() {
  // 1. 将 selectedSpecs 对象转换为 entries 数组，并过滤掉未选择值的规格
  // 结果示例: [['颜色', ['红色', '蓝色']], ['尺寸', ['M', 'L']]]
  const entries = Object.entries(selectedSpecs.value).filter(([_, values]) => values && values.length > 0);

  // 更新表单模型中的 specDef，记录当前的规格定义
  const nextSpecDef = entries.map(([name, values]) => ({ name, values }));
  const prevSpecDef = Array.isArray(props.formModel.specDef) ? props.formModel.specDef : [];
  const sameSpecDef =
    prevSpecDef.length === nextSpecDef.length &&
    prevSpecDef.every((row, i) => {
      const n = nextSpecDef[i];
      return row?.name === n?.name && JSON.stringify(row?.values ?? []) === JSON.stringify(n?.values ?? []);
    });
  if (!sameSpecDef) {
    props.formModel.specDef = nextSpecDef;
  }

  // 如果没有有效选择，清空 SKU 列表并返回
  if (entries.length === 0) {
    if (Array.isArray(props.formModel.specDef) && props.formModel.specDef.length > 0) {
      props.formModel.specDef = [];
    }
    props.formModel.skus = [];
    return;
  }

  // 2. 准备进行笛卡尔积计算的数据
  // names: ['颜色', '尺寸']
  // valueLists: [['红色', '蓝色'], ['M', 'L']]
  const names = entries.map((e) => e[0]);
  const valueLists = entries.map((e) => e[1]);

  const combinations = cartesian(valueLists);

  // 3. 生成最终的 SKU 对象列表
  // 为了保留用户之前输入的数据 (如价格、库存)，我们需要对比新旧 SKU
  const oldSkusMap = new Map<string, SkuRow>();
  const skus = Array.isArray(props.formModel.skus) ? props.formModel.skus : [];
  skus.forEach((sku) => {
    oldSkusMap.set(stableSpecValuesKey(sku.specValues as Record<string, unknown>), sku);
  });

  const newSkus = combinations.map((comboValues) => {
    const specValues: Record<string, string> = {};
    // 将组合值映射回规格名称
    // comboValues: ['红色', 'M'] -> specValues: { '颜色': '红色', '尺寸': 'M' }
    comboValues.forEach((val: string, idx: number) => {
      specValues[names[idx]] = val;
    });

    // 检查是否已存在相同的 SKU (保留原有数据)
    const key = stableSpecValuesKey(specValues);
    const existing = oldSkusMap.get(key);

    if (existing) {
      return existing;
    }

    // 如果是新组合，初始化一个 SKU 对象
    return {
      specValues,
      guidePrice: 0, // 指导价
      stock: 0, // 库存
      guideRate: 0, // 导购费率
      minDistRate: 0, // 最低比例
      maxDistRate: 50, // 最高比例
      distMode: 'NONE', // 分销模式
      skuCode: '', // SKU 编码
      pic: '', // 图片
      costPrice: 0, // 成本价
    };
  });

  // 更新表单模型的 SKU 列表
  props.formModel.skus = newSkus;
}

/**
 * 算法辅助函数: 笛卡尔积
 * 输入: [['A', 'B'], ['1', '2']]
 * 输出: [['A', '1'], ['A', '2'], ['B', '1'], ['B', '2']]
 * 用于生成多规格的所有组合
 */
function cartesian(arrays: string[][]): string[][] {
  return arrays.reduce(
    (acc, curr) => {
      return acc.flatMap((x) => curr.map((y) => [...x, y]));
    },
    [[]] as string[][],
  );
}

/**
 * 辅助函数: 获取属性的可选项
 * 处理从后端获取的 inputList 字符串 (逗号分隔)
 */
function getAttrOptions(attr: Api.Pms.AttributeItem): string[] {
  if (attr.inputList) {
    return attr.inputList.split(',').filter(Boolean);
  }
  return [];
}

const distModeOptions = computed<SelectOption[]>(() => [
  { label: $t('page.pms.globalProductCreate.step3.distNone'), value: 'NONE' },
  { label: $t('page.pms.globalProductCreate.step3.distRatio'), value: 'RATIO' },
  { label: $t('page.pms.globalProductCreate.step3.distFixed'), value: 'FIXED' },
]);

const batchGuidePrice = ref(0);
const batchGuideRate = ref(0);
const batchCostRate = ref(50);
const batchCostPrice = ref(0);
const batchMinRate = ref(0);
const batchMaxRate = ref(50);

function applyBatchGuidePrice() {
  if (props.formModel.skus.length === 0) return;
  props.formModel.skus.forEach((sku) => {
    sku.guidePrice = Number(batchGuidePrice.value || 0);
  });
  message.success($t('page.pms.globalProductCreate.step3.msgBatchGuidePrice'));
}

function applyBatchGuideRate() {
  if (props.formModel.skus.length === 0) return;
  props.formModel.skus.forEach((sku) => {
    if (sku.distMode === 'NONE') return;
    sku.guideRate = Number(batchGuideRate.value || 0);
  });
  message.success($t('page.pms.globalProductCreate.step3.msgBatchGuideRate'));
}

function applyBatchCostByRate() {
  if (props.formModel.skus.length === 0) return;
  const ratio = new Money(batchCostRate.value).div(100);
  props.formModel.skus.forEach((sku) => {
    sku.costPrice = new Money(sku.guidePrice).mul(ratio).toNumber();
  });
  message.success($t('page.pms.globalProductCreate.step3.msgBatchCostByRate'));
}

function applyBatchCostPrice() {
  if (props.formModel.skus.length === 0) return;
  props.formModel.skus.forEach((sku) => {
    sku.costPrice = Number(batchCostPrice.value || 0);
  });
  message.success($t('page.pms.globalProductCreate.step3.msgBatchCostPrice'));
}

function applyBatchMin() {
  if (props.formModel.skus.length === 0) return;
  props.formModel.skus.forEach((sku) => {
    sku.minDistRate = batchMinRate.value;
  });
  message.success($t('page.pms.globalProductCreate.step3.msgBatchMin'));
}

function applyBatchMax() {
  if (props.formModel.skus.length === 0) return;
  props.formModel.skus.forEach((sku) => {
    sku.maxDistRate = batchMaxRate.value;
  });
  message.success($t('page.pms.globalProductCreate.step3.msgBatchMax'));
}

function handleNext() {
  for (const sku of props.formModel.skus) {
    if (sku.distMode === 'NONE') continue;

    const specName = Object.values(sku.specValues).join('/');

    if (Number(sku.guideRate) < Number(sku.minDistRate)) {
      message.error(
        $t('page.pms.globalProductCreate.step3.msgGuideLow', {
          spec: specName,
          rate: String(sku.guideRate),
          min: String(sku.minDistRate),
        }),
      );
      return;
    }
    if (Number(sku.guideRate) > Number(sku.maxDistRate)) {
      message.error(
        $t('page.pms.globalProductCreate.step3.msgGuideHigh', {
          spec: specName,
          rate: String(sku.guideRate),
          max: String(sku.maxDistRate),
        }),
      );
      return;
    }
  }
  emit('next');
}

const columns = computed<DataTableColumns<SkuRow>>(() => {
  const cols: DataTableColumns<SkuRow> = [];
  const rawSpecDef = props.formModel.specDef;
  const specList = Array.isArray(rawSpecDef) ? rawSpecDef : [];
  const specKeys = specList.map((d) => d.name);

  specKeys.forEach((key) => {
    cols.push({
      title: key,
      key,
      render: (row) => {
        const sv = row.specValues as Record<string, unknown> | undefined;
        return sv?.[key] as string | number | undefined;
      },
    });
  });

  cols.push(
    {
      title: $t('page.pms.globalProductCreate.step3.colGuidePrice'),
      key: 'guidePrice',
      render(row, idx) {
        return h(NInputNumber, {
          value: row.guidePrice,
          onUpdateValue: (v: number | null) => {
            if (idx !== undefined) props.formModel.skus[idx].guidePrice = v ?? 0;
          },
          min: 0,
          precision: 2,
          size: 'small',
          showButton: false,
        });
      },
    },
    {
      title: $t('page.pms.globalProductCreate.step3.colCostPrice'),
      key: 'costPrice',
      render(row, idx) {
        return h(NInputNumber, {
          value: row.costPrice,
          onUpdateValue: (v: number | null) => {
            if (idx !== undefined) props.formModel.skus[idx].costPrice = v ?? 0;
          },
          min: 0,
          precision: 2,
          size: 'small',
          showButton: false,
        });
      },
    },
    {
      title: $t('page.pms.globalProductCreate.step3.colStock'),
      key: 'stock',
      render(row, idx) {
        return h(NInputNumber, {
          value: row.stock,
          onUpdateValue: (v: number | null) => {
            if (idx !== undefined) props.formModel.skus[idx].stock = v ?? 0;
          },
          min: 0,
          size: 'small',
          showButton: false,
        });
      },
    },
    {
      title: $t('page.pms.globalProductCreate.step3.colSkuCode'),
      key: 'skuCode',
      render(row, idx) {
        return h(NInput, {
          value: row.skuCode,
          onUpdateValue: (v: string) => {
            if (idx !== undefined) props.formModel.skus[idx].skuCode = v;
          },
          size: 'small',
        });
      },
    },
    {
      title: $t('page.pms.globalProductCreate.step3.colDistMode'),
      key: 'distMode',
      width: 140,
      render(row, idx) {
        return h(NSelect, {
          value: row.distMode,
          options: distModeOptions.value,
          onUpdateValue: (v: string) => {
            if (idx !== undefined) props.formModel.skus[idx].distMode = v;
          },
          size: 'small',
        });
      },
    },
    {
      title: $t('page.pms.globalProductCreate.step3.colMinDist'),
      key: 'minDistRate',
      width: 110,
      render(row, idx) {
        const isRatio = row.distMode === 'RATIO';
        const isFixed = row.distMode === 'FIXED';
        const isNone = row.distMode === 'NONE';
        return h(NInputNumber, {
          value: row.minDistRate,
          onUpdateValue: (v: number | null) => {
            if (idx !== undefined) props.formModel.skus[idx].minDistRate = v ?? 0;
          },
          min: 0,
          disabled: isNone,
          precision: 2,
          size: 'small',
          showButton: false,
          placeholder: $t('page.pms.globalProductCreate.step3.phMin'),
          suffix: () => distFieldSuffix(isRatio, isFixed),
        });
      },
    },
    {
      title: $t('page.pms.globalProductCreate.step3.colGuideRate'),
      key: 'guideRate',
      width: 110,
      render(row, idx) {
        const isRatio = row.distMode === 'RATIO';
        const isFixed = row.distMode === 'FIXED';
        const isNone = row.distMode === 'NONE';
        return h(NInputNumber, {
          value: row.guideRate,
          onUpdateValue: (v: number | null) => {
            if (idx !== undefined) props.formModel.skus[idx].guideRate = v ?? 0;
          },
          min: 0,
          disabled: isNone,
          precision: 2,
          size: 'small',
          showButton: false,
          placeholder: $t('page.pms.globalProductCreate.step3.phGuide'),
          status:
            Number(row.guideRate) < Number(row.minDistRate) || Number(row.guideRate) > Number(row.maxDistRate)
              ? 'error'
              : 'success',
          suffix: () => distFieldSuffix(isRatio, isFixed),
        });
      },
    },
    {
      title: $t('page.pms.globalProductCreate.step3.colMaxDist'),
      key: 'maxDistRate',
      width: 110,
      render(row, idx) {
        const isRatio = row.distMode === 'RATIO';
        const isFixed = row.distMode === 'FIXED';
        const isNone = row.distMode === 'NONE';
        return h(NInputNumber, {
          value: row.maxDistRate,
          onUpdateValue: (v: number | null) => {
            if (idx !== undefined) props.formModel.skus[idx].maxDistRate = v ?? 0;
          },
          min: 0,
          disabled: isNone,
          precision: 2,
          size: 'small',
          showButton: false,
          placeholder: $t('page.pms.globalProductCreate.step3.phMax'),
          suffix: () => distFieldSuffix(isRatio, isFixed),
        });
      },
    },
  );
  return cols;
});
</script>

<template>
  <div class="mx-auto max-w-5xl p-6">
    <NCard :title="$t('page.pms.globalProductCreate.step3.cardTitle')" bordered class="mb-4">
      <!-- 遍历所有规格属性，生成选择区域 -->
      <div v-for="attr in specAttributes" :key="attr.attrId" class="mb-6">
        <h4 class="mb-2 font-bold">{{ attr.name }}</h4>

        <!-- 输入类型 1: 从列表中选择 -->
        <div v-if="attr.inputType === 1">
          <NCheckboxGroup v-model:value="selectedSpecs[attr.name]">
            <div class="flex flex-wrap gap-4">
              <NCheckbox v-for="opt in getAttrOptions(attr)" :key="opt" :value="opt" :label="opt" />
            </div>
          </NCheckboxGroup>
        </div>

        <!-- 输入类型 2: 手工录入 (使用动态标签组件) -->
        <div v-else>
          <NDynamicTags v-model:value="selectedSpecs[attr.name]" />
        </div>
        <NDivider />
      </div>

      <!-- SKU 列表展示区域 -->
      <div v-if="formModel.skus.length > 0" class="mt-4">
        <div class="mb-2 flex items-center justify-between">
          <h4 class="font-bold">
            {{ $t('page.pms.globalProductCreate.step3.detailList', { count: formModel.skus.length }) }}
          </h4>
          <NSpace>
            <NInputNumber
              v-model:value="batchGuidePrice"
              size="small"
              :placeholder="$t('page.pms.globalProductCreate.step3.batchGuidePrice')"
              :min="0"
              :precision="2"
              :show-button="false"
            >
              <template #prefix>{{ $t('page.pms.globalProductCreate.step3.prefixGuide') }}:</template>
            </NInputNumber>
            <NButton size="small" @click="applyBatchGuidePrice">{{
              $t('page.pms.globalProductCreate.step3.applyGuidePrice')
            }}</NButton>

            <NInputNumber
              v-model:value="batchCostPrice"
              size="small"
              :placeholder="$t('page.pms.globalProductCreate.step3.batchCostPrice')"
              :min="0"
              :precision="2"
              :show-button="false"
            >
              <template #prefix>{{ $t('page.pms.globalProductCreate.step3.prefixCost') }}:</template>
            </NInputNumber>
            <NButton size="small" @click="applyBatchCostPrice">{{
              $t('page.pms.globalProductCreate.step3.applyCostPrice')
            }}</NButton>

            <NInputNumber
              v-model:value="batchCostRate"
              size="small"
              :placeholder="$t('page.pms.globalProductCreate.step3.batchCostRate')"
              :min="0"
              :max="100"
              :precision="2"
              :show-button="false"
            >
              <template #prefix>{{ $t('page.pms.globalProductCreate.step3.prefixCostPct') }}:</template>
            </NInputNumber>
            <NButton size="small" @click="applyBatchCostByRate">{{
              $t('page.pms.globalProductCreate.step3.applyCostByRate')
            }}</NButton>
          </NSpace>
        </div>
        <div class="mb-2 flex items-center justify-end">
          <NSpace>
            <NInputNumber
              v-model:value="batchGuideRate"
              size="small"
              :placeholder="$t('page.pms.globalProductCreate.step3.batchGuideRate')"
              :min="0"
              :precision="2"
              :show-button="false"
            >
              <template #prefix>{{ $t('page.pms.globalProductCreate.step3.prefixGuideRate') }}:</template>
            </NInputNumber>
            <NButton size="small" @click="applyBatchGuideRate">{{
              $t('page.pms.globalProductCreate.step3.applyGuideRate')
            }}</NButton>

            <NInputNumber
              v-model:value="batchMinRate"
              size="small"
              :placeholder="$t('page.pms.globalProductCreate.step3.batchMin')"
              :min="0"
              :precision="2"
              :show-button="false"
            >
              <template #prefix>{{ $t('page.pms.globalProductCreate.step3.prefixMin') }}:</template>
            </NInputNumber>
            <NButton size="small" @click="applyBatchMin">{{
              $t('page.pms.globalProductCreate.step3.applyMin')
            }}</NButton>

            <NInputNumber
              v-model:value="batchMaxRate"
              size="small"
              :placeholder="$t('page.pms.globalProductCreate.step3.batchMax')"
              :min="0"
              :precision="2"
              :show-button="false"
            >
              <template #prefix>{{ $t('page.pms.globalProductCreate.step3.prefixMax') }}:</template>
            </NInputNumber>
            <NButton size="small" @click="applyBatchMax">{{
              $t('page.pms.globalProductCreate.step3.applyMax')
            }}</NButton>
          </NSpace>
        </div>
        <!-- 动态表格，列由 columns 计算属性定义 -->
        <NDataTable :columns="columns" :data="formModel.skus" :pagination="false" size="small" />
      </div>
      <div v-else class="text-gray-400">{{ $t('page.pms.globalProductCreate.step3.emptyHint') }}</div>

      <!-- 底部操作按钮 -->
      <div class="mt-6 flex justify-between">
        <NButton @click="emit('prev')">{{ $t('page.pms.globalProductCreate.step3.prev') }}</NButton>
        <NButton type="primary" :disabled="formModel.skus.length === 0" @click="handleNext">{{
          $t('page.pms.globalProductCreate.step3.next')
        }}</NButton>
      </div>
    </NCard>
  </div>
</template>
