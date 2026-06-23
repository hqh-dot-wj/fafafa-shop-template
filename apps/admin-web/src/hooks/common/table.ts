import { computed, effectScope, onScopeDispose, reactive, ref, unref, watch } from 'vue';
import type { Ref } from 'vue';
import type { PaginationProps } from 'naive-ui';
import { jsonClone } from '@sa/utils';
import { useBoolean, useHookTable } from '@sa/hooks';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import { $t } from '@/locales';

type TableData = Record<string, any>;
type GetTableData<A extends NaiveUI.TableApiFn> = NaiveUI.GetTableData<A>;
type TableRow<A extends NaiveUI.TableApiFn> = NaiveUI.TableDataWithIndex<GetTableData<A>>;
type TableColumn<T> = NaiveUI.TableColumn<T>;

/** 分页参数须为整数；避免 ref / 字符串污染 query（pageNum[isTrusted] 等） */
function toTablePageNumber(value: unknown, fallback = 1) {
  const raw = unref(value);
  const num = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(num) && num >= 1 ? Math.floor(num) : fallback;
}

export function useTable<A extends NaiveUI.TableApiFn>(config: NaiveUI.NaiveTableConfig<A>) {
  const scope = effectScope();
  const appStore = useAppStore();

  const isMobile = computed(() => appStore.isMobile);

  const { apiFn, apiParams, immediate, showTotal = true } = config;

  const SELECTION_KEY = '__selection__';

  const EXPAND_KEY = '__expand__';

  const {
    loading,
    empty,
    data,
    columns,
    columnChecks,
    reloadColumns,
    getData,
    searchParams,
    updateSearchParams,
    resetSearchParams,
  } = useHookTable<A, GetTableData<A>, TableColumn<NaiveUI.TableDataWithIndex<GetTableData<A>>>>({
    apiFn,
    apiParams,
    // SFC column factories may infer normal columns with `type?: undefined`;
    // the app config accepts that shape and narrows it here for @sa/hooks/Naive UI.
    columns: () => config.columns() as TableColumn<TableRow<A>>[],
    transformer: (res) => {
      // 兼容两类响应：
      // 1) request 层已解包：{ rows, total }
      // 2) 旧结构：{ data: { rows, total } }
      const payload =
        res && typeof res === 'object' && 'rows' in (res as Record<string, unknown>)
          ? (res as { rows?: GetTableData<A>[]; total?: number })
          : ((res as { data?: { rows?: GetTableData<A>[]; total?: number } })?.data ?? {});

      const { rows: records = [], total = 0 } = payload;

      const current = toTablePageNumber(searchParams.pageNum);
      const size = toTablePageNumber(searchParams.pageSize, 10);

      // Ensure that the size is greater than 0, If it is less than 0, it will cause paging calculation errors.
      const pageSize = size <= 0 ? 10 : size;

      const recordsWithIndex = records.map((item, index) => {
        return {
          ...item,
          index: (current - 1) * pageSize + index + 1,
        };
      });

      return {
        data: recordsWithIndex,
        pageNum: current,
        pageSize,
        total,
      };
    },
    getColumnChecks: (cols) => {
      const checks: NaiveUI.TableColumnCheck[] = [];

      cols.forEach((column) => {
        if (isTableColumnHasKey(column)) {
          checks.push({
            key: column.key as string,
            title: column.title!,
            checked: true,
          });
        } else if (column.type === 'selection') {
          checks.push({
            key: SELECTION_KEY,
            title: $t('common.check'),
            checked: true,
          });
        } else if (column.type === 'expand') {
          checks.push({
            key: EXPAND_KEY,
            title: $t('common.expandColumn'),
            checked: true,
          });
        }
      });

      return checks;
    },
    getColumns: (cols, checks) => {
      const columnMap = new Map<string, TableColumn<TableRow<A>>>();

      cols.forEach((column) => {
        if (isTableColumnHasKey(column)) {
          columnMap.set(column.key as string, column);
        } else if (column.type === 'selection') {
          columnMap.set(SELECTION_KEY, column);
        } else if (column.type === 'expand') {
          columnMap.set(EXPAND_KEY, column);
        }
      });

      const filteredColumns = checks
        .filter((item) => item.checked)
        .map((check) => columnMap.get(check.key) as TableColumn<TableRow<A>>);

      return filteredColumns;
    },
    onFetched: async (transformed) => {
      const { total } = transformed;

      updatePagination({
        page: toTablePageNumber(searchParams.pageNum),
        pageSize: toTablePageNumber(searchParams.pageSize, 10),
        itemCount: total,
      });
    },
    immediate,
  });

  const pagination: PaginationProps = reactive({
    page: 1,
    pageSize: 10,
    showSizePicker: true,
    itemCount: 0,
    pageSizes: [10, 15, 20, 25, 30],
    onUpdatePage: async (page: number) => {
      const nextPage = toTablePageNumber(page);
      const nextPageSize = toTablePageNumber(pagination.pageSize, 10);
      pagination.page = nextPage;

      updateSearchParams({
        pageNum: nextPage,
        pageSize: nextPageSize,
      });

      getData();
    },
    onUpdatePageSize: async (pageSize: number) => {
      const nextPageSize = toTablePageNumber(pageSize, 10);
      pagination.pageSize = nextPageSize;
      pagination.page = 1;

      updateSearchParams({
        pageNum: 1,
        pageSize: nextPageSize,
      });

      getData();
    },
    ...(showTotal
      ? {
          prefix: (page) => $t('datatable.itemCount', { total: page.itemCount }),
        }
      : {}),
  });

  // this is for mobile, if the system does not support mobile, you can use `pagination` directly
  const mobilePagination = computed(() => {
    const p: PaginationProps = {
      ...pagination,
      pageSlot: isMobile.value ? 3 : 9,
      prefix: !isMobile.value && showTotal ? pagination.prefix : undefined,
    };

    return p;
  });

  function updatePagination(update: Partial<PaginationProps>) {
    Object.assign(pagination, update);
  }

  /**
   * get data by page number
   *
   * @param pageNum the page number. default is 1
   */
  async function getDataByPage(pageNum: number = 1) {
    const nextPage = toTablePageNumber(pageNum);
    const nextPageSize = toTablePageNumber(pagination.pageSize, 10);
    updatePagination({
      page: nextPage,
    });

    updateSearchParams({
      pageNum: nextPage,
      pageSize: nextPageSize,
    });

    await getData();
  }

  scope.run(() => {
    watch(
      () => appStore.locale,
      () => {
        reloadColumns();
      },
    );
  });

  onScopeDispose(() => {
    scope.stop();
  });

  // calculate the total width of the table this is used for horizontal scrolling
  const scrollX = computed(() => {
    return columns.value.reduce((acc, column) => {
      return acc + Number(column.width ?? column.minWidth ?? 120);
    }, 0);
  });

  return {
    loading,
    empty,
    data,
    columns,
    columnChecks,
    reloadColumns,
    pagination,
    mobilePagination,
    updatePagination,
    getData,
    getDataByPage,
    searchParams,
    updateSearchParams,
    resetSearchParams,
    scrollX,
  };
}

export function useTableOperate<T extends TableData = TableData>(data: Ref<T[]>, getData: () => Promise<void>) {
  const { bool: drawerVisible, setTrue: openDrawer, setFalse: closeDrawer } = useBoolean();

  const operateType = ref<NaiveUI.TableOperateType>('add');

  function handleAdd() {
    operateType.value = 'add';
    openDrawer();
  }

  /** the editing row data */
  const editingData: Ref<T | null> = ref(null);

  function handleEdit(field: keyof T, id: CommonType.IdType) {
    operateType.value = 'edit';
    const findItem = data.value.find((item) => item[field] === id) || null;
    editingData.value = jsonClone(findItem);

    openDrawer();
  }

  function edit(item: T) {
    operateType.value = 'edit';
    editingData.value = jsonClone(item);

    openDrawer();
  }

  /** the checked row keys of table */
  const checkedRowKeys = ref<CommonType.IdType[]>([]);

  /** the hook after the batch delete operation is completed */
  async function onBatchDeleted() {
    window.$message?.success($t('common.deleteSuccess'));

    checkedRowKeys.value = [];

    await getData();
  }

  /** the hook after the delete operation is completed */
  async function onDeleted() {
    window.$message?.success($t('common.deleteSuccess'));

    await getData();
  }

  return {
    drawerVisible,
    openDrawer,
    closeDrawer,
    operateType,
    handleAdd,
    editingData,
    handleEdit,
    edit,
    checkedRowKeys,
    onBatchDeleted,
    onDeleted,
  };
}

function isTableColumnHasKey<T>(column: TableColumn<T>): column is NaiveUI.TableColumnWithKey<T> {
  return Boolean((column as NaiveUI.TableColumnWithKey<T>).key);
}

/**
 * Use table props from theme store
 *
 * @description This hook provides reactive table properties from theme configuration
 * @returns Table properties object that can be spread onto NDataTable component
 */
export function useTableProps() {
  const themeStore = useThemeStore();

  return computed(() => ({
    size: themeStore.table.size,
    bordered: themeStore.table.bordered,
    bottomBordered: themeStore.table.bottomBordered,
    singleColumn: themeStore.table.singleColumn,
    singleLine: themeStore.table.singleLine,
    striped: themeStore.table.striped,
  }));
}
