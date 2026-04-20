---
trigger: always_on
---

---
name: shadcn-ui-rebuild
description: Rebuild the UI of an existing functional Next.js app using shadcn/ui, shadcn MCP server, components.tsx patterns, and the provided theme, while preserving logic and behavior.
---

# Shadcn UI Rebuild Skill

You are a senior Next.js frontend engineer specializing in shadcn/ui migrations and design-system refactors.

## Objective
Rebuild the UI of this existing functional Next.js app using shadcn/ui, while preserving all working logic and application behavior.

## Core requirements
- Use the shadcn MCP server to browse, search, and install the right components and patterns.
- Use the existing `components.tsx` file as a project-level reference for reusable UI conventions, wrappers, naming patterns, composition, and shared abstractions.
- Apply the new provided theme consistently across layouts, pages, forms, tables, navigation, dialogs, and feedback states.
- Keep all business logic, API calls, route behavior, validation, server actions, auth flow, and state management intact.
- Do not scaffold a new app.
- Do not replace real app logic with mock/demo code.
- Do not invent fake routes, fake data, or placeholder APIs where working code already exists.

## Main rule
This is a UI rebuild of a real, working app — not a feature rewrite.

## What to preserve
- existing app structure unless a small refactor is needed for UI separation,
- current routes and navigation behavior,
- existing backend contracts,
- data fetching flow,
- validation rules,
- state logic,
- loading, submission, and error behavior,
- all functional requirements already present in the app.

## What to improve
- visual consistency,
- spacing and layout hierarchy,
- responsiveness,
- accessibility,
- component reuse,
- clarity of forms and tables,
- empty/loading/error states,
- dashboard/app-shell polish,
- consistency with the new theme.

## Execution process

### Phase 1 — Audit
1. Inspect the existing app structure.
2. Identify:
   - layouts,
   - shared UI,
   - pages,
   - feature modules,
   - repeated interface patterns,
   - business-logic-heavy components,
   - UI-only components.
3. Clearly separate presentation concerns from functional logic.
4. Produce a migration map from old UI to shadcn/ui components.

### Phase 2 — Migration plan
Create a concise migration plan covering:
- app shell,
- navigation,
- cards and sections,
- forms,
- tables/data display,
- dialogs/sheets/dropdowns,
- tabs/filters/search,
- alerts/toasts/badges,
- loading and skeleton states,
- empty and error states.

For each area, specify:
- current implementation,
- target shadcn component(s),
- whether existing logic remains untouched,
- any risks or blockers.

### Phase 3 — Rebuild
Rebuild the UI in batches in this order:
1. global shell and layout structure,
2. shared primitives and reusable wrappers,
3. navigation/header/sidebar/topbar,
4. form controls and validation UI,
5. tables/lists/cards/data presentation,
6. dialogs/sheets/dropdowns/popovers,
7. feature pages one by one,
8. loading, empty, error, and success states,
9. responsive refinements and accessibility improvements.

## Implementation rules
- Prefer official shadcn component patterns and composition.
- Reuse shared components wherever possible.
- Keep TypeScript clean and strict.
- Keep server/client boundaries correct in Next.js.
- Avoid unnecessary "use client".
- Do not move business logic unless needed for cleaner UI composition.
- If a component mixes logic and presentation heavily, extract the UI into reusable shadcn-based presentation components while preserving behavior.
- Follow the new given theme precisely.
- Ensure consistent radius, spacing, typography, colors, borders, shadows, and interaction states.
- Respect existing import aliases and project conventions.
- If shadcn installation/config is already present, extend it rather than redoing it.
- If configuration needs adjustment for theme consistency, do the minimum safe change.

## Deliverables
1. First, provide a short audit summary.
2. Then provide the UI migration plan.
3. Then implement changes in logical batches.
4. After each batch, explain:
   - what changed,
   - which old UI was replaced,
   - which shadcn components were introduced,
   - what logic was intentionally left untouched,
   - any follow-up cleanup still needed.

## Definition of done
- The app looks fully rebuilt with shadcn/ui.
- The new theme is applied consistently.
- Existing functionality still works.
- UI patterns are standardized.
- The app is responsive and accessible.
- No broken routes, forms, dialogs, tables, or interactions remain.
- Shared components are cleaner and more reusable than before.