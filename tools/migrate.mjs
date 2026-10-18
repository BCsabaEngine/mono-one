// Applies the migrations of all core services (not part of `pnpm dev`). Postgres must be running: `pnpm dev:infra`.
// The commands come from each project.json, so Nx stays the source of truth.
import { spawnSync } from 'node:child_process'
import { ensureEnvFiles, env, services, target } from './apps.mjs'

ensureEnvFiles()
for (const app of services) {
  const { command, cwd } = target(app, 'migrate')
  if (spawnSync(command, { shell: true, cwd, env, stdio: 'inherit' }).status) {
    console.error('\nMigrations failed. Are Postgres and Redis up? Run: pnpm dev:infra')
    process.exit(1)
  }
}
