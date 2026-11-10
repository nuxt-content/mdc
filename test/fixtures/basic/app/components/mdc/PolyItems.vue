<script setup lang="ts">
defineProps<{ items?: { label: string }[], options?: Record<string, string> }>()
</script>

<template>
  <ul :data-options="JSON.stringify(options)">
    <li
      v-for="item in items"
      :key="item.label"
    >
      {{ item.label }}
    </li>
  </ul>
</template>
