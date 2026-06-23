<script setup lang="ts">
defineOptions({
  name: 'SkillTagSelect',
});

const model = defineModel<string[]>('value', { required: true });
</script>

<template>
  <NDynamicTags v-model:value="model" :max="20" />
</template>
