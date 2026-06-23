import { computed, h, reactive, ref, watch } from 'vue';
import type { DataTableColumns, SelectOption } from 'naive-ui';
import { NTag } from 'naive-ui';
import type { MemberPickerSelection, ProductPickerSelection } from '@/components/business/entity-picker.shared';
import { fetchCreateShareQrcode, fetchCreateShareToken, fetchGetShareTokenLogs } from '@/service/api/store/distribution';
import { $t } from '@/locales';

function createDefaultTokenForm(): Api.Store.CreateShareTokenDto {
  return {
    shareUserId: '',
    bizType: 'PRODUCT',
    bizId: '',
    linkExpireMinutes: 1440,
    maxClickCount: 100,
    maxBindCount: 20,
    maxOrderCount: 20,
  };
}

function createDefaultLogQuery(): Api.Store.ListShareTokenLogDto {
  return {
    pageNum: 1,
    pageSize: 10,
    sid: undefined,
    eventType: undefined,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function pickString(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized;
}

function resolveDisplayName(metadata: Api.Store.ShareTokenLog['metadata'], keys: string[]): string {
  const record = toRecord(metadata);
  for (const key of keys) {
    const text = pickString(record[key]);
    if (text) return text;
  }
  return '';
}

function formatMemberLabel(memberId: string | undefined, displayName: string): string {
  if (!memberId) return '-';
  if (!displayName || displayName === memberId) return memberId;
  return `${displayName} (${memberId})`;
}

const eventTypeTagType: Record<Api.Store.ShareEventType, NaiveUI.ThemeColor> = {
  CLICK: 'info',
  BIND: 'success',
  ORDER_ATTRIBUTED: 'primary',
  EXPIRED_HIT: 'warning',
  LIMIT_HIT: 'error',
  INVALID_HIT: 'warning',
  MANUAL_DISABLE: 'default',
};

export function useShareTokenTools() {
  const creating = ref(false);
  const creatingQrcode = ref(false);
  const logLoading = ref(false);
  const logTotal = ref(0);
  const shareUserPickerVisible = ref(false);
  const productPickerVisible = ref(false);
  const shareUserDisplayValue = ref('');
  const bizDisplayValue = ref('');

  const formModel = reactive<Api.Store.CreateShareTokenDto>(createDefaultTokenForm());
  const logQuery = reactive<Api.Store.ListShareTokenLogDto>(createDefaultLogQuery());
  const currentToken = ref<Api.Store.ShareToken | null>(null);
  const qrcodeUrl = ref('');
  const logs = ref<Api.Store.ShareTokenLog[]>([]);

  const bizTypeOptions = computed<SelectOption[]>(() => [
    { label: $t('page.store_distribution.shareTools.bizTypeProduct'), value: 'PRODUCT' },
    { label: $t('page.store_distribution.shareTools.bizTypeActivity'), value: 'ACTIVITY' },
    { label: $t('page.store_distribution.shareTools.bizTypePage'), value: 'PAGE' },
  ]);

  const eventTypeOptions = computed<SelectOption[]>(() => [
    { label: $t('page.store_distribution.shareTools.eventTypeClick'), value: 'CLICK' },
    { label: $t('page.store_distribution.shareTools.eventTypeBind'), value: 'BIND' },
    { label: $t('page.store_distribution.shareTools.eventTypeOrderAttributed'), value: 'ORDER_ATTRIBUTED' },
    { label: $t('page.store_distribution.shareTools.eventTypeExpiredHit'), value: 'EXPIRED_HIT' },
    { label: $t('page.store_distribution.shareTools.eventTypeLimitHit'), value: 'LIMIT_HIT' },
    { label: $t('page.store_distribution.shareTools.eventTypeInvalidHit'), value: 'INVALID_HIT' },
    { label: $t('page.store_distribution.shareTools.eventTypeManualDisable'), value: 'MANUAL_DISABLE' },
  ]);

  const eventTypeLabelMap = computed(() => {
    return eventTypeOptions.value.reduce<Record<string, string>>((acc, item) => {
      acc[String(item.value)] = String(item.label);
      return acc;
    }, {});
  });

  const selectedShareUser = computed(() =>
    shareUserDisplayValue.value ? { memberId: formModel.shareUserId, displayName: shareUserDisplayValue.value } : null,
  );

  const selectedProduct = computed(() =>
    bizDisplayValue.value && formModel.bizId ? { productId: formModel.bizId, displayName: bizDisplayValue.value } : null,
  );

  const columns = computed<DataTableColumns<Api.Store.ShareTokenLog>>(() => [
    {
      key: 'index',
      title: $t('common.index'),
      width: 68,
      align: 'center',
      render: (_, index) => {
        const pageNum = Number(logQuery.pageNum ?? 1);
        const pageSize = Number(logQuery.pageSize ?? 10);
        return (pageNum - 1) * pageSize + index + 1;
      },
    },
    {
      key: 'sid',
      title: $t('page.store_distribution.shareTools.sid'),
      minWidth: 160,
      ellipsis: { tooltip: true },
    },
    {
      key: 'eventType',
      title: $t('page.store_distribution.shareTools.eventType'),
      width: 140,
      align: 'center',
      render: row =>
        h(
          NTag,
          { type: eventTypeTagType[row.eventType] ?? 'default' },
          { default: () => eventTypeLabelMap.value[row.eventType] ?? row.eventType },
        ),
    },
    {
      key: 'shareUserId',
      title: $t('page.store_distribution.shareTools.shareUserId'),
      minWidth: 180,
      render: row => {
        const displayName = resolveDisplayName(row.metadata, [
          'shareUserName',
          'shareUserNickname',
          'shareNickname',
          'shareUserDisplayName',
        ]);
        return formatMemberLabel(row.shareUserId, displayName);
      },
    },
    {
      key: 'memberId',
      title: $t('page.store_distribution.shareTools.memberId'),
      minWidth: 180,
      render: row => {
        const displayName = resolveDisplayName(row.metadata, [
          'memberName',
          'memberNickname',
          'bindMemberName',
          'buyerName',
          'operatorName',
        ]);
        return formatMemberLabel(row.memberId, displayName);
      },
    },
    {
      key: 'orderId',
      title: $t('page.store_distribution.shareTools.orderId'),
      width: 160,
      render: row => row.orderId || '-',
    },
    {
      key: 'eventMessage',
      title: $t('page.store_distribution.shareTools.reason'),
      minWidth: 200,
      render: row => row.eventMessage || '-',
    },
    {
      key: 'createTime',
      title: $t('page.common.createTime'),
      minWidth: 180,
    },
  ]);

  const hasToken = computed(() => Boolean(currentToken.value?.sid));

  const bizIdPlaceholder = computed(() => {
    if (formModel.bizType === 'PRODUCT') return $t('page.store_distribution.shareTools.bizIdPlaceholderProduct');
    if (formModel.bizType === 'ACTIVITY') return $t('page.store_distribution.shareTools.bizIdPlaceholderActivity');
    return $t('page.store_distribution.shareTools.bizIdPlaceholderPage');
  });

  const canPickBiz = computed(() => formModel.bizType === 'PRODUCT');

  watch(
    () => formModel.bizType,
    (current, previous) => {
      if (!previous || current === previous) return;
      formModel.bizId = '';
      bizDisplayValue.value = '';
    },
  );

  async function loadLogs() {
    logLoading.value = true;
    try {
      const { data } = await fetchGetShareTokenLogs({
        ...logQuery,
        pageNum: logQuery.pageNum ?? 1,
        pageSize: logQuery.pageSize ?? 10,
      });
      logs.value = data?.rows ?? [];
      logTotal.value = data?.total ?? 0;
    } catch {
      logs.value = [];
      logTotal.value = 0;
    } finally {
      logLoading.value = false;
    }
  }

  async function createToken() {
    const bizId = formModel.bizId?.trim();
    if (!bizId) {
      window.$message?.warning($t('page.store_distribution.shareTools.bizIdRequired'));
      return;
    }
    const shareUserId = formModel.shareUserId?.trim();
    if (!shareUserId) {
      window.$message?.warning($t('page.store_distribution.shareTools.shareUserIdRequired'));
      return;
    }

    creating.value = true;
    try {
      const payload: Api.Store.CreateShareTokenDto = {
        ...formModel,
        bizId,
        shareUserId,
      };
      const { data } = await fetchCreateShareToken(payload);
      if (data) {
        currentToken.value = data;
        qrcodeUrl.value = '';
        logQuery.sid = data.sid;
        logQuery.pageNum = 1;
        window.$message?.success($t('common.addSuccess'));
        await loadLogs();
      }
    } catch {
      // request 层统一处理错误提示
    } finally {
      creating.value = false;
    }
  }

  async function createQrcode() {
    const sid = currentToken.value?.sid;
    if (!sid) {
      window.$message?.warning($t('page.store_distribution.shareTools.sidRequired'));
      return;
    }

    creatingQrcode.value = true;
    try {
      const { data } = await fetchCreateShareQrcode({ sid });
      qrcodeUrl.value = data?.qrcodeUrl || '';
      window.$message?.success($t('page.store_distribution.shareTools.generateQrcodeSuccess'));
    } catch {
      // request 层统一处理错误提示
    } finally {
      creatingQrcode.value = false;
    }
  }

  function resetTokenForm() {
    Object.assign(formModel, createDefaultTokenForm());
    currentToken.value = null;
    qrcodeUrl.value = '';
    shareUserDisplayValue.value = '';
    bizDisplayValue.value = '';
  }

  function openShareUserPicker() {
    shareUserPickerVisible.value = true;
  }

  function handleShareUserSelect(selection: MemberPickerSelection) {
    formModel.shareUserId = selection.memberId;
    shareUserDisplayValue.value = selection.displayName || selection.nickname || selection.mobile || selection.memberId;
  }

  function clearShareUser() {
    formModel.shareUserId = '';
    shareUserDisplayValue.value = '';
  }

  function openBizPicker() {
    if (!canPickBiz.value) return;
    productPickerVisible.value = true;
  }

  function handleProductSelect(selection: ProductPickerSelection) {
    formModel.bizId = selection.productId;
    bizDisplayValue.value = selection.displayName || selection.productName || selection.name || selection.productId;
  }

  function clearBiz() {
    formModel.bizId = '';
    bizDisplayValue.value = '';
  }

  function searchLogs() {
    logQuery.pageNum = 1;
    loadLogs();
  }

  function resetLogFilters() {
    const currentSid = currentToken.value?.sid;
    Object.assign(logQuery, {
      ...createDefaultLogQuery(),
      sid: currentSid,
    });
    loadLogs();
  }

  function handlePageChange(page: number) {
    logQuery.pageNum = page;
    loadLogs();
  }

  function handlePageSizeChange(pageSize: number) {
    logQuery.pageSize = pageSize;
    logQuery.pageNum = 1;
    loadLogs();
  }

  return {
    formModel,
    creating,
    creatingQrcode,
    currentToken,
    qrcodeUrl,
    hasToken,
    bizTypeOptions,
    bizIdPlaceholder,
    canPickBiz,
    shareUserPickerVisible,
    productPickerVisible,
    shareUserDisplayValue,
    bizDisplayValue,
    selectedShareUser,
    selectedProduct,
    createToken,
    createQrcode,
    openShareUserPicker,
    handleShareUserSelect,
    clearShareUser,
    openBizPicker,
    handleProductSelect,
    clearBiz,
    resetTokenForm,
    logs,
    columns,
    logLoading,
    logQuery,
    logTotal,
    eventTypeOptions,
    loadLogs,
    searchLogs,
    resetLogFilters,
    handlePageChange,
    handlePageSizeChange,
  };
}
