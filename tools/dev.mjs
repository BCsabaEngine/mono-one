// Local dev without Docker for the apps: creates missing .env files, then serves web + the three services
// with file watching (tsx watch for services, Vite HMR for web).
// Postgres and Redis must be running (`pnpm dev:infra`). Migrations are not applied here: run `pnpm migrate`.
//
// The apps are started directly (not through `nx run-many`): every Nx task run switches the terminal to raw
// mode, which garbles the interleaved output. The commands come from each project.json, so Nx stays the source of truth.
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { apps, ensureEnvFiles, env, target } from './apps.mjs'

const colors = { web: 35, 'customer-service': 36, 'order-service': 33, 'document-service': 32 }

const run = (app, name) => {
  const { command, cwd } = target(app, name)
  const child = spawn(command, { shell: true, cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const prefix = `\x1b[${colors[app]}m${app}\x1b[0m |`
  for (const stream of [child.stdout, child.stderr])
    createInterface({ input: stream }).on('line', line => console.log(prefix, line))
  return child
}

ensureEnvFiles()

const children = apps.map(app => run(app, 'serve'))
const stop = () => children.forEach(c => c.kill('SIGTERM'))
process.on('SIGINT', stop).on('SIGTERM', stop)
children.forEach(c => c.on('exit', () => children.every(x => x.exitCode !== null || x.signalCode) && process.exit(0)))
