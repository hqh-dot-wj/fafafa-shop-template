import type { DistributionShareEventType, ShareTokenInfo, TrackShareEventPayload } from '@/api/distribution';
import { computed, ref } from 'vue';
import { createMiniappQrcode, createShareToken, trackShareEvent } from '@/api/distribution';
import { buildDistEntryPath, getShareSid, saveShareSid } from '@/utils/dist-share-context';

interface PrepareProductShareOptions {
  productId: string;
  productName: string;
  productImage?: string;
}

interface DistSharePreview {
  sid: string;
  title: string;
  imageUrl?: string;
  path: string;
  query: string;
  shareUrl: string;
  expireAt?: string;
  remainClicks?: number;
  remainBinds?: number;
}

interface DistSharePreviewOptionalInput {
  imageUrl?: string | undefined;
  expireAt?: string | undefined;
  remainClicks?: number | undefined;
  remainBinds?: number | undefined;
}

function readString(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function ensureLeadingSlash(path: string): string {
  if (!path) return '/pages/index/index';
  return path.startsWith('/') ? path : `/${path}`;
}

function buildQuery(params: Record<string, string>) {
  return Object.entries(params)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function buildH5Url(path: string): string {
  // #ifdef H5
  const base = window.location.origin + window.location.pathname;
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}redirect=${encodeURIComponent(path)}`;
  // #endif

  // #ifndef H5
  return path;
  // #endif
}

function toTimelineQuery(path: string): string {
  const [, query = ''] = path.split('?');
  return query;
}

function resolveSharePath(result: ShareTokenInfo, sid: string, targetPath: string) {
  const serverPath = readString(result.sharePath);
  if (serverPath) return ensureLeadingSlash(serverPath);
  return buildDistEntryPath(sid, targetPath);
}

function resolveShareUrl(result: ShareTokenInfo, path: string) {
  const rawUrl = readString(result.shareUrl);
  if (!rawUrl) return buildH5Url(path);
  if (rawUrl.startsWith('/pages/')) return buildH5Url(rawUrl);
  return rawUrl;
}

function createDistSharePreview(
  required: Pick<DistSharePreview, 'path' | 'query' | 'shareUrl' | 'sid' | 'title'>,
  optional: DistSharePreviewOptionalInput,
): DistSharePreview {
  const preview: DistSharePreview = { ...required };
  if (optional.imageUrl !== undefined) preview.imageUrl = optional.imageUrl;
  if (optional.expireAt !== undefined) preview.expireAt = optional.expireAt;
  if (optional.remainClicks !== undefined) preview.remainClicks = optional.remainClicks;
  if (optional.remainBinds !== undefined) preview.remainBinds = optional.remainBinds;
  return preview;
}

export function useDistShare() {
  const preparing = ref(false);
  const sheetVisible = ref(false);
  const sharePreview = ref<DistSharePreview | null>(null);

  const currentSid = computed(() => sharePreview.value?.sid || getShareSid() || '');

  async function prepareProductShare(options: PrepareProductShareOptions) {
    preparing.value = true;
    try {
      const targetPath = `/pages/product/detail?id=${encodeURIComponent(options.productId)}`;
      const result = await createShareToken({
        bizType: 'PRODUCT',
        bizId: options.productId,
        targetPath,
      });

      const sid = readString(result?.sid);
      if (!sid) {
        throw new Error('分享凭证生成失败');
      }

      saveShareSid(sid);
      const path = resolveSharePath(result, sid, targetPath);
      const title = options.productName || '商品推荐';
      sharePreview.value = createDistSharePreview(
        {
          sid,
          title: `分享商品：${title}`,
          path,
          query: toTimelineQuery(path),
          shareUrl: resolveShareUrl(result, path),
        },
        {
          imageUrl: readString(options.productImage) || undefined,
          expireAt: readString(result.expireAt) || undefined,
          remainClicks: typeof result.remainClicks === 'number' ? result.remainClicks : undefined,
          remainBinds: typeof result.remainBinds === 'number' ? result.remainBinds : undefined,
        },
      );
      return sharePreview.value;
    } finally {
      preparing.value = false;
    }
  }

  function openSheet() {
    sheetVisible.value = true;
  }

  function closeSheet() {
    sheetVisible.value = false;
  }

  async function copyShareLink() {
    const link = sharePreview.value?.shareUrl;
    if (!link) {
      uni.showToast({ title: '请先生成分享凭证', icon: 'none' });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      uni.setClipboardData({
        data: link,
        success: () => resolve(),
        fail: reject,
      });
    });
    uni.showToast({ title: '分享链接已复制', icon: 'success' });
  }

  async function createQrcode() {
    const sid = currentSid.value;
    if (!sid) {
      uni.showToast({ title: '请先生成分享凭证', icon: 'none' });
      return null;
    }
    const res = await createMiniappQrcode({ sid, page: 'pages/distribution/entry', width: 430 });
    return res;
  }

  async function goQrcodePage() {
    const qrcode = await createQrcode();
    if (!qrcode?.qrcodeUrl) {
      uni.showToast({ title: '小程序码生成失败', icon: 'none' });
      return;
    }
    const query = buildQuery({
      sid: qrcode.sid,
      qrcodeUrl: qrcode.qrcodeUrl,
      expireAt: sharePreview.value?.expireAt || '',
    });
    uni.navigateTo({ url: `/pages/distribution/qrcode?${query}` });
  }

  async function goPosterPage() {
    const sid = currentSid.value;
    if (!sid) {
      uni.showToast({ title: '请先生成分享凭证', icon: 'none' });
      return;
    }
    const query = buildQuery({
      sid,
      title: sharePreview.value?.title || '分销分享',
      imageUrl: sharePreview.value?.imageUrl || '',
      shareUrl: sharePreview.value?.shareUrl || '',
      expireAt: sharePreview.value?.expireAt || '',
    });
    uni.navigateTo({ url: `/pages/distribution/poster?${query}` });
  }

  async function hintTimelineShare() {
    // #ifdef MP-WEIXIN
    try {
      uni.showShareMenu({
        menus: ['shareTimeline', 'shareAppMessage'],
      });
    } catch {
      // 忽略，继续给出提示
    }
    // #endif
    uni.showToast({ title: '请点击右上角“...”分享到朋友圈', icon: 'none' });
  }

  async function trackEvent(eventType: DistributionShareEventType, ext?: Record<string, unknown>) {
    const sid = currentSid.value;
    if (!sid) return;
    try {
      const payload: TrackShareEventPayload = {
        sid,
        eventType,
      };
      if (ext !== undefined) payload.ext = ext;
      await trackShareEvent(payload);
    } catch {
      // 埋点失败不阻断主流程
    }
  }

  return {
    preparing,
    sheetVisible,
    sharePreview,
    currentSid,
    prepareProductShare,
    openSheet,
    closeSheet,
    copyShareLink,
    goQrcodePage,
    goPosterPage,
    hintTimelineShare,
    trackEvent,
  };
}
