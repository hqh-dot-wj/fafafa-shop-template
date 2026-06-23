<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({
  name: 'FinanceSearchCard',
});

interface Props {
  collapseName: string;
  title?: string;
  defaultExpanded?: boolean;
}

withDefaults(defineProps<Props>(), {
  title: '',
  defaultExpanded: true,
});
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="defaultExpanded ? [collapseName] : []">
      <NCollapseItem :title="title || $t('common.search')" :name="collapseName">
        <slot />
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>
