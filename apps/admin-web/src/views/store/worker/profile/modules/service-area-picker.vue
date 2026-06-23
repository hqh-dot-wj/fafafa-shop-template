<script setup lang="ts">
import AddressPicker from './address-picker.vue';

defineOptions({
  name: 'ServiceAreaPicker',
});

const model = defineModel<Api.Store.WorkerAddress>('value', { required: true });
</script>

<template>
  <AddressPicker v-model:value="model" />
</template>
