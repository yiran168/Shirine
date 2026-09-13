# Local Development Guide

This document explains how to develop and debug the Shishirinee project locally.

## Quick Start

### 1. Clone the Project

```bash
git clone https://github.com/yiran168/ShiShishirineee.git
cd Shishirinee
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure Environment Variables

```bash
# Copy the example configuration file
cp .env.example .env.local

# Edit the configuration file with your actual settings
vim .env.local  # or use your preferred editor
```

### 4. Start the Development Server

```bash
bun run dev
```

This will automatically:
- 鉁?Generate `wrangler.toml` configuration file
- 鉁?Generate `.dev.vars` sensitive information file
- 鉁?Run database migrations
- 鉁?Start development server (port 11498 - unified frontend and backend)

Visit http://localhost:11498 to start developing!

## Environment Variable Configuration

All configurations are centralized in the `.env.local` file:

### Site Configuration

:::tip
Site configuration (name, avatar, description, pagination size, etc.) is now served dynamically from the backend and can be modified via the settings page after deployment. Environment variables are only used as default values.

The following environment variables are optional:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NAME` | No | Website name (can be modified later) | `My Blog` |
| `AVATAR` | No | Avatar URL (can be modified later) | `https://...` |
| `DESCRIPTION` | No | Website description (can be modified later) | `A blog` |
| `PAGE_SIZE` | No | Pagination size (can be modified later) | `5` |
| `RSS_ENABLE` | No | Enable RSS (can be modified later) | `false` |

### Backend Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `S3_ENDPOINT` | Yes | S3/R2 endpoint | `https://...r2.cloudflarestorage.com` |
| `S3_BUCKET` | Yes | Bucket name | `images` |
| `S3_REGION` | No | Region | `auto` |
| `S3_FOLDER` | No | Image storage path | `images/` |
| `WEBHOOK_URL` | No | Notification Webhook | `https://...` |

### Sensitive Configuration (Required)

| Variable | Description |
|----------|-------------|
| `Shishirinee_GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
| `Shishirinee_GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `JWT_SECRET` | JWT signing key |
| `S3_ACCESS_KEY_ID` | S3 Access Key |
| `S3_SECRET_ACCESS_KEY` | S3 Secret Key |

## Common Commands

```bash
# Start full development environment (recommended)
bun run dev

# Start frontend only
bun run dev:client

# Start backend only
bun run dev:server

# Run database migrations
bun run db:migrate

# Generate database migration files
bun run db:generate

# Regenerate configuration files
bun run dev:setup

# Build the project
bun run build

# Clean generated files
bun run clean

# Run type checking
bun run check

# Format code
bun run format:write
bun run format:check

# Run tests
bun run test              # Run all tests
bun run test:client       # Run client tests only
bun run test:server       # Run server tests only
bun run test:coverage     # Run tests with coverage
```

## Development Workflow

### First-time Setup

1. Fork the project repository
2. Clone to local
3. Install dependencies: `bun install`
4. Configure `.env.local`
5. Run `bun run dev`

### Daily Development

1. Modify code
2. Frontend auto-hot reloads, backend restarts automatically on changes
3. Test functionality
4. Commit code

### Database Changes

1. Modify `server/src/db/schema.ts`
2. Run `bun run db:generate` to generate migration files
3. Run `bun run db:migrate` to apply migrations

## Testing

The project uses different testing frameworks for client and server:

### Client Testing (Vitest)

Client tests use Bun's native test runner. React component tests import the shared jsdom setup before Testing Library.

```bash
# Run client tests
bun run test:client

# Watch mode
bun run test:client:watch

# With coverage
bun run test:client:coverage
```

Test files location: `client/src/**/__tests__/*.test.ts`

### Server Testing (Bun)

Server tests use Bun's native test runner with in-memory SQLite database.

```bash
# Run server tests
cd server && bun run test

# With coverage
bun run test:server:coverage
```

Test files location:
- Unit tests: `server/src/**/__tests__/*.test.ts`
- Integration tests: `server/tests/integration/`
- Security tests: `server/tests/security/`

### Adding New Tests

When adding new features, please include corresponding tests:

1. **Client**: Add tests in `client/src/**/__tests__/*.test.ts`
2. **Server**: Add tests in `server/src/**/__tests__/*.test.ts` or `server/tests/`

All tests must import their APIs from `bun:test`. Client DOM tests must import `client/src/test/setup.ts` before Testing Library; do not add a second test runner or a separate test configuration.

## API Architecture

### Custom API Client

The project uses a custom HTTP client instead of Eden for type-safe API communication:

- **Location**: `client/src/api/client.ts`
- **Features**: Type-safe requests, error handling, auth token management
- **Usage**: All API calls go through the typed client

### Shared Types (@Shishirinee/api)

The `@Shishirinee/api` package provides shared TypeScript types for both client and server:

- **Location**: `packages/api/`
- **Purpose**: End-to-end type safety for API contracts
- **Usage**: Import types from `@Shishirinee/api` in both client and server code

When adding new API endpoints:
1. Define types in `packages/api/src/types.ts`
2. Implement server handler in `server/src/services/`
3. Client automatically gets type safety through shared types

## Troubleshooting

### Port Already in Use

If ports 5173 or 11498 are occupied, you can modify the configuration in `.env.local`:

```bash
# Modify frontend port (needs configuration in vite.config.ts)
# Modify backend port
bun run dev:server -- --port 11499
```

### Database Migration Failed

```bash
# Clean local database and re-migrate
rm -rf .wrangler/state
bun run db:migrate
```

### Configuration Files Not Generated

```bash
# Manually run configuration generation
bun run dev:setup
```

### GitHub OAuth Configuration

GitHub OAuth needs to be configured for local development:

1. Visit https://github.com/settings/developers
2. Create a new OAuth App
3. Authorization callback URL: `http://localhost:11498/api/user/github/callback`
4. Fill Client ID and Client Secret into `.env.local`

## Project Structure

```
.
鈹溾攢鈹€ client/                 # Frontend code (React + Vite)
鈹?  鈹溾攢鈹€ src/
鈹?  鈹?  鈹溾攢鈹€ page/          # Page components
鈹?  鈹?  鈹溾攢鈹€ api/           # API client
鈹?  鈹?  鈹溾攢鈹€ components/    # React components
鈹?  鈹?  鈹斺攢鈹€ utils/         # Utility functions
鈹?  鈹斺攢鈹€ package.json
鈹溾攢鈹€ server/                 # Backend code (Cloudflare Workers)
鈹?  鈹溾攢鈹€ src/
鈹?  鈹?  鈹溾攢鈹€ services/      # Business services
鈹?  鈹?  鈹溾攢鈹€ db/            # Database schema
鈹?  鈹?  鈹溾攢鈹€ core/          # Router and core types
鈹?  鈹?  鈹斺攢鈹€ utils/         # Utility functions
鈹?  鈹溾攢鈹€ tests/             # Test files
鈹?  鈹斺攢鈹€ package.json
鈹溾攢鈹€ packages/               # Shared packages
鈹?  鈹斺攢鈹€ api/                # @Shishirinee/api - Shared API types
鈹溾攢鈹€ cli/                    # Shishirinee CLI tool
鈹?  鈹溾攢鈹€ bin/               # Thin executable entrypoints
鈹?  鈹溾攢鈹€ src/               # Commands, tasks, shared helpers
鈹?  鈹斺攢鈹€ templates/         # Git hook and file templates
鈹溾攢鈹€ scripts/                # Compatibility wrappers around CLI tasks
鈹溾攢鈹€ docs/                   # Documentation
鈹溾攢鈹€ .env.example            # Environment variable example
鈹溾攢鈹€ .env.local              # Local configuration (not committed to Git)
鈹斺攢鈹€ package.json
```

## Production Deployment

Please refer to the [Deployment Guide](./deploy.mdx) for production deployment procedures.

## Getting Help

- 馃摉 Full documentation: https://docs.openShishirinee.org
- 馃挰 Discord: https://discord.gg/JWbSTHvAPN
- 馃悰 Submit Issue: https://github.com/yiran168/ShiShishirineee/issues

