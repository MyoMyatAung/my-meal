import "server-only"

export function logError(action: string, error: unknown): void {
  const timestamp = new Date().toISOString()
  const detail = error instanceof Error ? error.message : String(error)
  console.error(`${action} | ${timestamp} : ${detail}`)
}
