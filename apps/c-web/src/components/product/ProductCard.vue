<script setup lang="ts">
import type { ClientProduct } from '@libs/common-types';
import {
  formatYuan,
  resolveProductImage,
  resolveProductOriginalPrice,
  resolveProductSalePrice,
} from '@/utils/product-display';

const props = defineProps<{
  product: ClientProduct;
}>();

const salePrice = computed(() => resolveProductSalePrice(props.product));
const originalPrice = computed(() => resolveProductOriginalPrice(props.product, salePrice.value));
const imageUrl = computed(() => resolveProductImage(props.product));
const badgeText = computed(() => props.product.mainActivitySummary?.tagLabel?.trim() || '');
const productLink = computed(() => `/product/${props.product.productId}`);
</script>

<template>
  <RouterLink class="product-card" :to="productLink">
    <div class="product-card__media">
      <img :src="imageUrl" :alt="product.name" loading="lazy" />
      <span v-if="badgeText" class="product-card__badge">{{ badgeText }}</span>
    </div>
    <div class="product-card__body">
      <h3 class="product-card__title">{{ product.name }}</h3>
      <p v-if="product.subTitle" class="product-card__subtitle">{{ product.subTitle }}</p>
      <div class="product-card__price">
        <span class="product-card__price-current">¥{{ formatYuan(salePrice) }}</span>
        <span v-if="originalPrice" class="product-card__price-original">¥{{ formatYuan(originalPrice) }}</span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.product-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  color: inherit;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  text-decoration: none;
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.product-card:hover {
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.product-card__media {
  aspect-ratio: 1;
  background: #f8fafc;
  position: relative;
}

.product-card__media img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.product-card__badge {
  background: #ef4444;
  border-radius: 999px;
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 600;
  left: 8px;
  padding: 2px 8px;
  position: absolute;
  top: 8px;
}

.product-card__body {
  display: grid;
  gap: 6px;
  padding: 12px;
}

.product-card__title {
  -webkit-box-orient: vertical;
  display: -webkit-box;
  font-size: 0.9375rem;
  font-weight: 600;
  -webkit-line-clamp: 2;
  line-height: 1.4;
  margin: 0;
  overflow: hidden;
}

.product-card__subtitle {
  color: #64748b;
  font-size: 0.75rem;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-card__price {
  align-items: baseline;
  display: flex;
  gap: 6px;
}

.product-card__price-current {
  color: #dc2626;
  font-size: 1.0625rem;
  font-weight: 700;
}

.product-card__price-original {
  color: #94a3b8;
  font-size: 0.75rem;
  text-decoration: line-through;
}
</style>
