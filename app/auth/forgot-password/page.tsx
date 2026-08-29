import Link from "next/link";

import { forgotPasswordAction } from "@/app/auth/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <form
        action={forgotPasswordAction}
        className="w-full space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            mcpup
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Reset password</h1>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block space-y-2 text-sm font-medium">
          Email
          <input
            required
            name="email"
            type="email"
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
          />
        </label>
        <div className="flex items-center justify-between">
          <Link className="text-sm text-zinc-600 underline" href="/auth/login">
            Back to sign in
          </Link>
          <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            Send reset link
          </button>
        </div>
      </form>
    </main>
  );
}
