// Helpers shared by dev.mjs and migrate.mjs: app list, env for child processes, project.json commands, .env bootstrap.
import { copyFileSync, existsSync, readFileSync } from 'node:fs'

export const services = ['customer-service', 'order-service', 'document-service']
export const apps = ['web', ...services]
export const env = { ...process.env, FORCE_COLOR: '1', PATH: `${process.cwd()}/node_modules/.bin:${process.env.PATH}` }

export const target = (app, name) => {
  const { command, cwd = '.' } = JSON.parse(readFileSync(`apps/${app}/project.json`, 'utf8')).targets[name].options
  return { command, cwd }
}

export const ensureEnvFiles = () => {
  for (const app of apps) {
    const file = `apps/${app}/.env`
    if (!existsSync(file)) (copyFileSync(`${file}.example`, file), console.log(`created ${file} from .env.example`))
  }
}
