export function isAsciiMode(): boolean {
  return process.env.BUDDY_FORCE_ASCII === '1'
}

export function pickText(zh: string, en: string): string {
  return isAsciiMode() ? en : zh
}

export function pickIcon(icon: string, fallback = ''): string {
  return isAsciiMode() ? fallback : icon
}

