import { defineConfig, type Options } from 'tsup';

const base: Options = { splitting: false, sourcemap: true, dts: true, loader: { '.css': 'text' }, target: 'es2020' };

export default defineConfig([
  // React is the root entry, like DialKit
  { ...base, entry: { index: 'src/react/index.ts' }, format: ['esm', 'cjs'], external: ['react', 'react-dom'], banner: { js: '"use client";' } },
  { ...base, entry: { index: 'src/vanilla/index.ts' }, outDir: 'dist/vanilla', format: ['esm', 'cjs'] },
  { ...base, entry: { browser: 'src/vanilla/index.ts' }, outDir: 'dist/vanilla', format: ['iife'], globalName: 'Marmit', dts: false, minify: true },
  { ...base, entry: { index: 'src/vue/index.ts' }, outDir: 'dist/vue', format: ['esm'], external: ['vue'] },
  { ...base, entry: { index: 'src/svelte/index.ts' }, outDir: 'dist/svelte', format: ['esm'], external: ['svelte'] },
  { ...base, entry: { index: 'src/solid/index.ts' }, outDir: 'dist/solid', format: ['esm'], external: ['solid-js', 'solid-js/web'] },
  { ...base, entry: { index: 'src/element/index.ts', register: 'src/element/register.ts' }, outDir: 'dist/element', format: ['esm'] },
]);
