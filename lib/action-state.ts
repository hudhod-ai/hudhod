import { z } from "zod";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; message: string };

export const initialActionState: ActionState = { status: "idle" };

export function validationError(error: z.ZodError): ActionState {
  const { fieldErrors, formErrors } = z.flattenError(error);

  return {
    status: "error",
    message: formErrors[0] ?? "Please correct the highlighted fields.",
    fieldErrors,
  };
}

export function actionError(error: unknown): ActionState {
  return {
    status: "error",
    message: error instanceof Error ? error.message : "Something went wrong.",
  };
}
