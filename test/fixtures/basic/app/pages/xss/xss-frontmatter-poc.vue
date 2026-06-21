<template>
  <div>
    <p id="working-payload">
      <MDCRenderer
        :body="workingBody"
        :data="workingData"
      />
    </p>
    <p id="negative-control">
      <MDCRenderer
        :body="controlBody"
        :data="controlData"
      />
    </p>
  </div>
</template>

<script setup lang="ts">
const srcdocVal = '<' + 'script>parent.__mdcPoc="frontmatter-executed"<' + '/script>'

// Working payload: frontmatter component sets root to iframe with srcdoc
const workingBody = { type: 'root', children: [{ type: 'element', tag: 'p', props: {}, children: [{ type: 'text', value: 'safe' }] }] }
const workingData = { component: { name: 'iframe', props: { srcdoc: srcdocVal } } }

// Negative control: raw iframe in markdown body (child-node path)
const controlBody = { type: 'root', children: [{ type: 'element', tag: 'iframe', props: { srcdoc: srcdocVal }, children: [] }] }
const controlData = {}
</script>
