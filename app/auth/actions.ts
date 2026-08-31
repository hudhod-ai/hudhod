"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { actionError, type ActionState, validationError } from "@/lib/action-state";
import { createClient } from "@/lib/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/server/schemas/common";

async function origin() {
  const requestHeaders = await headers();
  return requestHeaders.get("origin") ?? `http://${requestHeaders.get("host") ?? "localhost:3000"}`;
}

export async function signUpAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback`,
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        phone: parsed.data.phone || null,
        company: parsed.data.company || null,
        country: parsed.data.country || null,
      },
    },
  });
  if (error) return actionError(error);

  redirect("/auth/login?message=Check your email to confirm your account.");
}

export async function signInAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await (await createClient()).auth.signInWithPassword(parsed.data);
  if (error) return actionError(error);

  redirect("/projects");
}

export async function signOutAction(_: ActionState): Promise<ActionState> {
  const { error } = await (await createClient()).auth.signOut();
  if (error) return actionError(error);

  redirect("/auth/login");
}

export async function forgotPasswordAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await (
    await createClient()
  ).auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/auth/reset-password`,
  });
  if (error) return actionError(error);

  redirect("/auth/login?message=Check your email for a password reset link.");
}

export async function resetPasswordAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { error } = await (
    await createClient()
  ).auth.updateUser({ password: parsed.data.password });
  if (error) return actionError(error);

  redirect("/projects");
}
