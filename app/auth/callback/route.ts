import { NextResponse } from "next/server";

import { createClient } from "@/lib/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/projects";

  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(
    new URL("/auth/login?error=Unable+to+complete+authentication.", url.origin),
  );
}
