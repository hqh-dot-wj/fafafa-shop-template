<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

definePage({
  style: {
    navigationBarTitleText: '商品详情预览',
    navigationBarBackgroundColor: '#ffffff',
    backgroundColor: '#f5f5f5',
  },
});

interface PreviewData {
  serviceId: string;
  serviceType: string;
  templateCode: string;
  name?: string;
  rules: Record<string, any>;
  stockMode: string;
  product?: {
    name: string;
    subTitle?: string;
    mainImages: string[];
    price: number;
    skus?: any[];
  };
}

const data = ref<PreviewData>({
  serviceId: '',
  serviceType: 'SERVICE',
  templateCode: '',
  name: '',
  rules: {},
  stockMode: '',
});

const isReady = ref(false);

const displayTitle = computed(() => data.value.product?.name || '商品名称');

const displayPrice = computed(() => {
  return data.value.rules.price || data.value.product?.price || '99.00';
});

const originalPrice = computed(() => {
  if (data.value.rules.price && data.value.product?.price) {
    return data.value.product.price;
  }
  return null;
});

const activityLabel = computed(() => {
  const normalized = String(data.value.templateCode || '').toUpperCase();
  const labels: Record<string, string> = {
    COURSE_GROUP: '拼课',
    SECKILL: '秒杀',
    COURSE: '课程',
    PUNCH_CARD: '打卡',
  };
  if (normalized.includes('COURSE_GROUP')) return labels.COURSE_GROUP;
  return labels[normalized] || '活动';
});

const displayFeatures = computed(() => {
  const list: Array<{ icon: string; text: string }> = [];
  const rules = data.value.rules;

  if (rules.minCount) {
    list.push({ icon: 'i-carbon-user-multiple', text: `${rules.minCount}人成班` });
  }
  if (rules.validDays) {
    list.push({ icon: 'i-carbon-time', text: `有效期${rules.validDays}天` });
  }
  if (rules.totalLessons) {
    list.push({ icon: 'i-carbon-education', text: `含${rules.totalLessons}课时` });
  }
  if (data.value.stockMode === 'STRONG_LOCK') {
    list.push({ icon: 'i-carbon-locked', text: '限量抢购' });
  }

  return list;
});

const mainImages = computed(() => data.value.product?.mainImages || ['https://picsum.photos/400/300']);

function handleMessage(event: MessageEvent) {
  if (!event.data || !event.data.type) return;
  if (event.data.type === 'MARKETING_PREVIEW_UPDATE') {
    data.value = event.data.payload;
    isReady.value = true;
  }
}

onMounted(() => {
  // #ifdef H5
  window.addEventListener('message', handleMessage);
  // #endif
});

onUnmounted(() => {
  // #ifdef H5
  window.removeEventListener('message', handleMessage);
  // #endif
});
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <div v-if="!isReady" class="h-screen flex flex-col items-center justify-center text-gray-400">
      <div class="i-carbon-presentation-file mb-2 text-4xl" />
      <p>商品详情预览加载中...</p>
    </div>

    <div v-else class="flex flex-col">
      <div class="relative h-96 w-full bg-gray-200">
        <swiper class="h-full w-full" indicator-dots autoplay circular>
          <swiper-item v-for="(img, index) in mainImages" :key="index">
            <image class="h-full w-full" :src="img" mode="aspectFill" />
          </swiper-item>
        </swiper>
      </div>

      <div class="mx-4 overflow-hidden rounded-xl bg-white shadow-lg -mt-6">
        <div class="flex flex-col gap-3 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-baseline gap-2">
              <span class="rounded from-red-500 to-orange-500 bg-gradient-to-r px-2 py-1 text-xs text-white font-bold">
                {{ activityLabel }}
              </span>
              <div class="flex items-baseline gap-1 text-red-500">
                <span class="text-xs">¥</span>
                <span class="text-3xl font-bold">{{ displayPrice }}</span>
              </div>
              <span v-if="originalPrice" class="text-sm text-gray-400 line-through"> ¥{{ originalPrice }} </span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <div
              v-for="(item, idx) in displayFeatures"
              :key="idx"
              class="flex items-center gap-1 border border-gray-100 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600"
            >
              <span :class="item.icon" class="text-gray-400" />
              <span>{{ item.text }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="mx-4 mt-4 rounded-xl bg-white p-4 shadow">
        <h3 class="text-lg text-gray-800 font-bold leading-tight">
          {{ displayTitle }}
        </h3>
        <p v-if="data.product?.subTitle" class="mt-2 text-sm text-gray-500">
          {{ data.product.subTitle }}
        </p>

        <div class="mt-3 flex items-center gap-2">
          <span v-if="data.serviceType === 'SERVICE'" class="rounded bg-blue-50 px-3 py-1 text-xs text-blue-600">
            服务
          </span>
          <span v-else class="rounded bg-green-50 px-3 py-1 text-xs text-green-600"> 实物 </span>
        </div>
      </div>

      <div v-if="data.product?.skus && data.product.skus.length > 1" class="mx-4 mt-4 rounded-xl bg-white p-4 shadow">
        <h4 class="mb-3 text-sm text-gray-700 font-medium">选择规格</h4>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(sku, idx) in data.product.skus"
            :key="idx"
            class="cursor-pointer border border-gray-200 rounded-lg px-3 py-2 text-sm transition-colors hover:border-red-500 hover:text-red-500"
          >
            {{ Object.values(sku.specValues || {}).join('/') || '默认' }}
          </div>
        </div>
      </div>

      <div
        class="fixed bottom-0 left-0 right-0 flex items-center gap-3 border-t border-gray-200 bg-white px-4 py-3 shadow-lg"
      >
        <button
          class="flex-1 rounded-full from-red-500 to-orange-500 bg-gradient-to-r py-3 text-white font-bold shadow-lg transition-transform active:scale-95"
        >
          立即参与
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* UnoCSS handles most styling */
</style>
