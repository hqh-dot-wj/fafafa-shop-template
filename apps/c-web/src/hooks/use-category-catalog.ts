import type { ClientCategory, ClientProduct } from '@libs/common-types';
import { getCategoryTree, getProductList } from '@/service/api/product';

function readSceneCode(category: ClientCategory): string | undefined {
  const ext = category as ClientCategory & { sceneCode?: string; nodeType?: string; type?: string };
  const sceneCode = ext.sceneCode?.trim();
  if (!sceneCode) return undefined;
  const nodeType = (ext.nodeType ?? ext.type)?.toUpperCase();
  if (nodeType && nodeType !== 'SCENE') return undefined;
  return sceneCode;
}

function canLoadProducts(category: ClientCategory | undefined): boolean {
  if (!category) return false;
  const ext = category as ClientCategory & { nodeType?: string; type?: string };
  const nodeType = (ext.nodeType ?? ext.type)?.toUpperCase();
  if (nodeType === 'SCENE' || nodeType === 'LINK') return false;
  if (readSceneCode(category)) return false;
  return true;
}

function pickFirstListableChild(children: ClientCategory[]): ClientCategory | undefined {
  return children.find((item) => canLoadProducts(item));
}

/** 分类树 + 当前选中分类商品列表（对齐 miniapp category 页核心数据流）。 */
export function useCategoryCatalog() {
  const { apiClient } = useApi();

  const categories = ref<ClientCategory[]>([]);
  const activeLevel1Id = ref<number | null>(null);
  const activeLevel2Id = ref<number | null>(null);
  const keyword = ref('');
  const products = ref<ClientProduct[]>([]);
  const loading = ref(false);
  const treeLoading = ref(false);
  const errorMessage = ref('');

  const level2List = computed(() => {
    const current = categories.value.find((item) => item.catId === activeLevel1Id.value);
    return current?.children ?? [];
  });

  const currentCategoryNode = computed(() => {
    if (activeLevel2Id.value !== null) {
      return level2List.value.find((item) => item.catId === activeLevel2Id.value);
    }
    return categories.value.find((item) => item.catId === activeLevel1Id.value);
  });

  const listCategoryId = computed(() => {
    const node = currentCategoryNode.value;
    if (!canLoadProducts(node)) return null;
    return node?.catId ?? null;
  });

  function syncSelectionAfterTreeLoaded(tree: ClientCategory[]) {
    const level1Valid = activeLevel1Id.value !== null && tree.some((item) => item.catId === activeLevel1Id.value);
    if (!level1Valid) {
      activeLevel1Id.value = tree[0]?.catId ?? null;
    }
    const level1 = tree.find((item) => item.catId === activeLevel1Id.value);
    const children = level1?.children ?? [];
    if (children.length > 0) {
      const selected =
        activeLevel2Id.value !== null ? children.find((item) => item.catId === activeLevel2Id.value) : undefined;
      if (selected && canLoadProducts(selected)) return;
      activeLevel2Id.value = pickFirstListableChild(children)?.catId ?? null;
    } else {
      activeLevel2Id.value = null;
    }
  }

  async function loadCategories() {
    treeLoading.value = true;
    errorMessage.value = '';
    try {
      const tree = await getCategoryTree(apiClient);
      categories.value = tree?.length ? tree : [];
      if (categories.value.length > 0) {
        syncSelectionAfterTreeLoaded(categories.value);
        await loadProducts();
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '分类加载失败';
      categories.value = [];
      products.value = [];
    } finally {
      treeLoading.value = false;
    }
  }

  async function loadProducts() {
    const categoryId = listCategoryId.value;
    if (!categoryId) {
      products.value = [];
      return;
    }

    loading.value = true;
    errorMessage.value = '';
    try {
      const result = await getProductList(apiClient, {
        pageNum: 1,
        pageSize: 24,
        categoryId,
        name: keyword.value.trim() || undefined,
      });
      products.value = result?.rows ?? [];
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '商品加载失败';
      products.value = [];
    } finally {
      loading.value = false;
    }
  }

  function selectLevel1(catId: number) {
    if (activeLevel1Id.value === catId) return;
    activeLevel1Id.value = catId;
    const level1 = categories.value.find((item) => item.catId === catId);
    const children = level1?.children ?? [];
    activeLevel2Id.value = pickFirstListableChild(children)?.catId ?? null;
    void loadProducts();
  }

  function selectLevel2(catId: number) {
    if (activeLevel2Id.value === catId) return;
    activeLevel2Id.value = catId;
    void loadProducts();
  }

  function searchProducts() {
    void loadProducts();
  }

  function clearKeyword() {
    keyword.value = '';
    void loadProducts();
  }

  return {
    categories,
    activeLevel1Id,
    activeLevel2Id,
    level2List,
    keyword,
    products,
    loading,
    treeLoading,
    errorMessage,
    listCategoryId,
    loadCategories,
    loadProducts,
    selectLevel1,
    selectLevel2,
    searchProducts,
    clearKeyword,
  };
}
