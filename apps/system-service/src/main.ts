import { redactConfig } from '@lib/config'
import { createLogger } from '@lib/logging'
import { shutdownOnSignal } from '@lib/trpc'
import { createApp } from './app'
import { loadServiceConfig } from './config'

const config = loadServiceConfig()
const log = createLogger({
  service: config.SERVICE_ID,
  level: config.LOG_LEVEL,
  pretty: config.NODE_ENV === 'development'
})
log.info({ port: config.PORT }, 'starting')
log.debug({ config: redactConfig(config) }, 'config')

const { container, server } = createApp(config, log)
shutdownOnSignal(server, log, () => container.dispose())
server.listen(config.PORT, () => log.info({ port: config.PORT }, 'listening'))
