/** No 0/O or 1/I, so a code read aloud or retyped lands in the right room. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newMatchCode(length = 5): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function normaliseCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isMatchCode(value: string): boolean {
  return /^[A-Z0-9]{4,8}$/.test(value)
}
