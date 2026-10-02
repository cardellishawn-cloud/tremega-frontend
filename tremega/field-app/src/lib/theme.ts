// src/lib/theme.ts — Tremega dark theme (single source of truth).
// Palette: near-black surfaces (never pure #000), amber accent, status set.
// All values pass WCAG AA on their intended backgrounds (primary text AAA).
export const colors = {
  // Surfaces
  bg: '#0B0D10',          // screen background (near-black, slight blue)
  card: '#15181C',        // cards, inputs
  surfaceAlt: '#1C2025',  // dialogs, sheets, nested surfaces
  cardBorder: '#23272E',  // card borders, dividers
  inputBorder: '#2E343C', // input borders (one step lighter)

  // Brand + text
  accent: '#F2A33C',      // Tremega amber
  accentText: '#101317',  // text ON amber
  text: '#EDEFF2',        // primary text (≈15:1 on bg — AAA)
  textDim: '#9AA1A8',     // secondary text (≈6:1 on card — AA+)
  textDisabled: '#5A6168',// disabled (3:1 — acceptable for disabled)

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // Overlays
  overlay: 'rgba(0,0,0,0.7)', // modal backdrop (spec: 0.7, not 0.5/0.6)
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Type scale (spec: 12 labels / 14 body / 16-18 headings / 24 titles).
export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, lineHeight: 29, color: colors.text },
  heading: { fontSize: 18, fontWeight: '600' as const, lineHeight: 23, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22, color: colors.text },
  label: { fontSize: 12, fontWeight: '500' as const, lineHeight: 17, color: colors.textDim },
  dim: { fontSize: 14, fontWeight: '400' as const, lineHeight: 21, color: colors.textDim },
} as const;

// Shared layout constants (tap targets per spec).
export const layout = {
  tapTarget: 48,   // minimum button dimension
  listItem: 56,    // minimum list row height
  radius: 12,
} as const;

// Legacy export kept for Phase-1 screens (jobs, login, more, job detail).
export const touch = {
  minTarget: 48,
  buttonRadius: 12,
} as const;
