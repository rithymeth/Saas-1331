import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";

async function resetPassword(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8 || password !== confirmPassword) {
    redirect(`/reset-password/${token}?error=mismatch`);
  }

  const identifier = await consumeToken(token);
  if (!identifier?.startsWith("pwreset:")) {
    redirect(`/reset-password/${token}?error=invalid`);
  }

  const email = identifier.slice("pwreset:".length);
  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { email }, data: { password: hashed } });

  redirect("/login?reset=1");
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
      </div>

      {error === "invalid" ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-red-600">
            This link is invalid or has expired. Request a new one.
          </p>
          <Link href="/forgot-password" className="text-sm underline">
            Back to reset password
          </Link>
        </div>
      ) : (
        <form action={resetPassword} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>

          {error === "mismatch" && (
            <p className="text-sm text-red-600">Passwords must match and be at least 8 characters.</p>
          )}

          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Reset password
          </button>
        </form>
      )}
    </div>
  );
}
