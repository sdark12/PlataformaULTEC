---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults. Adapted for Plataforma ULTEC.
---

# Frontend Design — Plataforma ULTEC

Approach this as the design lead at a design studio known for giving every client a distinct visual identity. This client is **Plataforma ULTEC**, an educational management system (ERP + LMS) for technical schools in Latin America.

## Context: Plataforma ULTEC
- **Audience:** School administrators, secretaries, teachers, and students in Honduras/Latin America.
- **Stack:** React 19 + TypeScript + Tailwind CSS + Vite + Capacitor (mobile PWA).
- **Design System:** Dark/Light mode support via `dark:` Tailwind variants. Slate-based neutral palette with blue-600 primary accent.
- **Constraint:** All UI must be mobile-first (Capacitor app) AND desktop-responsive.

## Ground your designs in the subject matter

Plataforma ULTEC serves technical education institutions. The aesthetic should be **professional, clean, and institutional** — not playful or trendy. Think: organized data, clear hierarchy, easy scanning.

Before designing any new view:
1. Identify the **user role** (superadmin, admin, secretary, student)
2. Identify the **primary task** (data entry, data review, reporting, search)
3. Choose the appropriate density (compact for data tables, spacious for forms)

## Design Principles

### Typography
- Use the system font stack (`font-sans`) consistently. No custom web fonts that increase load time.
- Headings: `text-xl font-bold` to `text-2xl font-extrabold`. Never go above `text-3xl`.
- Body: `text-sm` (14px) for content, `text-xs` (12px) for labels and metadata.
- Line lengths under 80 characters for readability.
- **Avoid:** Accenting single words in headlines, ALL CAPS labels, unnecessary decorative labels above content.

### Color Palette
- **Primary:** `blue-600` (actions, links, active states)
- **Success:** `emerald-500` / `green-500`
- **Warning:** `amber-500` / `yellow-500`
- **Danger:** `red-500` / `rose-500`
- **Neutral:** `slate-50` through `slate-900` (backgrounds, borders, text)
- **Dark mode:** All components MUST include `dark:` variants. Background: `slate-900`/`slate-950`, text: `slate-100`/`slate-200`.

### Layout & Spacing
- Use consistent spacing scale: `gap-2`, `gap-3`, `gap-4`, `gap-6`. Never use arbitrary values like `gap-[13px]`.
- Cards: `rounded-xl` or `rounded-2xl` with `shadow-sm` in light mode, `border border-slate-700/50` in dark mode.
- Modals: Centered overlay with `backdrop-blur-sm`, max-width `max-w-2xl` for forms, `max-w-4xl` for data-heavy modals.
- Mobile: Full-width cards with `px-4` padding. No side margins less than `px-3`.

### Data Display
- **Tables (desktop):** Zebra striping via `even:bg-slate-50 dark:even:bg-slate-800/30`. Sticky headers.
- **Cards (mobile):** Each record as a compact card with clear visual hierarchy: title → metadata → actions.
- **Badges/Pills:** `rounded-full px-2 py-0.5 text-xs font-bold` for status indicators.
- **Empty states:** Always show a friendly message with an icon, never a blank area.

### Motion
- Use `transition-all` for interactive elements (buttons, toggles, tabs).
- No page-load animations or scroll-triggered reveals — this is a data-driven app, not a marketing site.
- Acceptable motion: modal open/close, toast notifications, dropdown menus.

## Process: Plan → Review → Build → Critique

1. **Plan:** Before writing JSX, describe the layout in words: what sections exist, their visual hierarchy, and their responsive behavior.
2. **Review:** Check against existing ULTEC views for consistency (color usage, spacing, component patterns).
3. **Build:** Write the component with full dark mode support and mobile responsiveness.
4. **Critique:** After building, review for: generic-looking elements, missing dark mode variants, accessibility gaps (contrast, focus states), and mobile overflow issues.

## Anti-patterns to Avoid
- Warm cream backgrounds (#F4F1EA) — use `slate-50` or `white` in light mode
- Purple/violet gradients as primary accent
- Card grids with identical layouts for different data types
- Decorative icons with no functional purpose
- Overly rounded corners (`rounded-3xl`) on small elements
- Excessive drop shadows (`shadow-lg`, `shadow-xl`) on non-elevated elements
