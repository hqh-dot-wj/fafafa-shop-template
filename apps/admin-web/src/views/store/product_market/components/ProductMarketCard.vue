<script setup lang="ts">
import { NButton, NCard, NCheckbox, NImage, NTag } from 'naive-ui';

interface Props {
  product: Api.Store.MarketProduct;
  /** 是否处于批量选择模式 */
  selectable?: boolean;
  /** 是否被选中 */
  selected?: boolean;
}

withDefaults(defineProps<Props>(), {
  selectable: false,
  selected: false,
});

defineEmits<{
  (e: 'import', product: Api.Store.MarketProduct): void;
  (e: 'update:selected', value: boolean): void;
}>();
</script>

<template>
  <NCard hoverable class="h-full flex flex-col cursor-pointer transition-all hover:shadow-lg">
    <template #cover>
      <div class="relative aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        <div v-if="selectable" class="absolute left-2 top-2 z-10">
          <NCheckbox
            :checked="selected"
            :disabled="product.isImported"
            @update:checked="(v: boolean) => $emit('update:selected', v)"
          />
        </div>
        <NImage
          :src="product.albumPics?.split(',')[0]"
          class="h-full w-full transition-transform duration-300 hover:scale-110"
          object-fit="cover"
          fallback-src="https://via.placeholder.com/300?text=No+Image"
          preview-disabled
        />
        <div class="absolute right-2 top-2">
          <NTag :type="product.type === 'REAL' ? 'info' : 'success'" size="small">
            {{
              product.type === 'REAL'
                ? $t('page.store_product_market.card.typeReal')
                : $t('page.store_product_market.card.typeService')
            }}
          </NTag>
        </div>
      </div>
    </template>

    <div class="flex flex-col flex-1 gap-2">
      <div class="flex items-start justify-between gap-2">
        <h3 class="line-clamp-2 text-lg font-bold" :title="product.displayName || product.name">
          {{ product.displayName || product.name }}
        </h3>
      </div>
      <div v-if="product.defaultSkuLabel" class="text-xs text-gray-500">
        {{ $t('page.store_product_market.card.defaultSpecLabel') }}{{ product.defaultSkuLabel }}
      </div>

      <p class="line-clamp-2 min-h-10 text-sm text-gray-500">
        {{ product.subTitle || $t('page.store_product_market.card.noDescription') }}
      </p>

      <div class="mt-auto flex items-center justify-between pt-4">
        <div class="flex flex-col">
          <span class="text-xs text-gray-400">{{ $t('page.store_product_market.card.guidePrice') }}</span>
          <span class="text-lg text-primary font-bold">¥{{ product.price }}</span>
        </div>

        <NButton
          :type="product.isImported ? 'default' : 'primary'"
          :disabled="product.isImported"
          size="medium"
          @click.stop="$emit('import', product)"
        >
          {{
            product.isImported ? $t('page.store_product_market.card.imported') : $t('page.store_product_market.card.importNow')
          }}
        </NButton>
      </div>
    </div>
  </NCard>
</template>

<style scoped></style>
