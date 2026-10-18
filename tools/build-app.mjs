// Bundles a service app into dist/apps/<name>/{main.js,migrate.js} with workspace libs and deps inlined,
// so the Docker image needs no node_modules. Usage: node tools/build-app.mjs <app-name>
import { build } from 'esbuild'
import { cp, rm, writeFile } from 'node:fs/promises'

const app = process.argv[2]
if (!app) throw new Error('usage: node tools/build-app.mjs <app-name>')
const out = `dist/apps/${app}`
await rm(out, { recursive: true, force: true })
await build({
  entryPoints: { main: `apps/${app}/src/main.ts`, migrate: `apps/${app}/src/migrate.ts` },
  outdir: out,
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  tsconfig: `apps/${app}/tsconfig.json`,
  external: ['pg-native', 'pino-pretty'], // optional native driver; pretty printing is dev-only
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  sourcemap: true,
  logLevel: 'info'
})
await cp(`apps/${app}/src/db/migrations`, `${out}/migrations`, { recursive: true })
await writeFile(`${out}/package.json`, '{"type":"module"}\n') // the bundle is ESM
