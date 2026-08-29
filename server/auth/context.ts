import "server-only";

import { createClient } from "@/lib/server";
import { UnauthorizedError } from "@/server/http/errors";

export interface AuthContext {
  userId: string;
}

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError();
  }

  return {
    userId: user.id,
  };
}
