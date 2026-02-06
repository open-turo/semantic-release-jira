# Project Context

## Purpose

A semantic-release plugin for Jira integration. This plugin extends semantic-release to automatically update Jira issues based on releases and commits. It's part of the Open Turo organization's tooling ecosystem.

## Tech Stack

- TypeScript 5.9.3 (strict mode enabled)
- Node.js >= 20.0.0
- Vitest 4.0.16 (testing framework)
- ESLint 9.39.2 (linting with @open-turo/eslint-config-typescript)
- Prettier 3.7.4 (code formatting)
- ts-patch with typescript-transform-paths (path aliases support)
- ES Modules (type: "module")

## Project Conventions

### Code Style

- **Linting**: Uses `@open-turo/eslint-config-typescript` with Vitest configuration
- **Formatting**: Prettier with pre-commit hooks
- **TypeScript**: Strict mode enabled with:
  - `noImplicitAny: true`
  - `strictNullChecks: true`
  - `noImplicitReturns: true`
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - **NO `any` types allowed**
- **Path aliases**: Use `~/` prefix for src imports (e.g., `~/utils/foo`)
- **Module system**: ES Modules only
- **Pre-commit hooks**: Configured via `.pre-commit-config.yaml` including:
  - JSON/YAML validation
  - Prettier formatting
  - ESLint (with --fix)
  - Commitlint validation
  - Trailing whitespace/EOF fixes

### Architecture Patterns

- Plugin architecture following semantic-release conventions
- Entry point: `lib/index.js` (built from `src/index.ts`)
- TypeScript declarations included (`lib/index.d.ts`)
- Source maps enabled for debugging
- Path transformation at build time for module resolution

### Testing Strategy

- **Framework**: Vitest
- **Scripts**:
  - `npm test`: Run tests once
  - `npm run test:watch`: Watch mode for development
- **Type checking**: Separate `npm run check-types` script
- Lint must pass before tests

### Git Workflow

- **Commit convention**: Conventional Commits enforced via commitlint
- **Config**: Uses `@open-turo/commitlint-config-conventional`
- **Pre-commit validation**: All commits validated before being accepted
- **Branches**: Currently on feature branch `f/implement-plugin`
- **Commit structure**:
  - Conventional commit format (type(scope): message)
  - Title max 100 characters
  - No AI tool references in commits
  - Atomic commits preferred
  - Must use fotingo for Jira ticket workflow

## Domain Context

- **Semantic Release**: Automates version management and package publishing based on conventional commits
- **Jira Integration**: This plugin bridges semantic-release with Jira issue tracking
- Target use case: Automatically update Jira issues when releases are published
- Part of Open Turo's development toolchain

## Important Constraints

- **Node version**: Must support Node.js >= 20.0.0
- **License**: MIT
- **Organization**: @open-turo scoped package
- **Private package**: Currently marked as private
- **Build output**: Clean build directory before each build
- **TypeScript compilation**: Uses tspc (ts-patch compiler) for path transformation
- All dependencies must be pinned to specific versions

## External Dependencies

- **@open-turo/eslint-config-typescript**: Shared ESLint configuration
- **@open-turo/commitlint-config-conventional**: Shared commit lint rules
- **Semantic Release**: Core integration point (workspace dependency)
- **Jira**: External service for issue tracking (integration target)
