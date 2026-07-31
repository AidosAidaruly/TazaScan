# Development Workflow

Project is built incrementally. Each major step should be reviewed before moving to the next one.

## Step Format

Every implementation step should answer:

1. What are we building?
2. Why are we building it this way?
3. What code or structure changed?
4. How can it be tested?
5. What is the next recommended step?

## Quality Bar

Code should be treated as production code from the beginning:

- No quick hacks
- No duplicated business logic
- No large files without clear reason
- No UI mixed with API/database logic
- No hardcoded user-facing strings when localization is required
- No unreviewed architectural shortcuts

## Git Workflow

Recommended branch style:

```text
main
feature/mobile-foundation
feature/backend-foundation
feature/product-catalog
feature/barcode-scanner
```

Recommended commit style:

```text
type(scope): short description
```

Examples:

```text
docs(architecture): define initial monorepo structure
feat(mobile): add clean architecture folders
feat(api): add product module foundation
```

