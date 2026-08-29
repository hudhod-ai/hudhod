"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/server/schemas/common";

function errorRedirect(path: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function origin() {
  const requestHeaders = await headers();
  return requestHeaders.get("origin") ?? `http://${requestHeaders.get("host") ?? "localhost:3000"}`;
}

export async function signUpAction(formData: FormData) {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) errorRedirect("/auth/signup", new Error(parsed.error.issues[0]?.message));
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
  if (error) errorRedirect("/auth/signup", error);
  redirect("/auth/login?message=Check your email to confirm your account.");
}

export async function signInAction(formData: FormData) {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) errorRedirect("/auth/login", new Error(parsed.error.issues[0]?.message));
  const { error } = await (await createClient()).auth.signInWithPassword(parsed.data);
  if (error) errorRedirect("/auth/login", error);
  redirect("/projects");
}

export async function signOutAction() {
  await (await createClient()).auth.signOut();
  redirect("/auth/login");
}

export async function forgotPasswordAction(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    errorRedirect("/auth/forgot-password", new Error(parsed.error.issues[0]?.message));
  const { error } = await (
    await createClient()
  ).auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/auth/reset-password`,
  });
  if (error) errorRedirect("/auth/forgot-password", error);
  redirect("/auth/login?message=Check your email for a password reset link.");
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    errorRedirect("/auth/reset-password", new Error(parsed.error.issues[0]?.message));
  const { error } = await (
    await createClient()
  ).auth.updateUser({ password: parsed.data.password });
  if (error) errorRedirect("/auth/reset-password", error);
  redirect("/projects");
}
