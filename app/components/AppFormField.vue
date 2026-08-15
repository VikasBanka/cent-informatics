<script setup lang="ts">
/**
 * A labelled text input whose error state comes from a Zod field-error array.
 * There are no HTML constraint attributes here on purpose — Zod is the only
 * validator, so the form is `novalidate` and this renders `errors` verbatim.
 * `disabled` is interactivity, not validation: a disabled field still has to
 * satisfy its schema.
 */
const props = defineProps<{
  id: string
  label: string
  type?: string
  placeholder?: string
  autocomplete?: string
  hint?: string
  disabled?: boolean
  errors?: string[]
}>()

const model = defineModel<string>({ required: true })

const hasError = computed(() => Boolean(props.errors?.length))
</script>

<template>
  <!-- min-w-0: this sits in `fieldset`'s grid, where a track's auto minimum is
       the item's min-content width. Without it a long field would widen the
       column and push the input past its container. -->
  <div class="min-w-0">
    <label class="label" :for="id">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :disabled="disabled"
      class="input w-full"
      :class="{ 'input-error': hasError }"
      :aria-invalid="hasError"
      :aria-describedby="hasError ? `${id}-error` : hint ? `${id}-hint` : undefined"
    />
    <!-- whitespace-normal: daisyUI's `.label` is nowrap, which suits an inline
         label but makes a sentence-length message an unbreakable line. -->
    <p v-if="hasError" :id="`${id}-error`" class="label whitespace-normal text-error">
      {{ errors?.[0] }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="label whitespace-normal">
      {{ hint }}
    </p>
  </div>
</template>
