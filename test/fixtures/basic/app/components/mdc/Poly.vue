<script setup lang="ts">
import { h } from 'vue'

// Polymorphic element like Reka UI's `Primitive`: renders whatever `as` / `is` / `tag` holds
const props = defineProps<{ as?: any, is?: any, tag?: any }>()
const Element = () => h(props.as || props.is || props.tag || 'div', null, 'poly')
</script>

<template>
  <Element />
</template>
