import { resetPasswordAction } from "@/app/auth/actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <form
        action={resetPasswordAction}
        className="w-full space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">mcpup</p>
          <h1 className="mt-2 text-3xl font-semibold">Choose a new password</h1>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block space-y-2 text-sm font-medium">
          New password
          <input
            required
            name="password"
            type="password"
            minLength={8}
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Confirm password
          <input
            required
            name="confirmPassword"
            type="password"
            minLength={8}
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
          />
        </label>
        <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          Update password
        </button>
      </form>
    </main>
  );
}
