# Environment Variables Reference

This document describes all environment variables used in Health Watchers. Each variable is grouped by service and marked as **required** or **optional**.

**Last updated**: 2026-10-17  
**Sync with**: `packages/config/index.ts` validation logic

---

## Table of Contents

- [API Server Configuration](#api-server-configuration)
- [Database Configuration](#database-configuration)
- [Authentication (JWT)](#authentication-jwt)
- [Stellar Blockchain](#stellar-blockchain)
- [Encryption & Security](#encryption--security)
- [AI/LLM Integration](#aillm-integration)
- [CORS & Web Configuration](#cors--web-configuration)
- [Caching & Rate Limiting](#caching--rate-limiting)
- [Request Limits](#request-limits)
- [Logging & Observability](#logging--observability)
- [Email & SMTP](#email--smtp)
- [Backup & Disaster Recovery](#backup--disaster-recovery)
- [Notifications](#notifications)
- [Telehealth](#telehealth)
- [AWS Configuration](#aws-configuration)
- [File Storage](#file-storage)
- [Error Tracking](#error-tracking)
- [Background Jobs](#background-jobs)
- [Insurance Webhooks](#insurance-webhooks)

---

## API Server Configuration

### `API_PORT`
- **Type**: `number`
- **Required**: Yes
- **Default**: `3001`
- **Description**: Port on which the Express API server listens
- **Example**: `3001`, `8080`

### `NODE_ENV`
- **Type**: `string` (enum)
- **Required**: Yes
- **Default**: `development`
- **Valid Values**: `development`, `production`, `staging`, `test`
- **Description**: Application environment level, controls logging verbosity and middleware behavior
- **Examples**: `development` (verbose logging), `production` (minimal logging)

---

## Database Configuration

### `MONGO_URI`
- **Type**: `string` (MongoDB connection string)
- **Required**: Yes
- **Format**: `mongodb://[user:password@]host[:port]/database[?options]`
- **Default**: `mongodb://localhost:27017/health_watchers`
- **Description**: MongoDB connection string for persistent data storage
- **SECURITY**: CRITICAL — Rotate credentials quarterly in production
- **Examples**:
  - Local: `mongodb://localhost:27017/health_watchers`
  - Atlas: `mongodb+srv://username:password@cluster.mongodb.net/health_watchers`

### `MONGO_MAX_POOL_SIZE`
- **Type**: `number`
- **Required**: No
- **Default**: `10`
- **Description**: Maximum MongoDB connection pool size
- **Recommended for production**: `50`–`100` (adjust based on replica count)

### `MONGODB_POOL_SIZE`
- **Type**: `number`
- **Required**: No
- **Default**: `10`
- **Description**: Legacy alias for `MONGO_MAX_POOL_SIZE`; use `MONGO_MAX_POOL_SIZE` instead

---

## Authentication (JWT)

### `JWT_ACCESS_TOKEN_SECRET`
- **Type**: `string` (min 32 chars)
- **Required**: Yes
- **Default**: `dev-access-token-secret-change-in-production`
- **Description**: Secret key for signing access tokens (short-lived, ~15 min)
- **SECURITY**: CRITICAL — Rotate monthly in production
- **Generate**: `openssl rand -base64 32`

### `JWT_REFRESH_TOKEN_SECRET`
- **Type**: `string` (min 32 chars)
- **Required**: Yes
- **Default**: `dev-refresh-token-secret-change-in-production`
- **Description**: Secret key for signing refresh tokens (long-lived, ~7 days)
- **SECURITY**: CRITICAL — Rotate monthly in production
- **Generate**: `openssl rand -base64 32`

### `JWT_TEMP_TOKEN_SECRET`
- **Type**: `string` (min 32 chars)
- **Required**: Yes
- **Default**: `dev-temp-token-secret-change-in-production-min-32-chars`
- **Description**: Secret key for temporary tokens (password reset, email verification)
- **SECURITY**: CRITICAL — Rotate monthly in production
- **Generate**: `openssl rand -base64 32`

### `JWT_SECRET`
- **Type**: `string` (min 32 chars)
- **Required**: Yes (legacy, prefer specific token secrets)
- **Description**: Fallback secret used when specific token secrets are not set
- **Deprecated**: Use `JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET` instead

### `JWT_ISSUER`
- **Type**: `string`
- **Required**: No
- **Default**: `health-watchers-api`
- **Description**: Issuer claim in JWT payload (`iss`); used for token validation

### `JWT_AUDIENCE`
- **Type**: `string`
- **Required**: No
- **Default**: `health-watchers-client`
- **Description**: Audience claim in JWT payload (`aud`); used for token validation

---

## Stellar Blockchain

### `STELLAR_PORT`
- **Type**: `number`
- **Required**: Yes
- **Default**: `3002`
- **Description**: Port on which the Stellar microservice (`apps/stellar-service`) listens
- **Note**: Different from `API_PORT` — Stellar runs as a separate service

### `STELLAR_SERVICE_URL`
- **Type**: `string` (URL)
- **Required**: Yes
- **Default**: `http://localhost:3002`
- **Description**: Base URL of the Stellar microservice; used by API to call Stellar endpoints
- **Examples**:
  - Local: `http://localhost:3002`
  - Production: `https://stellar-service.example.com`

### `STELLAR_NETWORK`
- **Type**: `string` (enum)
- **Required**: Yes
- **Default**: `testnet`
- **Valid Values**: `testnet`, `mainnet`, `sandbox`
- **Description**: Stellar network to use for transactions
- **WARNING**: Changing to `mainnet` will process real XLM transactions and requires `MAINNET_CONFIRMED=true`

### `NEXT_PUBLIC_STELLAR_NETWORK`
- **Type**: `string` (enum)
- **Required**: Yes
- **Default**: `testnet`
- **Valid Values**: `testnet`, `mainnet`
- **Description**: Client-side replica of `STELLAR_NETWORK` (exposed to frontend)

### `STELLAR_SECRET_KEY`
- **Type**: `string` (Stellar secret key, starts with `S`)
- **Required**: Yes
- **Description**: Platform's private signing key for authorizing Stellar transactions server-side
- **SECURITY**: CRITICAL — Never expose to clients or commit to git; rotate annually
- **Generate testnet key**: https://laboratory.stellar.org/#account-creator
- **Mainnet**: Generate and store securely (use AWS Secrets Manager in production)

### `STELLAR_PUBLIC_KEY`
- **Type**: `string` (Stellar public key, starts with `G`)
- **Required**: Yes
- **Description**: Public key corresponding to `STELLAR_SECRET_KEY`

### `STELLAR_PLATFORM_PUBLIC_KEY`
- **Type**: `string` (Stellar public key, starts with `G`)
- **Required**: Yes
- **Description**: Public key of the platform's operational Stellar account (may differ from `STELLAR_PUBLIC_KEY`)

### `API_URL`
- **Type**: `string` (URL)
- **Required**: Yes
- **Default**: `http://localhost:3001`
- **Description**: Base URL of the API; used by Stellar microservice to POST confirmed payments to `/webhooks/stellar`
- **Examples**:
  - Local: `http://localhost:3001`
  - Production: `https://api.example.com`

### `SUPPORTED_ASSETS`
- **Type**: `string` (comma-separated asset codes)
- **Required**: No
- **Default**: `XLM`
- **Description**: Asset codes accepted by the payment system; XLM is always included
- **Valid Values**: Stellar asset codes (XLM, USDC, EURC, etc.)
- **Examples**:
  - `XLM` (only XLM)
  - `XLM,USDC` (XLM and USDC)
  - `XLM,USDC,EURC` (XLM, USDC, and EURC)

### `MAINNET_CONFIRMED`
- **Type**: `boolean` (string: `true` / `false`)
- **Required**: Yes (when `STELLAR_NETWORK=mainnet`)
- **Default**: `false`
- **Description**: Safety gate — must be explicitly set to `true` when `STELLAR_NETWORK=mainnet`
- **WARNING**: Omitting or setting to `false` when targeting mainnet causes `stellar-service` to exit with code 1
- **Mainnet only**: Set to `true` to enable real XLM transactions

### `STELLAR_MAX_TRANSACTION_XLM`
- **Type**: `number`
- **Required**: No
- **Default**: `1000`
- **Description**: Maximum XLM amount allowed in a single transaction (prevents accidental overpayment)
- **Units**: XLM (not stroops)

### `STELLAR_DRY_RUN`
- **Type**: `boolean` (string: `true` / `false`)
- **Required**: No
- **Default**: `false`
- **Description**: When `true`, simulates transactions without submitting to the Stellar network
- **Useful for**: Testing payment logic without real transactions

### `STELLAR_TX_TIMEOUT_SECONDS`
- **Type**: `number`
- **Required**: No
- **Default**: `30`
- **Description**: Timeout in seconds for Stellar transaction submission
- **Examples**:
  - `30` for immediate payments
  - `86400` (24 hours) for multi-sig coordination
  - `2592000` (30 days) for escrow

### `PAYMENT_INTENT_EXPIRY_HOURS`
- **Type**: `number`
- **Required**: No
- **Default**: `24`
- **Description**: Hours before a payment intent expires and must be recreated

---

## Encryption & Security

### `FIELD_ENCRYPTION_KEY`
- **Type**: `string` (64-char hex string = 32 bytes)
- **Required**: Yes (for PHI protection)
- **Description**: AES-256 key for field-level encryption of sensitive patient data (PHI)
- **HIPAA**: Required for HIPAA compliance; used to encrypt fields marked `encrypt: true` in schemas
- **SECURITY**: CRITICAL — Rotate annually; changing this key invalidates all previously encrypted data
- **Generate**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Usage**: All Patient PHI fields (SSN, medical record number, diagnoses, lab values) are encrypted at rest using this key

### `DOCUMENT_ENCRYPTION_KEY`
- **Type**: `string` (64-char hex string = 32 bytes, or base64 32-byte key)
- **Required**: No (optional; falls back to storage-layer encryption)
- **Description**: AES-256 key for envelope encryption of documents (e.g., PDFs, medical records)
- **Fallback**: When unset, documents use storage-layer encryption (S3 SSE) and `FIELD_ENCRYPTION_KEY` as secondary encryption
- **Generate**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## AI/LLM Integration

### `GEMINI_API_KEY`
- **Type**: `string`
- **Required**: No
- **Description**: Google Gemini API key for AI-powered features (e.g., clinical note summarization)
- **Get key**: https://makersuite.google.com/app/apikey

---

## CORS & Web Configuration

### `ALLOWED_ORIGINS`
- **Type**: `string` (comma-separated URLs)
- **Required**: No
- **Default**: `http://localhost:3000,http://localhost:3001`
- **Description**: URLs allowed to make REST API requests (CORS allowlist)
- **Examples**:
  - `http://localhost:3000` (single origin)
  - `http://localhost:3000,https://example.com` (multiple origins)

### `WEB_URL`
- **Type**: `string` (URL, comma-separated for multiple)
- **Required**: Yes (for production)
- **Default**: `http://localhost:3000`
- **Description**: Web frontend URL(s); Socket.IO uses this for CORS validation
- **Security**: Socket.IO rejects connections from origins not in this list
- **Examples**:
  - `http://localhost:3000`
  - `https://example.com,https://app.example.com`

### `NEXT_PUBLIC_API_URL`
- **Type**: `string` (URL)
- **Required**: Yes
- **Default**: `http://localhost:3001`
- **Description**: API base URL exposed to frontend (client-side configuration)
- **Note**: Prefix `NEXT_PUBLIC_` means this is accessible in browser; never include secrets here

---

## Caching & Rate Limiting

### `REDIS_URL`
- **Type**: `string` (Redis connection URL)
- **Required**: No (optional for single-instance dev)
- **Default**: (unset)
- **Description**: Redis URL for distributed caching and rate limiting across API replicas
- **Format**: `redis://[user:password@]host[:port]`
- **Examples**:
  - `redis://localhost:6379` (local)
  - `redis://:password@redis-prod.example.com:6379` (production with auth)
- **Usage**: 
  - Patient list caching (60s TTL)
  - Distributed rate limiting
  - Brute-force protection
- **Production**: CRITICAL — must be set for HIPAA-compliant rate limiting
- **Fallback**: When unset, uses in-memory cache (dev-only; not suitable for multi-instance deployments)

---

## Request Limits

### `MAX_REQUEST_BODY_SIZE`
- **Type**: `string` (size string)
- **Required**: No
- **Default**: `50kb`
- **Description**: Maximum HTTP request body size for regular endpoints
- **Format**: `<number><unit>` (e.g., `50kb`, `10mb`)

### `AI_REQUEST_BODY_SIZE`
- **Type**: `string` (size string)
- **Required**: No
- **Default**: `500kb`
- **Description**: Maximum HTTP request body size for AI endpoints (e.g., clinical note analysis)

---

## Logging & Observability

### `LOG_LEVEL`
- **Type**: `string` (enum)
- **Required**: No
- **Default**: `info`
- **Valid Values**: `debug`, `info`, `warn`, `error`
- **Description**: Logging verbosity level
- **Recommendations**:
  - `debug` for local development
  - `info` for production

### `ENV_NAME`
- **Type**: `string`
- **Required**: No
- **Default**: `development`
- **Description**: Environment identifier for monitoring/alerting dashboards
- **Examples**: `development`, `staging`, `production`

### `METRICS_USERNAME` & `METRICS_PASSWORD`
- **Type**: `string`
- **Required**: No
- **Description**: HTTP Basic Auth credentials for protecting Prometheus metrics endpoint (`GET /metrics`)
- **Usage**: Set both to enable basic auth; leave unset to use alternative methods
- **Default Creds**: `admin` / `change-in-production`

### `METRICS_ALLOWED_IPS`
- **Type**: `string` (comma-separated IPs)
- **Required**: No
- **Description**: IP addresses allowed to scrape metrics (alternative to basic auth)
- **Examples**: `127.0.0.1,10.0.0.5`

### `GRAFANA_ADMIN_USER` & `GRAFANA_ADMIN_PASSWORD`
- **Type**: `string`
- **Required**: No (dev/local only)
- **Default**: `admin` / `change-in-production`
- **Description**: Grafana admin credentials (used in docker-compose setup)

### `NEXT_TELEMETRY_DISABLED`
- **Type**: `boolean` (string: `1` / `0`)
- **Required**: No
- **Default**: `1` (disabled)
- **Description**: Disables Next.js telemetry collection

### `OTEL_EXPORTER_OTLP_ENDPOINT`
- **Type**: `string` (URL)
- **Required**: No
- **Description**: OpenTelemetry OTLP endpoint for distributed tracing export
- **Examples**:
  - `http://localhost:4318` (local Jaeger)
  - `https://trace.agent.datadoghq.com` (Datadog)
  - `https://api.honeycomb.io` (Honeycomb)
- **When unset**: Traces are printed to console (dev mode)

### `OTEL_SAMPLING_RATE`
- **Type**: `number` (0.0–1.0)
- **Required**: No
- **Default**: `1.0` (dev), `0.1` (prod)
- **Description**: Fraction of requests to include in distributed traces
- **Recommendations**:
  - `1.0` for development (all traces)
  - `0.1` for production (10% sampling to reduce volume)

### `SENTRY_DSN` & `NEXT_PUBLIC_SENTRY_DSN`
- **Type**: `string` (Sentry URL)
- **Required**: No
- **Description**: Sentry error tracking DSN for backend and frontend
- **Format**: `https://<key>@<host>.ingest.sentry.io/<project_id>`

### `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- **Type**: `string`
- **Required**: No (only if using Sentry)
- **Description**: Sentry configuration for automated source map uploads

---

## Email & SMTP

### `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- **Type**: `string`, `number`, `string`, `string`
- **Required**: No (fallback to no-op when unset)
- **Description**: SMTP server credentials for email delivery (password reset, notifications)
- **Defaults**: `localhost:587`, empty username/password
- **Examples**:
  - Gmail: `smtp.gmail.com:587`
  - SendGrid: `smtp.sendgrid.net:587`

### `SMTP_SECURE`
- **Type**: `boolean` (string: `true` / `false`)
- **Required**: No
- **Default**: `false`
- **Description**: Use TLS/SSL for SMTP connection

### `SMTP_FROM`
- **Type**: `string` (email address)
- **Required**: No
- **Default**: `no-reply@health-watchers.app`
- **Description**: From address for system-generated emails

### `EMAIL_FROM`
- **Type**: `string` (email address)
- **Required**: No
- **Default**: `no-reply@health-watchers.app`
- **Description**: (Duplicate of `SMTP_FROM`; legacy config)

### `APP_BASE_URL`
- **Type**: `string` (URL)
- **Required**: No
- **Default**: `http://localhost:3000`
- **Description**: Base URL for email links (e.g., password reset links)

---

## Backup & Disaster Recovery

### `BACKUP_ENCRYPTION_KEY`
- **Type**: `string` (min 32 chars)
- **Required**: No
- **Description**: AES-256 passphrase for encrypting MongoDB backups
- **Generate**: `openssl rand -base64 32`
- **Usage**: Protects backups when stored in S3 or other external storage

### `BACKUP_BUCKET`
- **Type**: `string` (S3 bucket name)
- **Required**: No
- **Description**: S3 bucket for storing encrypted backups

### `BACKUP_RETENTION_DAYS`
- **Type**: `number`
- **Required**: No
- **Default**: `30`
- **Description**: Number of days to retain backups (simple policy)

### `DAILY_KEEP`, `WEEKLY_KEEP`, `MONTHLY_KEEP`
- **Type**: `number`
- **Required**: No
- **Defaults**: `7`, `4`, `12`
- **Description**: Grandfather-father-son (GFS) retention policy (see `scripts/backup/enforce-retention.sh`)

### `GLACIER_AFTER_DAYS`
- **Type**: `number`
- **Required**: No
- **Default**: `30`
- **Description**: Age (in days) after which backups are transitioned to Glacier (cold storage)

### `FULL_BACKUP_HOUR`
- **Type**: `number` (0–23, UTC)
- **Required**: No
- **Default**: `02`
- **Description**: UTC hour at which the scheduler runs full backups (vs. incremental)

### `DR_BACKUP_BUCKET`
- **Type**: `string` (S3 bucket name)
- **Required**: No
- **Description**: (Optional) Cross-region backup bucket for geo-redundant disaster recovery

### `PUSHGATEWAY_URL`
- **Type**: `string` (URL)
- **Required**: No
- **Description**: Prometheus Pushgateway for backup/DR job metrics

---

## Notifications

### `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`
- **Type**: `string`, `number`, `string`, `string`
- **Required**: No
- **Description**: Email adapter (Nodemailer); falls back to no-op when unset

### `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`
- **Type**: `string`
- **Required**: No (if SMS notifications not used)
- **Description**: Twilio SMS credentials for SMS notification delivery

### `FCM_SERVER_KEY`
- **Type**: `string`
- **Required**: No (if push notifications not used)
- **Description**: Firebase Cloud Messaging server key for push notification delivery

---

## Telehealth

### `TELEHEALTH_VIDEO_PROVIDER`
- **Type**: `string` (enum)
- **Required**: No
- **Default**: `mock`
- **Valid Values**: `mock`, `twilio`, `zoom`
- **Description**: Video conference provider for telehealth sessions

### `TELEHEALTH_LINK_SECRET`
- **Type**: `string` (min 32 chars)
- **Required**: No
- **Fallback**: `JWT_ACCESS_TOKEN_SECRET`
- **Description**: HMAC key for secure meeting link generation

### `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`
- **Type**: `string`
- **Required**: If `TELEHEALTH_VIDEO_PROVIDER=twilio`
- **Description**: Twilio Video API credentials

### `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`
- **Type**: `string`
- **Required**: If `TELEHEALTH_VIDEO_PROVIDER=zoom`
- **Description**: Zoom OAuth credentials

---

## AWS Configuration

### `AWS_REGION`
- **Type**: `string`
- **Required**: No
- **Default**: `us-east-1`
- **Description**: AWS region for S3, Secrets Manager, and other services
- **Valid Values**: Any AWS region code (e.g., `us-east-1`, `eu-west-1`)

### `ENABLE_SECRETS_MANAGER`
- **Type**: `boolean` (string: `true` / `false`)
- **Required**: No
- **Default**: `false`
- **Description**: When `true`, load secrets from AWS Secrets Manager instead of `.env`
- **Production**: Recommended for production environments

---

## File Storage

### `STORAGE_DRIVER`
- **Type**: `string` (enum)
- **Required**: No
- **Default**: `local`
- **Valid Values**: `local`, `s3`
- **Description**: Storage backend for patient photos and documents
- **Recommendations**:
  - `local` for development
  - `s3` for production

### `LOCAL_UPLOAD_DIR`
- **Type**: `string` (file path)
- **Required**: No (when `STORAGE_DRIVER=local`)
- **Default**: `./uploads`
- **Description**: Local directory for storing uploaded files (dev only)

### `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- **Type**: `string`, `string`, `string`, `string`
- **Required**: If `STORAGE_DRIVER=s3`
- **Description**: AWS S3 credentials and bucket for file storage
- **SECURITY**: Use AWS IAM roles in production instead of access keys

---

## Error Tracking

### `SENTRY_DSN`
- **Type**: `string` (Sentry URL)
- **Required**: No
- **Description**: Sentry DSN for backend error tracking
- **Format**: `https://<key>@<host>.ingest.sentry.io/<project_id>`

### `NEXT_PUBLIC_SENTRY_DSN`
- **Type**: `string` (Sentry URL)
- **Required**: No
- **Description**: Sentry DSN for frontend error tracking (exposed to browser)

---

## Background Jobs

### `JOBS_ENABLED`
- **Type**: `boolean` (string: `true` / `false`)
- **Required**: No
- **Default**: `true`
- **Description**: Enable/disable background job execution on this process
- **Usage**: Set to `false` on API pods to leave job execution to dedicated worker pods

### `JOBS_WORKER_CONCURRENCY`
- **Type**: `number`
- **Required**: No
- **Default**: `5`
- **Description**: Maximum number of concurrent jobs one process may execute

### `JOB_<NAME>_CRON`, `JOB_<NAME>_ENABLED`
- **Type**: `string` (cron), `boolean`
- **Required**: No
- **Description**: Per-job overrides where `<NAME>` is the job name in UPPER_SNAKE_CASE
- **Examples**:
  - `JOB_XLM_RATE_CRON=*/5 * * * *` (check every 5 minutes)
  - `JOB_BALANCE_MONITORING_ENABLED=false` (disable balance monitoring)

---

## Insurance Webhooks

### `INSURANCE_WEBHOOK_SECRET`
- **Type**: `string`
- **Required**: No
- **Description**: Secret key for verifying webhook signatures from insurance partners

---

## Production Checklist

Before deploying to production, ensure:

- [ ] All `CRITICAL` secrets are set and rotated
- [ ] `MAINNET_CONFIRMED=true` only if `STELLAR_NETWORK=mainnet`
- [ ] `REDIS_URL` is configured for distributed rate limiting
- [ ] `FIELD_ENCRYPTION_KEY` and `DOCUMENT_ENCRYPTION_KEY` are set
- [ ] Database backups are configured (`BACKUP_BUCKET`, `BACKUP_ENCRYPTION_KEY`)
- [ ] Email/SMTP is configured for notifications
- [ ] `ENABLE_SECRETS_MANAGER=true` for secret rotation
- [ ] Logging and observability are configured (Sentry, OTEL)
- [ ] Storage driver is set to `s3` with valid AWS credentials

---

## Development Checklist

For local development:

- [ ] Copy `.env.example` to `.env`
- [ ] Generate testnet Stellar keypair (https://laboratory.stellar.org/#account-creator)
- [ ] Set `STELLAR_NETWORK=testnet` and `STELLAR_SECRET_KEY` to testnet key
- [ ] Leave `REDIS_URL` unset (uses in-memory cache)
- [ ] Set `STORAGE_DRIVER=local`
- [ ] Ensure `LOG_LEVEL=debug` for verbose output
