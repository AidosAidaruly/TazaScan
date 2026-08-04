# Architecture

This document defines the initial architecture direction for TazaScan.

## High-Level Architecture

TazaScan is organized as a monorepo with clearly separated applications and services:

```text
apps/mobile    Flutter mobile application
apps/admin     Future admin application
backend/api    Express API and Prisma database access
docs           Technical and product documentation
```

This structure keeps product surfaces independent while allowing shared planning, version control, and coordinated releases.

## Mobile Architecture

The Flutter app should follow Clean Architecture:

```text
presentation   Screens, widgets, UI state
application    Use cases, app services, orchestration
domain         Entities, value objects, repository contracts
data           API clients, DTOs, repository implementations
core           Shared utilities, errors, localization, theme
```

### Dependency Direction

Dependencies must point inward:

```text
presentation -> application -> domain
data -> domain
```

The domain layer must not depend on Flutter, HTTP clients, databases, or platform-specific packages.

## Backend Architecture

The backend API should be organized by feature modules:

```text
src/
  modules/
    auth/
    products/
    scans/
    favorites/
    submissions/
    admin/
  shared/
    config/
    database/
    errors/
    middleware/
    validation/
```

Each module should own its routes, controllers, services, validation schemas, and data-access logic.

## Database Direction

PostgreSQL will be the primary database. Prisma will manage schema, migrations, and type-safe database access.

The database must be designed for long-term growth:

- Hundreds of thousands of products
- Multiple barcode formats
- Multilingual product fields
- Ingredient normalization
- Nutrition facts
- Health score history
- User submissions and moderation
- Product photos in future storage

## Internationalization

The product must support English, Russian, and Kazakh from the beginning. User-facing text should not be hardcoded directly in UI components.

## Health Score Philosophy

The health score should be explainable. Users should not only see a number or grade; they should understand why the score was given.

Initial scoring can combine:

- Nutrition facts
- Ingredient risk flags
- Additives
- Sugar, salt, saturated fat levels
- Positive nutrition signals such as fiber and protein

The scoring system should be versioned so future algorithm changes do not corrupt historical analysis.

## Startup-Grade Decision Rules

- Prefer boring, proven tools over clever abstractions.
- Keep business rules out of UI components.
- Keep database access out of controllers.
- Avoid duplicate logic between mobile and backend.
- Add abstractions only when they reduce real complexity.
- Write code that a new engineer can understand quickly.
