import { z } from 'zod';
import { insertProjectSchema, insertFileSchema, insertUserSchema, insertMessageSchema } from './schema';

export function buildUrl(path: string, params: Record<string, string | number>): string {
  let url = path;
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, String(value));
  });
  return url;
}

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register',
      input: insertUserSchema.extend({
        email: z.string().email("Invalid email"),
        password: z.string().min(6, "Password must be at least 6 characters"),
      }),
      responses: {
        201: z.object({ id: z.number(), email: z.string() }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        email: z.string().email(),
        password: z.string(),
      }),
      responses: {
        200: z.object({ id: z.number(), email: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    user: {
      method: 'GET' as const,
      path: '/api/auth/user',
      responses: {
        200: z.object({ id: z.number(), email: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },
  projects: {
    list: {
      method: 'GET' as const,
      path: '/api/projects',
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects',
      input: insertProjectSchema,
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/projects/:id',
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/projects/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  files: {
    list: {
      method: 'GET' as const,
      path: '/api/projects/:projectId/files',
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/files',
      input: insertFileSchema.omit({ projectId: true }),
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/files/:id',
      input: insertFileSchema.partial(),
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/files/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  conversations: {
    list: {
      method: 'GET' as const,
      path: '/api/conversations',
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/conversations',
      input: z.object({
        title: z.string().optional(),
      }),
      responses: {
        200: z.any(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/conversations/:id',
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
  },
  chat: {
    send: {
      method: 'POST' as const,
      path: '/api/conversations/:conversationId/messages',
      input: z.object({
        content: z.string(),
        fileContent: z.string().optional(),
        modelOverride: z.enum(["auto", "haiku", "sonnet", "opus"]).optional().default("auto"),
      }),
      responses: {
        200: z.any(),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/conversations/:conversationId/messages',
      responses: {
        200: z.array(z.any()),
      },
    },
  },
  agent: {
    run: {
      method: 'POST' as const,
      path: '/api/agent/run',
      input: z.object({
        prompt: z.string(),
        projectContext: z.object({
          fileTree: z.array(z.string()).optional(),
          currentFile: z.object({
            name: z.string(),
            language: z.string(),
            content: z.string(),
          }).optional(),
        }).optional(),
      }),
      responses: {
        200: z.any(),
      },
    },
    plan: {
      method: 'POST' as const,
      path: '/api/agent/plan',
      input: z.object({
        prompt: z.string(),
        fileTree: z.array(z.string()).optional(),
      }),
      responses: {
        200: z.object({
          steps: z.array(z.string()),
          model: z.string(),
        }),
      },
    },
  },
};
