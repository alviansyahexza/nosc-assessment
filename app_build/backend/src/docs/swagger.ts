import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NoscAi Clinic Scheduling API',
      version: '1.0.0',
      description: 'API for Multi-Tenant Clinic Scheduling System (Sprint 3)',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        TenantIdAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Tenant-Id',
          description: 'Tenant ID required for multi-tenant isolation',
        },
      },
    },
    security: [
      {
        TenantIdAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  // Serve Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
