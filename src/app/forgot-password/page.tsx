import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { resolveAppUrl } from "@/lib/url";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

async function requestReset(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const rawToken = await createToken(`pwreset:${email}`, RESET_TOKEN_TTL_MS);
      await sendPasswordResetEmail({
        to: email,
        resetUrl: `${await resolveAppUrl()}/reset-password/${rawToken}`,
      });
    }
  }

  // Always redirect the same way, whether or not the account exists.
  redirect("/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-gray-600">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-gray-900 underline">
            Log in
          </Link>
        </p>
      </div>

      {sent ? (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-center text-sm text-gray-600">
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </p>
      ) : (
        <form action={requestReset} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Send reset link
          </button>
        </form>
      )}
    </div>
  );
}
