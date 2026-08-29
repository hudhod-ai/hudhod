import Link from "next/link";

import { signInAction } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <form
        action={signInAction}
        className="w-full space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">mcpup</p>
          <h1 className="mt-2 text-3xl font-semibold">Sign in</h1>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <label className="block space-y-2 text-sm font-medium">
          Email
          <input
            required
            name="email"
            type="email"
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Password
          <input
            required
            name="password"
            type="password"
            minLength={8}
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
          />
        </label>
        <div className="flex items-center justify-between text-sm">
          <Link className="text-zinc-600 underline" href="/auth/forgot-password">
            Forgot password?
          </Link>
          <Link className="text-zinc-600 underline" href="/auth/signup">
            Create account
          </Link>
        </div>
        <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          Sign in
        </button>
      </form>
    </main>
  );
}
