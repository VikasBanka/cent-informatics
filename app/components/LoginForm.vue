<script setup lang="ts">
import * as z from 'zod/mini'
import { LoginSchema, type LoginInput, type LoginPayload } from '#shared/schemas/auth'

const emit = defineEmits<{
  submit: [payload: LoginPayload]
}>()

const form = reactive<LoginInput>({
  email: '',
  password: '',
  remember: false
})

const errors = ref<Partial<Record<keyof LoginPayload, string[]>>>({})
const loading = ref(false)
const error = ref('')
const submitted = ref(false)

function validate() {
  const parsed = LoginSchema.safeParse(form)
  errors.value = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors
  return parsed
}

// Only nag once the user has tried to submit, then keep messages live.
watch(form, () => {
  if (submitted.value) validate()
})

function onSubmit() {
  submitted.value = true
  error.value = ''

  const parsed = validate()
  if (!parsed.success) return

  loading.value = true
  emit('submit', parsed.data)
  loading.value = false
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <div class="card card-border w-full max-w-sm bg-base-100">
      <div class="card-body">
        <h1 class="card-title">Sign in</h1>
        <p class="text-base-content/60">Welcome back. Please enter your details.</p>

        <div v-if="error" role="alert" class="alert alert-error alert-soft">
          <span>{{ error }}</span>
        </div>

        <form novalidate @submit.prevent="onSubmit">
          <fieldset class="fieldset">
            <label class="label" for="email">Email</label>
            <input
              id="email"
              v-model="form.email"
              type="text"
              inputmode="email"
              class="input w-full"
              :class="{ 'input-error': errors.email }"
              placeholder="you@example.com"
              autocomplete="email"
              :aria-invalid="Boolean(errors.email)"
              aria-describedby="email-error"
            />
            <p v-if="errors.email" id="email-error" class="label text-error">
              {{ errors.email[0] }}
            </p>

            <label class="label" for="password">Password</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              class="input w-full"
              :class="{ 'input-error': errors.password }"
              placeholder="Password"
              autocomplete="current-password"
              :aria-invalid="Boolean(errors.password)"
              aria-describedby="password-error"
            />
            <p v-if="errors.password" id="password-error" class="label text-error">
              {{ errors.password[0] }}
            </p>

            <div class="flex items-center justify-between gap-2">
              <label class="label">
                <input v-model="form.remember" type="checkbox" class="checkbox checkbox-sm" />
                Remember me
              </label>
              <a href="#" class="link link-hover">Forgot password?</a>
            </div>

            <button type="submit" class="btn btn-primary btn-block mt-2" :disabled="loading">
              <span v-if="loading" class="loading loading-spinner"></span>
              Sign in
            </button>
          </fieldset>
        </form>

        <p class="text-center text-base-content/60">
          Don't have an account?
          <a href="#" class="link">Sign up</a>
        </p>
      </div>
    </div>
  </div>
</template>