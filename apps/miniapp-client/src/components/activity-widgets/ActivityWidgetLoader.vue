<script setup lang="ts">
interface ActivityProp {
  activityContextKey: string;
  activityType: string;
  configId: string;
  activityName: string;
  activityPrice: number;
}

defineProps<{
  activity: ActivityProp;
}>();
</script>

<template>
  <view class="activity-loader-container" />
</template>
