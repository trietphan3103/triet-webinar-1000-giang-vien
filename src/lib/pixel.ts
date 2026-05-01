// Centralized Meta Pixel tracking — init được gắn trong index.html
// Tất cả events custom dùng trackCustom để match với CAPI server-side

export const pixel = {
  scrollDepth: (pct: 25 | 50 | 75 | 90) =>
    window.fbq?.('trackCustom', `WebinarViewContentScroll${pct}`),

  timeOnSite: (seconds: 30 | 60 | 120) =>
    window.fbq?.('trackCustom', `WebinarTimeOnSite${seconds}s`),

  formSubmit: (eventId: string) =>
    window.fbq?.('trackCustom', 'WebinarFormSubmit', {}, { eventID: eventId }),
}
