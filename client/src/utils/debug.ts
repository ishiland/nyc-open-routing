/**
 * Debug logging utility
 * Only logs in development mode to prevent console pollution in production
 */

const isDev = import.meta.env.DEV

export const debug = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args)
    }
  },

  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args)
    }
  },

  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args)
    }
  },

  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args)
    }
  },
}

export default debug
