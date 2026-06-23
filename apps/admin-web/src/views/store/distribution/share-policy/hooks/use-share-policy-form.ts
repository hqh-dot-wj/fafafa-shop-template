import { computed, reactive, ref } from 'vue';
import type { SelectOption } from 'naive-ui';
import { fetchGetSharePolicy, fetchUpdateSharePolicy } from '@/service/api/store/distribution';
import { $t } from '@/locales';

function createDefaultPolicy(): Api.Store.SharePolicy {
  return {
    id: 0,
    tenantId: '',
    linkExpireMinutes: 1440,
    maxClickCount: 100,
    maxBindCount: 20,
    maxOrderCount: 20,
    bindingMode: 'BOTH',
    attributionMode: 'LAST_TOUCH',
    attributionWindowMinutes: 10080,
    enableCrossTenantBind: false,
    isActive: true,
    createTime: '',
    updateTime: '',
  };
}

function normalizePolicy(source?: Partial<Api.Store.SharePolicy> | null): Api.Store.SharePolicy {
  const defaults = createDefaultPolicy();
  return { ...defaults, ...source };
}

export function useSharePolicyForm() {
  const loading = ref(false);
  const submitting = ref(false);
  const model = reactive<Api.Store.SharePolicy>(createDefaultPolicy());

  const bindingModeOptions = computed<SelectOption[]>(() => [
    { label: $t('page.store_distribution.sharePolicy.bindingModeRecommendCode'), value: 'RECOMMEND_CODE' },
    { label: $t('page.store_distribution.sharePolicy.bindingModeRelation'), value: 'RELATION' },
    { label: $t('page.store_distribution.sharePolicy.bindingModeBoth'), value: 'BOTH' },
  ]);

  const attributionModeOptions = computed<SelectOption[]>(() => [
    { label: $t('page.store_distribution.sharePolicy.attributionModeFirstTouch'), value: 'FIRST_TOUCH' },
    { label: $t('page.store_distribution.sharePolicy.attributionModeLastTouch'), value: 'LAST_TOUCH' },
    { label: $t('page.store_distribution.sharePolicy.attributionModeFirstBindLock'), value: 'FIRST_BIND_LOCK' },
  ]);

  async function loadPolicy() {
    loading.value = true;
    try {
      const { data } = await fetchGetSharePolicy();
      Object.assign(model, normalizePolicy(data));
    } catch {
      // request 层统一处理错误提示
    } finally {
      loading.value = false;
    }
  }

  async function submitPolicy() {
    submitting.value = true;
    try {
      const payload: Api.Store.UpdateSharePolicyDto = {
        linkExpireMinutes: model.linkExpireMinutes,
        maxClickCount: model.maxClickCount,
        maxBindCount: model.maxBindCount,
        maxOrderCount: model.maxOrderCount,
        bindingMode: model.bindingMode,
        attributionMode: model.attributionMode,
        attributionWindowMinutes: model.attributionWindowMinutes,
        enableCrossTenantBind: model.enableCrossTenantBind,
        isActive: model.isActive,
      };
      await fetchUpdateSharePolicy(payload);
      window.$message?.success($t('common.saveSuccess'));
      await loadPolicy();
    } catch {
      // request 层统一处理错误提示
    } finally {
      submitting.value = false;
    }
  }

  return {
    model,
    loading,
    submitting,
    bindingModeOptions,
    attributionModeOptions,
    loadPolicy,
    submitPolicy,
  };
}
