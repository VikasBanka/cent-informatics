<script setup lang="ts">
import type { LoginPayload } from '#shared/schemas/auth'

function onLogin(payload: LoginPayload) {
  // Wire this to your auth endpoint — re-validate with LoginSchema server-side.
  console.log('login submitted', payload.email, payload.remember)
}
</script>

<template>
  <LoginForm @submit="onLogin" />
</template>