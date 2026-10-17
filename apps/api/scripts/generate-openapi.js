#!/usr/bin/env node

/**
 * Generate OpenAPI specification from Zod schemas
 * 
 * This script scans route files and extracts Zod schemas to generate
 * an OpenAPI 3.0 specification document.
 */

const fs = require('fs');
const path = require('path');

/**
 * Load the Zod validation schemas and convert them to OpenAPI schema objects.
 *
 * The validation modules are authored in TypeScript, so we attempt to load
 * them through ts-node/register when available. If the schemas cannot be
 * loaded (e.g. dependencies are not installed), we fall back to a minimal
 * hand-maintained description so the generator still produces a valid spec.
 */
function loadZodSchemas() {
  const schemaModules = {
    patients: '../src/validations/patients.validation',
    encounters: '../src/validations/encounters.validation',
    appointments: '../src/validations/appointments.validation',
    payments: '../src/validations/payments.validation',
    invoices: '../src/validations/invoices.validation'
  };

  try {
    // Enable TypeScript transpilation for the validation modules.
    require('ts-node/register/transpile-only');
  } catch (err) {
    // ts-node is optional; continue and let the require below fail gracefully.
  }

  const loaded = {};
  for (const [name, modulePath] of Object.entries(schemaModules)) {
    try {
      loaded[name] = require(path.join(__dirname, modulePath));
    } catch (err) {
      console.warn(`⚠️  Could not load Zod schemas for "${name}": ${err.message}`);
      loaded[name] = null;
    }
  }
  return loaded;
}

/**
 * Convert a Zod schema to an OpenAPI 3.0 schema object.
 * Uses @asteasolutions/zod-to-openapi when available.
 */
function zodToOpenApiSchema(zodSchema) {
  if (!zodSchema) return null;
  try {
    const { z } = require('zod');
    const { extendZodWithOpenApi } = require('@asteasolutions/zod-to-openapi');
    extendZodWithOpenApi(z);
    const { OpenApiGeneratorV3 } = require('@asteasolutions/zod-to-openapi');
    const registry = new (require('@asteasolutions/zod-to-openapi').OpenAPIRegistry)();
    const ref = registry.register('Schema', zodSchema);
    const generator = new OpenApiGeneratorV3(registry.definitions);
    const components = generator.generateComponents();
    return components.components.schemas[ref.name] || null;
  } catch (err) {
    console.warn(`⚠️  Could not convert Zod schema to OpenAPI: ${err.message}`);
    return null;
  }
}

/**
 * Build the `components.schemas` section from the loaded Zod validation modules.
 * Each module is expected to export `create*Schema` / `update*Schema` validators.
 */
function buildComponentSchemas(zodModules) {
  const schemas = {};
  const entitySchemaExports = {
    patients: { create: 'createPatientSchema', update: 'updatePatientSchema' },
    encounters: { create: 'createEncounterSchema', update: 'updateEncounterSchema' },
    appointments: { create: 'createAppointmentSchema', update: 'updateAppointmentSchema' },
    payments: { create: 'createPaymentSchema', update: 'updatePaymentSchema' },
    invoices: { create: 'createInvoiceSchema', update: 'updateInvoiceSchema' }
  };

  for (const [entity, exports] of Object.entries(entitySchemaExports)) {
    const mod = zodModules[entity];
    if (!mod) continue;
    for (const [kind, exportName] of Object.entries(exports)) {
      const zodSchema = mod[exportName];
      if (!zodSchema) continue;
      const openApiSchema = zodToOpenApiSchema(zodSchema);
      if (openApiSchema) {
        const componentName = `${entity.slice(0, -1).replace(/^./, (c) => c.toUpperCase())}${kind === 'create' ? 'Create' : 'Update'}`;
        schemas[componentName] = openApiSchema;
      }
    }
  }
  return schemas;
}

const zodModules = loadZodSchemas();
const componentSchemas = buildComponentSchemas(zodModules);

/**
 * Build a request body that references a component schema when available,
 * otherwise falls back to the provided inline schema.
 */
function requestBodyFor(componentName, fallbackSchema) {
  const schema = componentSchemas[componentName]
    ? { $ref: `#/components/schemas/${componentName}` }
    : fallbackSchema;
  return {
    required: true,
    content: {
      'application/json': {
        schema
      }
    }
  };
}

// Placeholder OpenAPI spec - In a real implementation, this would:
// 1. Scan route files in src/routes/
// 2. Extract Zod schemas from request/response validators
// 3. Use a library like zod-to-openapi to convert schemas
// 4. Generate complete OpenAPI spec with all endpoints

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Health Watchers API',
    version: '1.0.0',
    description: 'Healthcare management platform API',
    contact: {
      name: 'Health Watchers Team',
      email: 'api@healthwatchers.example.com'
    }
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local development server'
    },
    {
      url: 'https://staging-api.healthwatchers.example.com',
      description: 'Staging server'
    },
    {
      url: 'https://api.healthwatchers.example.com',
      description: 'Production server'
    }
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check endpoint',
        description: 'Returns the API health status',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'User login',
        description: 'Authenticate user and return tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/patients': {
      post: {
        summary: 'Create a patient',
        description: 'Create a new patient record. Request body is validated with Zod.',
        requestBody: requestBodyFor('PatientCreate', {
          type: 'object',
          required: ['firstName', 'lastName'],
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' }
          }
        }),
        responses: {
          '201': { description: 'Patient created' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/patients/{id}': {
      patch: {
        summary: 'Update a patient',
        description: 'Partially update a patient record. Request body is validated with Zod.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: requestBodyFor('PatientUpdate', {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' }
          }
        }),
        responses: {
          '200': { description: 'Patient updated' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/encounters': {
      post: {
        summary: 'Create an encounter',
        description: 'Create a new clinical encounter. Request body is validated with Zod.',
        requestBody: requestBodyFor('EncounterCreate', {
          type: 'object',
          required: ['patientId'],
          properties: {
            patientId: { type: 'string' },
            notes: { type: 'string' }
          }
        }),
        responses: {
          '201': { description: 'Encounter created' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/encounters/{id}': {
      patch: {
        summary: 'Update an encounter',
        description: 'Partially update an encounter. Request body is validated with Zod.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: requestBodyFor('EncounterUpdate', {
          type: 'object',
          properties: {
            notes: { type: 'string' }
          }
        }),
        responses: {
          '200': { description: 'Encounter updated' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/appointments': {
      post: {
        summary: 'Create an appointment',
        description: 'Create a new appointment. Request body is validated with Zod.',
        requestBody: requestBodyFor('AppointmentCreate', {
          type: 'object',
          required: ['patientId', 'scheduledAt'],
          properties: {
            patientId: { type: 'string' },
            scheduledAt: { type: 'string', format: 'date-time' }
          }
        }),
        responses: {
          '201': { description: 'Appointment created' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/appointments/{id}': {
      patch: {
        summary: 'Update an appointment',
        description: 'Partially update an appointment. Request body is validated with Zod.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: requestBodyFor('AppointmentUpdate', {
          type: 'object',
          properties: {
            scheduledAt: { type: 'string', format: 'date-time' },
            status: { type: 'string' }
          }
        }),
        responses: {
          '200': { description: 'Appointment updated' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/payments': {
      post: {
        summary: 'Create a payment',
        description:
          'Create a payment. Supports idempotent retries via the `Idempotency-Key` header. ' +
          'If the same key is received again within 24 hours, the cached response is returned.',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            description:
              'Client-generated unique key used to make payment creation idempotent. ' +
              'Repeated requests with the same key return the original response.',
            schema: { type: 'string' }
          }
        ],
        requestBody: requestBodyFor('PaymentCreate', {
          type: 'object',
          required: ['amount', 'currency'],
          properties: {
            amount: { type: 'number' },
            currency: { type: 'string' }
          }
        }),
        responses: {
          '201': { description: 'Payment created' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/payments/batch': {
      post: {
        summary: 'Create a batch of payments',
        description:
          'Create multiple payments in a single request. Supports idempotent retries via the ' +
          '`Idempotency-Key` header (24-hour TTL).',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            description:
              'Client-generated unique key used to make batch payment creation idempotent.',
            schema: { type: 'string' }
          }
        ],
        requestBody: requestBodyFor('PaymentCreate', {
          type: 'object',
          required: ['payments'],
          properties: {
            payments: {
              type: 'array',
              items: { type: 'object' }
            }
          }
        }),
        responses: {
          '201': { description: 'Payments created' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/payments/recurring': {
      post: {
        summary: 'Create a recurring payment',
        description:
          'Create a recurring payment schedule. Supports idempotent retries via the ' +
          '`Idempotency-Key` header (24-hour TTL).',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            description:
              'Client-generated unique key used to make recurring payment creation idempotent.',
            schema: { type: 'string' }
          }
        ],
        requestBody: requestBodyFor('PaymentCreate', {
          type: 'object',
          required: ['amount', 'currency', 'interval'],
          properties: {
            amount: { type: 'number' },
            currency: { type: 'string' },
            interval: { type: 'string' }
          }
        }),
        responses: {
          '201': { description: 'Recurring payment created' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/payments/{id}': {
      patch: {
        summary: 'Update a payment',
        description: 'Partially update a payment. Request body is validated with Zod.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: requestBodyFor('PaymentUpdate', {
          type: 'object',
          properties: {
            status: { type: 'string' }
          }
        }),
        responses: {
          '200': { description: 'Payment updated' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/invoices': {
      post: {
        summary: 'Create an invoice',
        description: 'Create a new invoice. Request body is validated with Zod.',
        requestBody: requestBodyFor('InvoiceCreate', {
          type: 'object',
          required: ['patientId', 'amount'],
          properties: {
            patientId: { type: 'string' },
            amount: { type: 'number' }
          }
        }),
        responses: {
          '201': { description: 'Invoice created' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/invoices/{id}': {
      patch: {
        summary: 'Update an invoice',
        description: 'Partially update an invoice. Request body is validated with Zod.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: requestBodyFor('InvoiceUpdate', {
          type: 'object',
          properties: {
            status: { type: 'string' }
          }
        }),
        responses: {
          '200': { description: 'Invoice updated' },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    },
    '/api/v1/webhooks/incoming': {
      post: {
        summary: 'Receive an inbound webhook',
        description:
          'Inbound webhook endpoint for external systems (e.g. Stellar payment events). ' +
          'Requests must be signed with HMAC-SHA256; the signature is sent in the ' +
          '`X-Webhook-Signature` header. Requests with a missing or invalid signature ' +
          'are rejected with 401.',
        parameters: [
          {
            name: 'X-Webhook-Signature',
            in: 'header',
            required: true,
            description:
              'HMAC-SHA256 signature of the raw request body, hex encoded. ' +
              'Signing keys can be rotated; the previous key remains valid during the rotation window.',
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        },
        responses: {
          '200': { description: 'Webhook accepted' },
          '401': {
            description: 'Missing or invalid webhook signature',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/audit-logs': {
      get: {
        summary: 'List audit log entries',
        description:
          'Cursor-based pagination over audit log entries. Use `after` or `before` with the ' +
          '`nextCursor` / `prevCursor` values returned in the response.',
        parameters: [
          {
            name: 'after',
            in: 'query',
            required: false,
            description: 'Return entries created after this cursor (opaque `_id` value).',
            schema: { type: 'string' }
          },
          {
            name: 'before',
            in: 'query',
            required: false,
            description: 'Return entries created before this cursor (opaque `_id` value).',
            schema: { type: 'string' }
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Maximum number of entries to return.',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          }
        ],
        responses: {
          '200': {
            description: 'A page of audit log entries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { type: 'object' }
                    },
                    nextCursor: {
                      type: 'string',
                      nullable: true,
                      description: 'Cursor to pass as `after` to fetch the next page.'
                    },
                    prevCursor: {
                      type: 'string',
                      nullable: true,
                      description: 'Cursor to pass as `before` to fetch the previous page.'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/auth/refresh': {
      post: {
        summary: 'Refresh access token',
        description: 'Get a new access token using refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Invalid or expired refresh token'
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      ValidationError: {
        type: 'object',
        description: 'Structured validation error returned when a request fails Zod validation.',
        properties: {
          error: { type: 'string', example: 'Validation failed' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', example: 'body.email' },
                message: { type: 'string', example: 'Invalid email' }
              }
            }
          }
        }
      },
      ...componentSchemas
    }
  }
};

// Ensure output directory exists
const outputDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write OpenAPI spec
const outputPath = path.join(outputDir, 'openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2));

console.log(`✅ OpenAPI specification generated: ${outputPath}`);
console.log(`📄 Endpoints: ${Object.keys(openApiSpec.paths).length}`);
console.log(`🧩 Zod-derived schemas: ${Object.keys(componentSchemas).length}`);
if (Object.keys(componentSchemas).length === 0) {
  console.log(`\n⚠️  No Zod schemas were loaded. Ensure @asteasolutions/zod-to-openapi is installed`);
  console.log(`   and the validation modules export create*/update* schemas.`);
}
console.log(`\nTo extend this script:`);
console.log(`1. Install zod-to-openapi: npm install @asteasolutions/zod-to-openapi`);
console.log(`2. Scan route files and extract Zod schemas`);
console.log(`3. Convert Zod schemas to OpenAPI schema objects`);
console.log(`4. Build complete paths and operations`);
