import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";

async function verifyEmail(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");
  const identifier = await consumeToken(token);
  if (!identifier?.startsWith("verify:")) redirect(`/verify-email/${token}?error=1`);

  const email = identifier.slice("verify:".length);
  await prisma.user.update({ where: { email }, data: { emailVerified: new Date() } });

  redirect("/login?verified=1");
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16 text-center">
      <div>
        <h1 className="text-xl font-semibold">Verify your email</h1>
        {error ? (
          <p className="mt-1 text-sm text-red-600">
            This link is invalid or has expired. Request a new one from your account settings.
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-600">Click below to confirm your email address.</p>
        )}
      </div>

      {!error && (
        <form action={verifyEmail}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Verify email
          </button>
        </form>
      )}

      <Link href="/login" className="text-sm underline">
        Back to login
      </Link>
    </div>
  );
}
