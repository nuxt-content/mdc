<script setup lang="ts">
defineProps<{ icon?: any }>()
</script>

<template>
  <component :is="icon || 'span'">
    icon
  </component>
</template>
