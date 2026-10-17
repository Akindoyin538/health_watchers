#!/usr/bin/env node
/**
 * scripts/generate-postman.js
 *
 * Generates / validates the Postman collection against the live OpenAPI spec.
 *
 * Usage:
 *   node scripts/generate-postman.js            # validate only (CI mode)
 *   node scripts/generate-postman.js --update   # overwrite collection file
 *
 * Requires: npm install -g openapi-to-postmanv2
 * Or run via: npx openapi-to-postmanv2
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COLLECTION_PATH = path.resolve(
  __dirname,
  '../docs/postman/health-watchers.postman_collection.json'
);
const OPENAPI_PATH = path.resolve(__dirname, '../apps/api/docs/openapi.json');

const update = process.argv.includes('--update');

// ── 1. Export OpenAPI spec from the running API (or use cached file) ──────────
function exportOpenApiSpec() {
  // Try to fetch from live server first; fall back to generating via ts-node
  try {
    const raw = execSync('curl -sf http://localhost:3001/api/docs/swagger.json 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000,
    });
    return JSON.parse(raw);
  } catch {
    // Not running — generate from source using swagger-jsdoc
    console.log('API not running; generating spec from source…');
    const spec = execSync(
      `node -e "
        const swaggerJsdoc = require('swagger-jsdoc');
        const path = require('path');
        // Minimal options pointing at the api src
        const opts = {
          definition: { openapi: '3.0.3', info: { title: 'Health Watchers API', version: '1.0.0' } },
          apis: ['${path.resolve(__dirname, '../apps/api/src')}/**/*.ts'],
        };
        process.stdout.write(JSON.stringify(swaggerJsdoc(opts)));
      "`,
      { encoding: 'utf8', cwd: path.resolve(__dirname, '../apps/api') }
    );
    return JSON.parse(spec);
  }
}

// ── 2. Convert OpenAPI → Postman using openapi-to-postmanv2 ──────────────────
function convertToPostman(openapiSpec) {
  const tmpInput = path.resolve(__dirname, '../.tmp-openapi.json');
  const tmpOutput = path.resolve(__dirname, '../.tmp-postman.json');

  fs.writeFileSync(tmpInput, JSON.stringify(openapiSpec, null, 2));

  try {
    execSync(
      `npx --yes openapi-to-postmanv2 -s "${tmpInput}" -o "${tmpOutput}" -p -O folderStrategy=Tags,requestParametersResolution=Example,optimizeConversion=false`,
      { stdio: 'pipe' }
    );
    return JSON.parse(fs.readFileSync(tmpOutput, 'utf8'));
  } finally {
    [tmpInput, tmpOutput].forEach((f) => {
      try {
        fs.unlinkSync(f);
      } catch {}
    });
  }
}

// ── 3. Augment collection with headers/params not always emitted by converter ─
// The OpenAPI → Postman converter does not reliably emit custom headers or
// cursor query params, so we inject them explicitly to keep the generated
// collection in sync with the spec.
const PAYMENT_POST_PATHS = ['/payments', '/payments/batch', '/payments/recurring'];
const INBOUND_WEBHOOK_PATH = '/webhooks/inbound';
const AUDIT_LOG_PATH = '/audit-logs';

function normalizePath(rawPath) {
  if (!rawPath) return '';
  // Postman paths look like "{{baseUrl}}/payments" or "/payments"
  return rawPath.replace(/^\{\{[^}]+\}\}/, '').replace(/\/+$/, '') || '/';
}

function ensureHeader(request, key, value, description) {
  request.header = request.header || [];
  if (request.header.some((h) => (h.key || '').toLowerCase() === key.toLowerCase())) {
    return;
  }
  request.header.push({ key, value, description, type: 'text' });
}

function ensureQueryParam(request, key, value, description) {
  request.url = request.url || {};
  if (typeof request.url === 'string') {
    request.url = { raw: request.url };
  }
  request.url.query = request.url.query || [];
  if (request.url.query.some((q) => (q.key || '').toLowerCase() === key.toLowerCase())) {
    return;
  }
  request.url.query.push({ key, value, description, disabled: true });
}

function walkItems(items, visit) {
  (items || []).forEach((item) => {
    if (item.item) {
      walkItems(item.item, visit);
    } else if (item.request) {
      visit(item);
    }
  });
}

function augmentCollection(collection) {
  walkItems(collection.item, (item) => {
    const request = item.request;
    const method = (request.method || 'GET').toUpperCase();
    const rawUrl = typeof request.url === 'string' ? request.url : request.url && request.url.raw;
    const pathname = normalizePath(rawUrl);

    if (method === 'POST' && PAYMENT_POST_PATHS.includes(pathname)) {
      ensureHeader(
        request,
        'Idempotency-Key',
        '{{$guid}}',
        'Unique key to make payment creation idempotent (24h TTL).'
      );
    }

    if (method === 'POST' && pathname === INBOUND_WEBHOOK_PATH) {
      ensureHeader(
        request,
        'X-Webhook-Signature',
        '{{webhookSignature}}',
        'HMAC-SHA256 signature of the raw request body.'
      );
    }

    if (method === 'GET' && pathname === AUDIT_LOG_PATH) {
      ensureQueryParam(request, 'after', '{{afterCursor}}', 'Return entries after this cursor (_id).');
      ensureQueryParam(request, 'before', '{{beforeCursor}}', 'Return entries before this cursor (_id).');
    }
  });
  return collection;
}

// ── 4. Validate collection covers required folders ────────────────────────────
function validateCollection(collection) {
  const required = ['Auth', 'Patients', 'Encounters', 'Payments'];
  const folders = (collection.item || []).map((i) => i.name);
  const missing = required.filter(
    (r) => !folders.some((f) => f.toLowerCase().includes(r.toLowerCase()))
  );

  if (missing.length > 0) {
    console.error(`❌ Collection missing required folders: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`✅ Collection validated — folders present: ${folders.join(', ')}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
if (update) {
  console.log('Generating Postman collection from OpenAPI spec…');
  const spec = exportOpenApiSpec();
  const collection = augmentCollection(convertToPostman(spec));
  validateCollection(collection);
  fs.writeFileSync(COLLECTION_PATH, JSON.stringify(collection, null, 2));
  console.log(`✅ Written to ${COLLECTION_PATH}`);
} else {
  // Validate mode: just check the existing collection has the required folders
  console.log('Validating existing Postman collection…');
  if (!fs.existsSync(COLLECTION_PATH)) {
    console.error(`❌ Collection not found at ${COLLECTION_PATH}`);
    process.exit(1);
  }
  const collection = augmentCollection(JSON.parse(fs.readFileSync(COLLECTION_PATH, 'utf8')));
  validateCollection(collection);
}
