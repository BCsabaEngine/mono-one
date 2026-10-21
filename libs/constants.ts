// kept free of imports: drizzle-kit and the browser bundle load shared code without tsconfig paths

// --- Services ---

/** Every deployable app; the only place the ids are spelled out (events, config and clients derive from it). */
export const SERVICE_IDS = [
  'web',
  'customer-service',
  'order-service',
  'document-service',
  'system-service'
] as const
export type ServiceId = (typeof SERVICE_IDS)[number]

/** One port per service: the default `PORT` of the service and the default URL others call it on. */
export const SERVICE_PORTS = {
  web: 3000,
  'customer-service': 3001,
  'order-service': 3002,
  'document-service': 3003,
  'system-service': 3004
} as const satisfies Record<ServiceId, number>

// --- HTTP paths ---

/** Request/response tRPC router of every service. */
export const TRPC_PATH = '/trpc'
/** `events.deliver` router of every service. */
export const EVENTS_PATH = '/events'
/** Liveness probe. */
export const HEALTH_PATH = '/healthz'
/** Readiness probe (database ping where the service has one). */
export const READY_PATH = '/readyz'

// --- Headers: tracing and identity ---

export const TRACE_ID_HEADER = 'x-trace-id'
/** Comma separated services the request passed through so far; each service appends its own id. */
export const CALL_CHAIN_HEADER = 'x-call-chain'
/** Informational: who is calling (a consistency check for events, not security). */
export const SERVICE_ID_HEADER = 'x-service-id'
export const AUTHORIZATION_HEADER = 'authorization'
export const BEARER_PREFIX = /^Bearer\s+/i
/** Decoded tokens kept in memory; the same token arrives on every call of a session, so decoding it once is enough. */
export const MAX_DECODED_JWTS = 500

// --- Trace id and call chain validation (incoming headers that do not match are replaced or dropped) ---

export const MAX_ID_LENGTH = 64
export const TRACE_ID_PATTERN = new RegExp(`^[\\w-]{8,${MAX_ID_LENGTH}}$`)
export const CALL_CHAIN_ENTRY_PATTERN = new RegExp(
  `^[\\w-]{1,${MAX_ID_LENGTH}}$`
)
/** Longest call chain kept; older entries are cut off. */
export const MAX_CALL_CHAIN = 16

// --- Logging ---

/** Replaces secrets in logs and in the logged config. */
export const REDACTED = '[redacted]'

// --- Streaming ---

/** Keep-alive ping of SSE subscriptions, so proxies do not drop idle streams. */
export const SSE_PING_MS = 15000

// --- Shutdown ---

/** After SIGTERM, in-flight requests get this long before their connections are closed. */
export const SHUTDOWN_DRAIN_MS = 10000

// --- Database ---

export const DEFAULT_DB_SCHEMA = 'public'
/** Postgres error code of a unique constraint violation. */
export const PG_UNIQUE_VIOLATION = '23505'

// --- API limits ---

/** Ids per batch call (`getMany`, `list`). */
export const MAX_BATCH_IDS = 100
/** Page size of a paged list when the caller gives none, and the most it may ask for. */
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100
