# Project

Project is a product scanner app for Kazakhstan. The app helps users scan food barcodes and understand a product's health impact through clear scoring, nutrition analysis, ingredient explanations, alternatives, favorites, and scan history.

The final product targets Android and iOS, with a scalable backend and an admin system for maintaining a growing product database.

## Product Vision

Create the best food product scanner for Kazakhstan.

The product should be simple enough for everyday consumers, but technically strong enough to support hundreds of thousands of products, multilingual content, admin workflows, user submissions, and future AI-powered recommendations.

## Target Platforms

- Android
- iOS

## Core Technology Stack

- Flutter
- Dart
- Node.js
- Express
- PostgreSQL
- Prisma ORM
- Git

## Monorepo Structure

```text
Project/
  apps/
    mobile/       Flutter mobile app for Android and iOS
    admin/        Future admin panel for product management
  backend/
    api/          Node.js + Express API with Prisma
  docs/           Architecture, product, and technical documentation
```

## Core Features

- Barcode scanning
- Product search
- Product details
- Ingredient list
- Nutrition facts
- Health score
- Simple score explanation
- Better alternatives
- Favorites
- Scan history
- User authentication
- Admin panel for product management
- User submissions for missing products
- Dark mode
- English, Russian, and Kazakh languages

## Future Features

- AI ingredient explanations
- AI unhealthy ingredient detection
- AI recommendations
- Personalized nutrition
- Notifications
- Community contributions
- Product photos
- Offline caching
- Premium subscription

## Engineering Principles

- Clean Architecture
- SOLID principles
- Modular code
- Small files
- Reusable components
- Clear separation of UI, business logic, and data access
- Production-ready decisions from the start
- Documentation for architectural choices

## Development Workflow

Development is done step by step. Each step should include:

1. What we are building.
2. Why it matters.
3. Clean production-ready implementation.
4. How to test it.
5. Confirmation before moving to the next major step.

