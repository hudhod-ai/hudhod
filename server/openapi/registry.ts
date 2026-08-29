import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  createProjectSchema,
  idParamSchema,
  problemSchema,
  projectListResponseSchema,
  projectSchema,
  projectVersionListResponseSchema,
  projectVersionSchema,
  updateProjectSchema,
} from "@/server/schemas/common";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

const revisionParamsSchema = idParamSchema.extend({
  revision: z.string().regex(/^\d+$/),
});

const versionUploadSchema = z.object({
  file: z.string().openapi({ type: "string", format: "binary" }),
  label: z.string().optional(),
  description: z.string().optional(),
  restoreFromVersionId: z.string().uuid().optional(),
});

registry.register("Problem", problemSchema);
registry.register("Project", projectSchema);
registry.register("ProjectVersion", projectVersionSchema);
registry.register("ProjectListResponse", projectListResponseSchema);
registry.register("ProjectVersionListResponse", projectVersionListResponseSchema);

const jsonResponse = (schema: z.ZodType, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

const problemResponse = {
  description: "Problem details.",
  content: { "application/problem+json": { schema: problemSchema } },
};

registry.registerPath({
  method: "get",
  path: "/projects",
  tags: ["Projects"],
  summary: "List projects",
  responses: {
    200: jsonResponse(projectListResponseSchema, "Projects owned by the current user."),
    500: problemResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/projects",
  tags: ["Projects"],
  summary: "Create a project",
  request: {
    body: { content: { "application/json": { schema: createProjectSchema } } },
  },
  responses: {
    201: jsonResponse(projectSchema, "The created project."),
    400: problemResponse,
    409: problemResponse,
  },
});

registry.registerPath({
  method: "get",
  path: "/projects/{id}",
  tags: ["Projects"],
  summary: "Get a project",
  request: { params: idParamSchema },
  responses: {
    200: jsonResponse(projectSchema, "The requested project."),
    404: problemResponse,
  },
});

registry.registerPath({
  method: "patch",
  path: "/projects/{id}",
  tags: ["Projects"],
  summary: "Update a project",
  request: {
    params: idParamSchema,
    body: { content: { "application/json": { schema: updateProjectSchema } } },
  },
  responses: {
    200: jsonResponse(projectSchema, "The updated project."),
    400: problemResponse,
    404: problemResponse,
  },
});

registry.registerPath({
  method: "delete",
  path: "/projects/{id}",
  tags: ["Projects"],
  summary: "Delete a project",
  request: { params: idParamSchema },
  responses: {
    200: jsonResponse(projectSchema, "The deleted project."),
    404: problemResponse,
  },
});

registry.registerPath({
  method: "get",
  path: "/projects/{id}/versions",
  tags: ["Versions"],
  summary: "List project versions",
  request: { params: idParamSchema },
  responses: {
    200: jsonResponse(projectVersionListResponseSchema, "Project versions ordered newest first."),
    404: problemResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/projects/{id}/versions",
  tags: ["Versions"],
  summary: "Create a project version",
  request: {
    params: idParamSchema,
    body: { content: { "multipart/form-data": { schema: versionUploadSchema } } },
  },
  responses: {
    201: jsonResponse(projectVersionSchema, "The created project version."),
    400: problemResponse,
    404: problemResponse,
  },
});

registry.registerPath({
  method: "get",
  path: "/projects/{id}/versions/{revision}",
  tags: ["Versions"],
  summary: "Get a project version",
  request: { params: revisionParamsSchema },
  responses: {
    200: jsonResponse(projectVersionSchema, "The requested project version."),
    404: problemResponse,
  },
});

registry.registerPath({
  method: "delete",
  path: "/projects/{id}/versions/{revision}",
  tags: ["Versions"],
  summary: "Delete a project version",
  request: { params: revisionParamsSchema },
  responses: {
    200: jsonResponse(projectVersionSchema, "The deleted project version."),
    404: problemResponse,
  },
});

registry.registerPath({
  method: "get",
  path: "/projects/{id}/versions/{revision}/archive",
  tags: ["Versions"],
  summary: "Download a project version archive",
  request: { params: revisionParamsSchema },
  responses: {
    200: {
      description: "The archived WebContainer filesystem snapshot.",
      content: { "application/gzip": { schema: z.string().openapi({ format: "binary" }) } },
    },
    404: problemResponse,
  },
});

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "MCPup API",
      version: "1.0.0",
      description:
        "Project lifecycle and versioned filesystem snapshots for MCPup.",
    },
    servers: [{ url: "/api" }],
  });
}
