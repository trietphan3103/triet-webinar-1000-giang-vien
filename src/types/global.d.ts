interface Window {
  fbq: ((...args: unknown[]) => void) & {
    callMethod?: (...args: unknown[]) => void
    queue: unknown[][]
    loaded: boolean
    version: string
    push: (...args: unknown[]) => void
  }
  _fbq: Window['fbq']
}
