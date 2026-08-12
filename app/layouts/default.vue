<template>
  <div class="drawer lg:drawer-open">
    <input id="app-drawer" type="checkbox" class="drawer-toggle" />

    <div class="drawer-content flex min-h-screen flex-col">
      <div class="px-4 pt-4 lg:hidden">
        <label
          for="app-drawer"
          class="btn btn-ghost btn-square drawer-button"
          aria-label="Open navigation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </label>
      </div>

      <main class="w-full max-w-7xl grow p-4 sm:p-6">
        <slot />
      </main>
    </div>

    <!-- overflow-visible in BOTH states: the edge toggle overhangs the sidebar,
         and the collapsed rail's tooltips do too. -->
    <div class="drawer-side overflow-visible">
      <label for="app-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
      <AppSidebar />
    </div>
  </div>
</template>
