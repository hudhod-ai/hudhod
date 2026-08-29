export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(404, "NOT_FOUND", message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
  }
}

export function toProblemResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        type: "https://api.example.com/problems",
        title: error.name,
        status: error.status,
        code: error.code,
        detail: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      { status: error.status },
    );
  }

  return Response.json(
    {
      type: "https://api.example.com/problems",
      title: "Internal Server Error",
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      detail: "An unexpected error occurred.",
    },
    { status: 500 },
  );
}
