import { defineConfig } from 'tsdown'

/**
 * Package-local tsdown config mirroring the root workspace defaults
 * (entry lib/types/{index,...}.js, esm, node) so this package can be built
 * on its own: `pnpm exec tsdown -c packages/host/promentor/tsdown.config.ts`.
 */
export default defineConfig({
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})
