# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Package Management
This repository uses pnpm as the package manager:
- Install dependencies: `pnpm install`
- Update dependencies: `pnpm update`
- Remove a dependency: `pnpm remove <package>`

### Build System
- Build all packages: `pnpm run build`
- Type check all packages: `pnpm run typecheck`
- Type check only libraries: `pnpm run typecheck:libs`

### Individual Package Commands
Each package in `lib/` and `artifacts/` may have its own scripts. Check individual package.json files for:
- `pnpm run dev` - Start development server (typically in artifacts/*)
- `pnpm run test` - Run tests
- `pnpm run lint` - Run linter
- `pnpm run typecheck` - Type check

## Code Architecture

### Monorepo Structure
```
/
├── lib/                 # Shared libraries/packages
│   ├── api-client-react # React API client wrapper
│   ├── api-spec         # API specification and client generation config
│   ├── api-zod          # API schema definitions (Zod)
│   └── db               # Database layer (Drizzle ORM)
├── artifacts/           # Applications/services
│   ├── api-server       # Backend API server
│   ├── mockup-sandbox   # Mockup preview application
│   └── natives          # Main customer-facing application
├── scripts/             # Utility scripts
└── ...                  # Configuration files
```

### Key Technologies
- **TypeScript**: Primary language across all packages
- **React**: UI framework (used in artifacts/* applications)
- **Wouter**: Lightweight React router (used in natives App.tsx)
- **TanStack Query**: Data fetching and state management
- **Vite**: Build tool and dev server
- **Drizzle ORM**: Database ORM (lib/db/)
- **Orval**: API client generator (lib/api-spec/)
- **Zod**: Schema validation (lib/api-zod/)

### Important Files
- `tsconfig.base.json` - Base TypeScript configuration
- `pnpm-workspace.yaml` - PNPM workspace configuration defining package locations
- Individual `tsconfig.json` files in each package for specific overrides

### Development Workflow
1. Make changes to shared libraries in `lib/`
2. Build affected packages: `pnpm run build --filter=<package-name>`
3. Test changes in consuming applications in `artifacts/`
4. For UI changes, start dev server: `pnpm run dev` in the specific artifact directory

### Common Patterns
- API clients are generated via Orval from OpenAPI specs
- Database models defined in lib/db/src/schema/
- React components organized by feature in artifacts/*/src/
- Shared UI components in artifacts/*/src/components/ui/
- Layout components (Navbar, Footer) in artifacts/*/src/components/layout/