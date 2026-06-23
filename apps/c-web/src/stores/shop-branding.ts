import { defineStore } from 'pinia';
import { fetchShopBranding, type ShopBranding } from '@/service/api/shop';

const DEFAULT_THEME = '#0d9488';

export const useShopBrandingStore = defineStore('shop-branding', () => {
  const loaded = ref(false);
  const loading = ref(false);
  const branding = ref<ShopBranding>({
    companyName: '商城',
    themeColor: DEFAULT_THEME,
  });

  const companyName = computed(() => branding.value.companyName || '商城');
  const logoUrl = computed(() => branding.value.logoUrl ?? '');
  const themeColor = computed(() => branding.value.themeColor || DEFAULT_THEME);
  const contactPhone = computed(() => branding.value.contactPhone ?? '');
  const contactUserName = computed(() => branding.value.contactUserName ?? '');

  async function loadBranding(force = false) {
    if (loading.value) return;
    if (loaded.value && !force) return;
    loading.value = true;
    try {
      const { apiClient } = useApi();
      branding.value = await fetchShopBranding(apiClient);
      loaded.value = true;
      applyThemeToDocument(themeColor.value);
    } catch {
      applyThemeToDocument(DEFAULT_THEME);
    } finally {
      loading.value = false;
    }
  }

  return {
    loaded,
    loading,
    branding,
    companyName,
    logoUrl,
    themeColor,
    contactPhone,
    contactUserName,
    loadBranding,
  };
});

function applyThemeToDocument(color: string) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--shop-theme', color);
  root.style.setProperty('--shop-theme-soft', `${color}1a`);
}
