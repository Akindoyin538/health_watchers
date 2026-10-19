#!/usr/bin/env node

/**
 * Generate OpenAPI specification from Zod schemas
 * 
 * This script scans route files and extracts Zod schemas to generate
 * an OpenAPI 3.0 specification document.
 */

const fs = require('fs');
const path = require('path');

// Placeholder OpenAPI spec - In a real implementation, this would:
// 1. Scan route files in src/routes/
// 2. Extract Zod schemas from request/response validators
// 3. Use a library like zod-to-openapi to convert schemas
// 4. Generate complete OpenAPI spec with all endpoints

// ---------------------------------------------------------------------------
// Standardized pagination schemas (see .kiro/specs/api-pagination-standardization)
// ---------------------------------------------------------------------------

const paginationMetaSchema = {
  type: 'object',
  description: 'Pagination metadata returned alongside every list endpoint response',
  required: ['total', 'page', 'limit', 'totalPages', 'hasNext', 'hasPrev'],
  properties: {
    total: {
      type: 'integer',
      minimum: 0,
      description: 'Total number of records matching the query (ignoring pagination)',
      example: 42
    },
    page: {
      type: 'integer',
      minimum: 1,
      description: 'Current page number (1-based)',
      example: 1
    },
    limit: {
      type: 'integer',
      minimum: 1,
      description: 'Maximum number of records returned per page',
      example: 20
    },
    totalPages: {
      type: 'integer',
      minimum: 0,
      description: 'Total number of pages available',
      example: 3
    },
    hasNext: {
      type: 'boolean',
      description: 'Whether a next page exists',
      example: true
    },
    hasPrev: {
      type: 'boolean',
      description: 'Whether a previous page exists',
      example: false
    },
    nextCursor: {
      type: 'string',
      nullable: true,
      description: 'Opaque cursor for fetching the next page (cursor-based pagination only)',
      example: 'eyJpZCI6IjEyMyJ9'
    }
  }
};

/**
 * Build a PaginatedResponse component schema for a given item schema.
 */
function buildPaginatedResponseSchema(itemSchema, description) {
  return {
    type: 'object',
    description: description || 'Standardized paginated response envelope',
    required: ['data', 'pagination'],
    properties: {
      data: {
        type: 'array',
        items: itemSchema
      },
      pagination: {
        $ref: '#/components/schemas/PaginationMeta'
      }
    }
  };
}

// Shared query parameters for list endpoints
const paginationQueryParameters = [
  {
    name: 'page',
    in: 'query',
    required: false,
    description: 'Page number (1-based). Defaults to 1.',
    schema: { type: 'integer', minimum: 1, default: 1 }
  },
  {
    name: 'limit',
    in: 'query',
    required: false,
    description: 'Maximum number of records per page. Defaults to 20, max 100.',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
  },
  {
    name: 'sort',
    in: 'query',
    required: false,
    description: 'Field to sort by, optionally prefixed with "-" for descending order.',
    schema: { type: 'string', example: '-createdAt' }
  },
  {
    name: 'cursor',
    in: 'query',
    required: false,
    description: 'Opaque cursor for cursor-based pagination. When provided, takes precedence over page.',
    schema: { type: 'string' }
  }
];

// Item schemas for list endpoints (minimal placeholders; extend as Zod schemas are wired in)
const listItemSchemas = {
  Patient: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      dateOfBirth: { type: 'string', format: 'date' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  Encounter: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      patientId: { type: 'string', format: 'uuid' },
      encounterDate: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  Appointment: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      patientId: { type: 'string', format: 'uuid' },
      scheduledAt: { type: 'string', format: 'date-time' },
      status: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  Payment: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      invoiceId: { type: 'string', format: 'uuid' },
      amount: { type: 'number' },
      status: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  Invoice: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      patientId: { type: 'string', format: 'uuid' },
      total: { type: 'number' },
      status: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  LabResult: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      patientId: { type: 'string', format: 'uuid' },
      testName: { type: 'string' },
      resultDate: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  Medication: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      patientId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      dosage: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  Referral: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      patientId: { type: 'string', format: 'uuid' },
      referredTo: { type: 'string' },
      status: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  Notification: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      read: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  }
};

/**
 * Build a standard GET list operation for a resource.
 */
function buildListOperation(resourceName, itemSchemaName) {
  return {
    summary: `List ${resourceName}`,
    description: `Returns a paginated list of ${resourceName} using the standardized pagination envelope.`,
    parameters: paginationQueryParameters,
    responses: {
      '200': {
        description: `Paginated list of ${resourceName}`,
        content: {
          'application/json': {
            schema: {
              $ref: `#/components/schemas/Paginated${itemSchemaName}Response`
            }
          }
        }
      },
      '400': {
        description: 'Invalid pagination parameters',
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
  };
}

// List endpoints that must use the standardized pagination envelope
const listEndpoints = [
  { path: '/api/v1/patients', resourceName: 'patients', itemSchemaName: 'Patient' },
  { path: '/api/v1/encounters', resourceName: 'encounters', itemSchemaName: 'Encounter' },
  { path: '/api/v1/appointments', resourceName: 'appointments', itemSchemaName: 'Appointment' },
  { path: '/api/v1/payments', resourceName: 'payments', itemSchemaName: 'Payment' },
  { path: '/api/v1/invoices', resourceName: 'invoices', itemSchemaName: 'Invoice' },
  { path: '/api/v1/lab-results', resourceName: 'lab results', itemSchemaName: 'LabResult' },
  { path: '/api/v1/medications', resourceName: 'medications', itemSchemaName: 'Medication' },
  { path: '/api/v1/referrals', resourceName: 'referrals', itemSchemaName: 'Referral' },
  { path: '/api/v1/notifications', resourceName: 'notifications', itemSchemaName: 'Notification' }
];

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
      PaginationMeta: paginationMetaSchema
    }
  }
};

// Register item schemas and their paginated response wrappers
for (const [schemaName, schema] of Object.entries(listItemSchemas)) {
  openApiSpec.components.schemas[schemaName] = schema;
  openApiSpec.components.schemas[`Paginated${schemaName}Response`] = buildPaginatedResponseSchema(
    { $ref: `#/components/schemas/${schemaName}` },
    `Standardized paginated response for ${schemaName} resources`
  );
}

// Apply the standardized list operation to every list endpoint
for (const endpoint of listEndpoints) {
  const existing = openApiSpec.paths[endpoint.path] || {};
  openApiSpec.paths[endpoint.path] = {
    ...existing,
    get: buildListOperation(endpoint.resourceName, endpoint.itemSchemaName)
  };
}

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
console.log(`📦 Paginated list endpoints: ${listEndpoints.length}`);
console.log(`\nTo extend this script:`);
console.log(`1. Install zod-to-openapi: npm install @asteasolutions/zod-to-openapi`);
console.log(`2. Scan route files and extract Zod schemas`);
console.log(`3. Convert Zod schemas to OpenAPI schema objects`);
console.log(`4. Build complete paths and operations`);
