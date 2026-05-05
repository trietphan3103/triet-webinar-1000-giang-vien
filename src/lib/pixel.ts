// Centralized Meta Pixel tracking — init được gắn trong index.html
// Tất cả events custom dùng trackCustom để match với CAPI server-side

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined

export interface PixelUserData {
  em?: string   // email (unhashed — pixel tự hash)
  ph?: string   // phone (unhashed)
  fn?: string   // first name (unhashed)
}

export const pixel = {
  scrollDepth: (pct: 25 | 50 | 75 | 90) =>
    window.fbq?.('trackCustom', `WebinarViewContentScroll${pct}`),

  timeOnSite: (seconds: 30 | 60 | 120) =>
    window.fbq?.('trackCustom', `WebinarTimeOnSite${seconds}s`),

  formSubmit: (eventId: string) =>
    window.fbq?.('trackCustom', 'WebinarFormSubmit', {}, { eventID: eventId }),

  purchase: (value: number, userData?: PixelUserData, eventId?: string, currency = 'VND') => {
    // Advanced matching: re-init với user data để tăng EMQ
    if (userData && PIXEL_ID) {
      window.fbq?.('init', PIXEL_ID, userData)
    }
    window.fbq?.('track', 'Purchase', { value, currency }, eventId ? { eventID: eventId } : undefined)
  },
}
