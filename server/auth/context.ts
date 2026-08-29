import "server-only";

import { env } from "@/server/env";

export interface AuthContext {
  userId: string;
}

export async function getAuthContext(): Promise<AuthContext> {
  return {
    userId: env.AUTH_DEMO_USER_ID,
  };
}
