// Moved into the server tree so both the Nitro server (cron route) and this CLI
// can share one source of truth. This file just re-exports it.
export * from '../server/utils/restaurant-clean.mjs'
