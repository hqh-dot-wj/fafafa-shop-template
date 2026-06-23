/**
 * PMS 分类类型
 * 全部来自 @libs/common-types，CreateCategoryDto 已含 bindType（需 pnpm generate-types）
 */
declare namespace Api {
  namespace Pms {
    type Category = import('@libs/common-types').components['schemas']['CategoryVo'];

    type CategoryTree = Category[];

    type CategoryList = Common.PaginatingQueryRecord<Category>;

    /** 与后端 ListCategoryDto 对齐 */
    type CategorySearchParams = CommonType.RecordNullable<
      import('@libs/common-types').RequestParams<'/api/admin/pms/category/list', 'get'>
    >;

    /** 与后端 CreateCategoryDto / UpdateCategoryDto 请求体一致（勿混入列表 VO 字段） */
    type CategoryWriteBody = import('@libs/common-types').components['schemas']['CreateCategoryDto'];

    /**
     * 分类抽屉表单模型：在写入体上增加仅前端使用的字段
     * - catId：编辑时用于 URL
     * - level：选父级时推算层级展示用
     * - parentId：表单可清空为 null，提交时再收敛为「无父级」
     */
    type CategoryFormModel = Omit<CategoryWriteBody, 'parentId'> & {
      catId?: number;
      level: number;
      parentId?: number | null;
    };

    /** @deprecated 请使用 CategoryWriteBody / CategoryFormModel */
    type CategoryOperateParams = CategoryFormModel;
  }
}
