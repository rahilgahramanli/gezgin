/* GEZGIN icon sprite — usage: <svg class="i"><use href="#i-pin"/></svg>
   All icons are 24×24 stroke icons (stroke = currentColor) unless noted. */
(function () {
  var sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">' +
  // brand
  '<symbol id="i-logo" viewBox="0 0 64 80"><path d="M32 2C16.5 2 4 14.3 4 29.6 4 50 32 78 32 78s28-28 28-48.4C60 14.3 47.5 2 32 2z" fill="currentColor"/><circle cx="32" cy="29" r="17" fill="#fff"/><path d="M15.5 36.5 26 22l6 7.5 5-6 12 13.5z" fill="currentColor"/><path d="m26 22 2.8 4.2 2-2.6L29 21z" fill="#fff"/></symbol>' +
  '<symbol id="i-apple" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.9-1.5-.1-2.8.9-3.6.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.8 2.4 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.6-1-2.6-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.8-1.4z"/></symbol>' +
  '<symbol id="i-google" viewBox="0 0 24 24"><path fill="#4285F4" stroke="none" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"/><path fill="#34A853" stroke="none" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.8 19.8 8.1 22 12 22z"/><path fill="#FBBC05" stroke="none" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.6L6.4 14z"/><path fill="#EA4335" stroke="none" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8.1 2 4.8 4.2 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"/></symbol>' +
  // navigation
  '<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></symbol>' +
  '<symbol id="i-pin-solid" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6" fill="#fff" stroke="none"/></symbol>' +
  '<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></symbol>' +
  '<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>' +
  '<symbol id="i-map" viewBox="0 0 24 24"><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/></symbol>' +
  '<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></symbol>' +
  '<symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 20a2 2 0 0 0 4 0"/></symbol>' +
  '<symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="2.4"/></symbol>' +
  '<symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20.5s-8-5-8-11a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 6-8 11-8 11z"/></symbol>' +
  '<symbol id="i-heart-fill" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M12 20.5s-8-5-8-11a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 6-8 11-8 11z"/></symbol>' +
  '<symbol id="i-comment" viewBox="0 0 24 24"><path d="M20 12.5c0 4-3.6 7-8 7-1 0-2-.2-2.9-.5L4 20l1.2-3.6A6.7 6.7 0 0 1 4 12.5c0-4 3.6-7 8-7s8 3 8 7z"/></symbol>' +
  '<symbol id="i-send" viewBox="0 0 24 24"><path d="m21 3-9.5 9.5M21 3l-6.5 18-3-8.5L3 9.5 21 3z"/></symbol>' +
  '<symbol id="i-bookmark" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4.5L6 21V3z"/></symbol>' +
  '<symbol id="i-bookmark-fill" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M6 3h12v18l-6-4.5L6 21V3z"/></symbol>' +
  '<symbol id="i-share" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/></symbol>' +
  '<symbol id="i-back" viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></symbol>' +
  '<symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="M20 12H4m6-6-6 6 6 6"/></symbol>' +
  '<symbol id="i-chev-right" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></symbol>' +
  '<symbol id="i-chev-down" viewBox="0 0 24 24"><path d="m5 9 7 7 7-7"/></symbol>' +
  '<symbol id="i-chev-up" viewBox="0 0 24 24"><path d="m5 15 7-7 7 7"/></symbol>' +
  '<symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M4 12h16m-6-6 6 6-6 6"/></symbol>' +
  '<symbol id="i-arrow-up" viewBox="0 0 24 24"><path d="M12 20V4m-6 6 6-6 6 6"/></symbol>' +
  '<symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></symbol>' +
  '<symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h10M18 17h2"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="17" r="2"/></symbol>' +
  '<symbol id="i-filter" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/></symbol>' +
  '<symbol id="i-star" viewBox="0 0 24 24"><path d="m12 3 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8L12 3z"/></symbol>' +
  '<symbol id="i-camera" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4V8z"/><circle cx="12" cy="13" r="3.5"/></symbol>' +
  '<symbol id="i-video" viewBox="0 0 24 24"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3"/></symbol>' +
  '<symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 9"/></symbol>' +
  '<symbol id="i-route" viewBox="0 0 24 24"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M9 18h5a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3h-4a3 3 0 0 1-3-3V7"/></symbol>' +
  '<symbol id="i-navigation" viewBox="0 0 24 24"><path d="m3 11 18-8-8 18-2-8-8-2z"/></symbol>' +
  '<symbol id="i-compass" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2z"/></symbol>' +
  '<symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></symbol>' +
  '<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" stroke-width="2.2"/></symbol>' +
  '<symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" stroke-width="2"/></symbol>' +
  '<symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4l10.5-10.5-4-4L4 16v4z"/><path d="m13 7 4 4"/></symbol>' +
  '<symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></symbol>' +
  '<symbol id="i-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></symbol>' +
  '<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>' +
  '<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>' +
  '<symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M3 3l18 18M10.5 6.3A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 6.6C3.8 8.4 2 12 2 12s3.5 6 10 6c1.6 0 3-.3 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></symbol>' +
  '<symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></symbol>' +
  '<symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></symbol>' +
  '<symbol id="i-phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></symbol>' +
  '<symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></symbol>' +
  '<symbol id="i-flag" viewBox="0 0 24 24"><path d="M5 21V4h11l-1.5 4L16 12H5"/></symbol>' +
  '<symbol id="i-mountain" viewBox="0 0 24 24"><path d="m3 20 6-11 4 6 2-3 6 8H3z"/><path d="m9 9 1.5 2.5L12 9.5"/></symbol>' +
  '<symbol id="i-mountain-flag" viewBox="0 0 24 24"><path d="m2 21 7-12 4 6 2.5-3.5L22 21H2z"/><path d="M14 3v8M14 3h5l-1.5 2L19 7h-5"/></symbol>' +
  '<symbol id="i-trophy" viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6"/></symbol>' +
  '<symbol id="i-gift" viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="4"/><path d="M5 13v8h14v-8M12 9v12M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z"/></symbol>' +
  '<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></symbol>' +
  '<symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2.1.6 3.5 2.3 3.5 5.4"/></symbol>' +
  '<symbol id="i-wallet" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.3"/></symbol>' +
  '<symbol id="i-ticket" viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"/><path d="M13 6v12" stroke-dasharray="2 2"/></symbol>' +
  '<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>' +
  '<symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11m-5-5 5 5 5-5M4 20h16"/></symbol>' +
  '<symbol id="i-wifi-off" viewBox="0 0 24 24"><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.5-2.8M15.5 8.7A10 10 0 0 1 19 13M2 9a14 14 0 0 1 5-3.2M12 20h.01" stroke-width="2"/></symbol>' +
  '<symbol id="i-layers" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/></symbol>' +
  '<symbol id="i-home" viewBox="0 0 24 24"><path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z"/></symbol>' +
  '<symbol id="i-tree" viewBox="0 0 24 24"><path d="m12 2 5 7h-3l4 5h-4l3 4H3l3-4H2l4-5H3l5-7h4z"/><path d="M12 18v4"/></symbol>' +
  '<symbol id="i-leaf" viewBox="0 0 24 24"><path d="M4 20c0-9 6-14 16-15-1 10-6 16-15 15z"/><path d="M4 20c4-5 8-8 12-10"/></symbol>' +
  '<symbol id="i-landmark" viewBox="0 0 24 24"><path d="m3 8 9-5 9 5H3zM5 8v9M9 8v9M15 8v9M19 8v9M3 21h18M3 17h18"/></symbol>' +
  '<symbol id="i-tent" viewBox="0 0 24 24"><path d="M12 4 2 20h20L12 4z"/><path d="M12 4v16M8 20l4-8 4 8"/></symbol>' +
  '<symbol id="i-utensils" viewBox="0 0 24 24"><path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M8 3v18M17 3c-2 1-3 4-3 7v2h3v9"/></symbol>' +
  '<symbol id="i-bed" viewBox="0 0 24 24"><path d="M3 18V8M3 14h18v4M3 11h9V8a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3v4"/><circle cx="7" cy="9" r="1.5"/></symbol>' +
  '<symbol id="i-store" viewBox="0 0 24 24"><path d="M4 9 5.5 4h13L20 9M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M5 11v9h14v-9M10 20v-5h4v5"/></symbol>' +
  '<symbol id="i-more" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></symbol>' +
  '<symbol id="i-more-v" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/></symbol>' +
  '<symbol id="i-logout" viewBox="0 0 24 24"><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/></symbol>' +
  '<symbol id="i-crown" viewBox="0 0 24 24"><path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"/></symbol>' +
  '<symbol id="i-medal" viewBox="0 0 24 24"><circle cx="12" cy="14" r="6"/><path d="m8.5 9 -3-6h4l2.5 4M15.5 9l3-6h-4L12 7"/><path d="m12 11.5 .9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1L9 13.7l2.1-.3.9-1.9z" fill="currentColor" stroke="none"/></symbol>' +
  '<symbol id="i-coins" viewBox="0 0 24 24"><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M3 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M15 10.2c3.4.3 6 1.6 6 3.3 0 1.7-2.7 3-6 3"/></symbol>' +
  '<symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></symbol>' +
  '<symbol id="i-trend" viewBox="0 0 24 24"><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></symbol>' +
  '<symbol id="i-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></symbol>' +
  '<symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-width="2.4"/></symbol>' +
  '<symbol id="i-note" viewBox="0 0 24 24"><path d="M6 3h9l5 5v13H6V3z"/><path d="M15 3v5h5M9 12h6M9 16h6"/></symbol>' +
  '<symbol id="i-car" viewBox="0 0 24 24"><path d="m4 13 2-6h12l2 6M4 13h16v5H4v-5z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/></symbol>' +
  '<symbol id="i-bus" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="14" rx="3"/><path d="M4 11h16M8 18v2M16 18v2"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></symbol>' +
  '<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>' +
  '<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></symbol>' +
  '<symbol id="i-lang" viewBox="0 0 24 24"><path d="M3 5h12M9 3v2M11 5c-1 4-4 7-7 9M6 8c1 3 4 6 7 8"/><path d="m13 21 4-9 4 9M14.5 18h5"/></symbol>' +
  '<symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></symbol>' +
  '<symbol id="i-location" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></symbol>' +
  '<symbol id="i-external" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></symbol>' +
  '<symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4v16l13-8L7 4z" fill="currentColor"/></symbol>' +
  '<symbol id="i-fire" viewBox="0 0 24 24"><path d="M12 22c-4 0-7-3-7-7 0-3 2-5 3-7 0 2 1 3 2 3 0-4 2-7 5-9 0 3 1 5 3 7s2 4 2 6c0 4-3 7-8 7z"/></symbol>' +
  '<symbol id="i-backpack" viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="14" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2M5 13h14M9 13v3M15 13v3"/></symbol>' +
  '<symbol id="i-at" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/></symbol>' +
  '<symbol id="i-hash" viewBox="0 0 24 24"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></symbol>' +
  '<symbol id="i-mic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></symbol>' +
  '<symbol id="i-smile" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.2 2 3.5 2 3.5-2 3.5-2M9 10h.01M15 10h.01" stroke-width="2.2"/></symbol>' +
  '<symbol id="i-headset" viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19a3 3 0 0 1-3 2h-3"/></symbol>' +
  '<symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" fill="currentColor" stroke="none"/></symbol>' +
  '<symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></symbol>' +
  '<symbol id="i-credit-card" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></symbol>' +
  '<symbol id="i-percent" viewBox="0 0 24 24"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></symbol>' +
  '<symbol id="i-badge-check" viewBox="0 0 24 24"><path d="m12 2 2.4 1.8 3-.3 1.1 2.8 2.7 1.3-.6 3 1.9 2.4-1.9 2.4.6 3-2.7 1.3-1.1 2.8-3-.3L12 22l-2.4-1.8-3 .3-1.1-2.8-2.7-1.3.6-3L1.5 11l1.9-2.4-.6-3 2.7-1.3L6.6 3.5l3 .3L12 2z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></symbol>' +
  '<symbol id="i-signal" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M2 16h3v5H2zM7.5 12h3v9h-3zM13 8h3v13h-3zM18.5 4h3v17h-3z"/></symbol>' +
  '<symbol id="i-wifi" viewBox="0 0 24 24"><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" stroke-width="2.2"/><circle cx="12" cy="19.5" r="1.4" fill="currentColor" stroke="none"/></symbol>' +
  '<symbol id="i-battery" viewBox="0 0 28 14"><rect x="1" y="1" width="23" height="12" rx="3.5" stroke-width="1.5"/><rect x="3" y="3" width="19" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M26 5v4" stroke-width="2"/></symbol>' +
  '</svg>';
  function inject() {
    if (document.getElementById('gezgin-sprite')) return;
    var div = document.createElement('div');
    div.id = 'gezgin-sprite';
    div.innerHTML = sprite;
    document.body.insertBefore(div, document.body.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject); else inject();
})();
