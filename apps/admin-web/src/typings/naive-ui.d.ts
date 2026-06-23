declare namespace NaiveUI {
  type ThemeColor = 'default' | 'error' | 'primary' | 'info' | 'success' | 'warning';
  type Align = 'stretch' | 'baseline' | 'start' | 'end' | 'center' | 'flex-end' | 'flex-start';

  type DataTableBaseColumn<T> = import('naive-ui').DataTableBaseColumn<T>;
  type DataTableColumns<T> = import('naive-ui').DataTableColumns<T>;
  type DataTableColumn<T> = import('naive-ui').DataTableColumn<T>;
  type DataTableExpandColumn<T> = import('naive-ui').DataTableExpandColumn<T>;
  type DataTableSelectionColumn<T> = import('naive-ui').DataTableSelectionColumn<T>;
  type SelectOption = import('naive-ui').SelectOption;
  type TableColumns<T = any> = DataTableColumns<T>;
  type TableColumnGroup<T> = import('naive-ui/es/data-table/src/interface').TableColumnGroup<T>;
  type PaginationProps = import('naive-ui').PaginationProps;
  type TableColumnCheck = import('@sa/hooks').TableColumnCheck;
  type TableDataWithIndex<T> = import('@sa/hooks').TableDataWithIndex<T>;
  type FlatResponseData<T> = import('@sa/axios').FlatResponseData<T>;

  /**
   * the custom column key
   *
   * if you want to add a custom column, you should add a key to this type
   */
  type CustomColumnKey = string | number;

  type SetTableColumnKey<C, T> = Omit<C, 'key'> & { key: (keyof T & (string | number)) | CustomColumnKey };

  type TableData = Api.Common.CommonRecord<object>;

  type TableColumnWithKey<T> = SetTableColumnKey<DataTableBaseColumn<T>, T> | SetTableColumnKey<TableColumnGroup<T>, T>;

  type TableColumn<T> = DataTableColumn<T>;

  /**
   * Vue SFC column factories often infer normal columns as `{ type?: undefined }`.
   * Naive UI models normal/group columns as `type?: never`; accept that input
   * shape at the app hook boundary, then narrow back to official table columns.
   */
  type LooseDataTableBaseColumn<T> = Omit<DataTableBaseColumn<T>, 'type'> & { type?: undefined };
  type LooseTableColumnGroup<T> = Omit<TableColumnGroup<T>, 'type'> & { type?: undefined };
  type LooseTableColumnWithKey<T> =
    | SetTableColumnKey<LooseDataTableBaseColumn<T>, T>
    | SetTableColumnKey<LooseTableColumnGroup<T>, T>;
  type LooseTableColumn<T> = LooseTableColumnWithKey<T> | DataTableSelectionColumn<T> | DataTableExpandColumn<T>;

  type TableApiFn<T = any, R = any> = (params: R) => Promise<FlatResponseData<Api.Common.PaginatingQueryRecord<T>>>;

  type TreeTableApiFn<T = any, R = Record<string, any>> = (params: R) => Promise<FlatResponseData<T[]>>;

  /**
   * the type of table operation
   *
   * - add: add table item
   * - edit: edit table item
   */
  type TableOperateType = 'add' | 'edit';

  type GetTableData<A extends TableApiFn> = A extends TableApiFn<infer T> ? T : never;

  type GetTreeTableData<A extends TreeTableApiFn> = A extends TreeTableApiFn<infer T> ? T : never;

  type NaiveTableConfig<A extends TableApiFn> = Omit<
    import('@sa/hooks').TableConfig<A, GetTableData<A>, TableColumn<TableDataWithIndex<GetTableData<A>>>>,
    'transformer' | 'getColumnChecks' | 'getColumns' | 'onFetched' | 'columns'
  > & {
    columns: () => LooseTableColumn<TableDataWithIndex<GetTableData<A>>>[];
    /**
     * whether to display the total items count
     *
     * @default false
     */
    showTotal?: boolean;
  };

  type NaiveTreeTableConfig<A extends TreeTableApiFn> = Omit<
    import('@sa/hooks').TableConfig<A, GetTreeTableData<A>, TableColumn<TableDataWithIndex<GetTreeTableData<A>>>>,
    'transformer' | 'getColumnChecks' | 'getColumns' | 'onFetched' | 'columns'
  > & {
    columns: () => LooseTableColumn<TableDataWithIndex<GetTreeTableData<A>>>[];
  };

  type CodeMirrorLang = 'js' | 'json';
}
