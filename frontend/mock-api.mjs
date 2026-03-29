#!/usr/bin/env node

/**
 * Legacy entrypoint — delegates to the new mock-api/ directory.
 *
 * Usage:  node mock-api.mjs          (starts mock API only on :4444)
 * Or:     node mock-api/dev.mjs      (starts mock API + Next.js dev server)
 * Or:     make dev-mock              (zero-config, does everything)
 */

import { startServer } from './mock-api/server.mjs'
startServer()
