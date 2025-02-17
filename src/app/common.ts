
/**
 * Convenience for shortening firebase IDs which are SHA-256 HMACs in hex.
 */
export function shortenId(id: string): string {
  return `*${id.slice(-6)}`
}
