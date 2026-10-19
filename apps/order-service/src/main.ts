import { runService } from '@lib/trpc'
import { createApp } from './app'
import { loadServiceConfig } from './config'

runService({ loadConfig: loadServiceConfig, createApp })
