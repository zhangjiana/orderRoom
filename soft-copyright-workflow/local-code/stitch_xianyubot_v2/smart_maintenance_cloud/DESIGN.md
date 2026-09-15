---
name: Smart Maintenance Cloud
colors:
  surface: '#f7f9fc'
  surface-dim: '#d8dadd'
  surface-bright: '#f7f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f7'
  surface-container: '#eceef1'
  surface-container-high: '#e6e8eb'
  surface-container-highest: '#e0e3e6'
  on-surface: '#191c1e'
  on-surface-variant: '#414755'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f4'
  outline: '#727786'
  outline-variant: '#c1c6d7'
  surface-tint: '#0059c7'
  primary: '#0057c2'
  on-primary: '#ffffff'
  primary-container: '#006ef2'
  on-primary-container: '#fefcff'
  inverse-primary: '#afc6ff'
  secondary: '#266d00'
  on-secondary: '#ffffff'
  secondary-container: '#85fa51'
  on-secondary-container: '#287100'
  tertiary: '#7d5400'
  on-tertiary: '#ffffff'
  tertiary-container: '#9d6a00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#afc6ff'
  on-primary-fixed: '#001a43'
  on-primary-fixed-variant: '#004398'
  secondary-fixed: '#88fd54'
  secondary-fixed-dim: '#6de039'
  on-secondary-fixed: '#062100'
  on-secondary-fixed-variant: '#1a5200'
  tertiary-fixed: '#ffddb0'
  tertiary-fixed-dim: '#ffba45'
  on-tertiary-fixed: '#281800'
  on-tertiary-fixed-variant: '#614000'
  background: '#f7f9fc'
  on-background: '#191c1e'
  surface-variant: '#e0e3e6'
typography:
  display-lg:
    fontFamily: Inter, PingFang SC
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
  headline-md:
    fontFamily: Inter, PingFang SC
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter, PingFang SC
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter, PingFang SC
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  title-md:
    fontFamily: Inter, PingFang SC
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter, PingFang SC
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter, PingFang SC
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-md:
    fontFamily: Inter, PingFang SC
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter, PingFang SC
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  headline-md-mobile:
    fontFamily: Inter, PingFang SC
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 24px
  gutter: 16px
---

## Brand & Style

The design system is engineered for high-utility SaaS environments, specifically tailored for industrial maintenance and cloud operations. The brand personality is rooted in **Precision**, **Efficiency**, and **Trustworthiness**. It avoids decorative excess in favor of a "Corporate Modern" aesthetic that prioritizes data legibility and rapid task completion.

The visual language utilizes a structured, clean interface inspired by modern enterprise standards. It leverages a light, airy background with distinct, elevated surfaces to define workspace boundaries. The goal is to provide a calm, professional environment where complex technical data is organized logically, reducing cognitive load for operators and administrators.

## Colors

The color palette is built around a "Corporate Blue" primary, signifying stability and technical competence. The system uses a high-contrast functional palette for status communication:
- **Primary (#1677FF):** Used for actions, links, and active states.
- **Success (#52C41A):** Indicates normal operation, completed tasks, and healthy assets.
- **Warning (#FAAD14):** Used for caution, pending maintenance, or non-critical alerts.
- **Error (#FF4D4F):** Reserved for critical failures, system downtime, or destructive actions.
- **Backgrounds:** The primary app background uses a cool grey (#F5F7FA) to separate the interface chrome from content cards which are pure white (#FFFFFF).

Text colors follow a strict hierarchy to ensure legibility, with a dark charcoal for primary content and a medium grey for metadata and secondary labels.

## Typography

This design system utilizes **Inter** for Latin characters and numerals to ensure maximum clarity in data tables, paired with **PingFang SC** for Simplified Chinese characters. The typographic scale is optimized for high information density.

- **Primary Body:** 14px (body-md) is the standard for most interface text, providing a balance between screen real estate and readability.
- **Numerical Data:** Tabular numbers should be used in tables to ensure columns align vertically for easier comparison.
- **Hierarchy:** Use fontWeight 600 for section headers (headline-sm) to clearly demarcate different functional areas of the dashboard.

## Layout & Spacing

The layout utilizes a **12-column fluid grid** system for the main content area, with a fixed-width sidebar for navigation. 

- **Sidebar:** Fixed at 240px width in the light theme.
- **Gutter & Margins:** A standard 16px gutter (spacing.md) exists between grid columns, with 24px outer margins (spacing.lg) for the main page container.
- **Density:** Spacing follows an 8px base grid. For high-density tables or compact toolbars, the 4px (spacing.xs) unit is used for internal element padding.
- **Breakpoints:** 
  - Mobile: < 768px (Sidebar collapses to a drawer, content becomes single column).
  - Tablet: 768px - 1280px (Fluid grid).
  - Desktop: > 1280px (Max-width for content content areas to maintain readability).

## Elevation & Depth

Visual hierarchy is primarily established through **Tonal Layers** and subtle shadows. The background is a neutral grey, while active workspace elements (Cards, Tables) are pure white.

- **Level 0 (Background):** #F5F7FA.
- **Level 1 (Cards/Surface):** White background with a subtle border (#E5E7EB) and a soft ambient shadow (0px 2px 8px rgba(0, 0, 0, 0.05)).
- **Level 2 (Dropdowns/Modals):** High elevation with a more pronounced shadow (0px 4px 12px rgba(0, 0, 0, 0.12)) to indicate temporary interaction layers over the main UI.

This approach creates a flat, professional look while providing enough depth cues for the user to understand the interface structure.

## Shapes

The design system uses a **Soft** shape language to appear modern yet professional. 

- **Standard Elements (Buttons, Inputs):** 4px to 6px radius. This provides a clean, disciplined look without the clinical feel of sharp corners.
- **Containers (Cards):** 8px radius (rounded-lg) for main content areas to create a distinct, containerized feel.
- **Pill Shapes:** Reserved exclusively for status tags and badges to differentiate them from actionable buttons.

## Components

### Buttons (按钮)
- **Primary:** Solid #1677FF with white text. 4px radius.
- **Default:** White background with #E5E7EB border and #1F2937 text.
- **Ghost:** No background, primary color text; used for secondary actions.

### Status Tags (状态标签)
- All tags are **pill-shaped** with 50% opacity backgrounds based on the status color (Success, Warning, Error) and high-contrast text.
- Example: 运行中 (Running) uses a light green background with dark green text.

### Cards (卡片)
- White background, 8px radius, subtle border.
- Headers should have a 1px bottom border (#E5E7EB) and consistent 16px internal padding.

### Data Tables (表格)
- High density: 12px vertical cell padding.
- Zebra striping is not required; use thin 1px horizontal borders instead.
- Column headers (表头) use a light grey background (#FAFAFA) and 500 weight text.

### Sidebar (侧边栏)
- **Light Theme:** White background with a 1px right border. 
- Active menu items use a light blue background (#E6F4FF) and a 3px right-aligned primary blue accent bar.

### Input Fields (输入框)
- 4px radius, #E5E7EB border. On focus, use a 2px primary blue halo with 20% opacity.
- Labels (标签名) are positioned above the input in 14px (body-md) text.