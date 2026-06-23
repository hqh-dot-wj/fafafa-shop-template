<template>
  <RouterView />
</template>

<style>
:root {
  --shop-theme: #0d9488;
  --shop-theme-soft: #0d94881a;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    'Helvetica Neue',
    Arial,
    sans-serif;
  -webkit-font-smoothing: antialiased;
}
</style>
