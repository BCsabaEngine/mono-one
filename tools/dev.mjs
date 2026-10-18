// Local dev without Docker for the apps: creates missing .env files, applies migrations, then serves
// web + the three services with file watching (tsx watch for services, Vite HMR for web).
// Postgres and Redis must be running: `pnpm dev:infra`.
//
// The apps are started directly (not through `nx run-many`): every Nx task run switches the terminal to raw
// mode, which garbles the interleaved output. The commands come from each project.json, so Nx stays the source of truth.
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const services = ['customer-service', 'order-service', 'document-service']
const apps = ['web', ...services]
const env = { ...process.env, FORCE_COLOR: '1', PATH: `${process.cwd()}/node_modules/.bin:${process.env.PATH}` }
const colors = { web: 35, 'customer-service': 36, 'order-service': 33, 'document-service': 32 }

const target = (app, name) => {
  const { command, cwd = '.' } = JSON.parse(readFileSync(`apps/${app}/project.json`, 'utf8')).targets[name].options
  return { command, cwd }
}
const run = (app, name) => {
  const { command, cwd } = target(app, name)
  const child = spawn(command, { shell: true, cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const prefix = `\x1b[${colors[app]}m${app}\x1b[0m |`
  for (const stream of [child.stdout, child.stderr])
    createInterface({ input: stream }).on('line', line => console.log(prefix, line))
  return child
}

for (const app of apps) {
  const file = `apps/${app}/.env`
  if (!existsSync(file)) (copyFileSync(`${file}.example`, file), console.log(`created ${file} from .env.example`))
}

for (const app of services) {
  const { command, cwd } = target(app, 'migrate')
  if (spawnSync(command, { shell: true, cwd, env, stdio: 'inherit' }).status) {
    console.error('\nMigrations failed. Are Postgres and Redis up? Run: pnpm dev:infra')
    process.exit(1)
  }
}

const children = apps.map(app => run(app, 'serve'))
const stop = () => children.forEach(c => c.kill('SIGTERM'))
process.on('SIGINT', stop).on('SIGTERM', stop)
children.forEach(c => c.on('exit', () => children.every(x => x.exitCode !== null || x.signalCode) && process.exit(0)))
