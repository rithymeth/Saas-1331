import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function acceptInvite(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/invite/${token}`);

  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.expiresAt < new Date()) redirect(`/invite/${token}`);
  if (invitation.email !== session.user.email) redirect(`/invite/${token}?mismatch=1`);

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: invitation.organizationId,
      },
    },
    create: {
      userId: session.user.id,
      organizationId: invitation.organizationId,
      role: invitation.role,
    },
    update: { role: invitation.role },
  });

  await prisma.invitation.delete({ where: { id: invitation.id } });

  redirect("/dashboard");
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mismatch?: string }>;
}) {
  const { token } = await params;
  const { mismatch } = await searchParams;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invitation || invitation.expiresAt < new Date()) {
    return (
      <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-xl font-semibold">Invite not found</h1>
        <p className="text-sm text-gray-600">This invite link is invalid or has expired.</p>
        <Link href="/" className="text-sm underline">
          Back home
        </Link>
      </div>
    );
  }

  const session = await auth();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16 text-center">
      <div>
        <h1 className="text-xl font-semibold">Join {invitation.organization.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          You&apos;ve been invited as <strong>{invitation.role.toLowerCase()}</strong> —{" "}
          {invitation.email}
        </p>
      </div>

      {mismatch && (
        <p className="text-sm text-red-600">
          You&apos;re signed in with a different email than this invite was sent to. Sign out and
          try again.
        </p>
      )}

      {session?.user ? (
        <form action={acceptInvite}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Accept invite
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          <Link
            href={`/signup?email=${encodeURIComponent(invitation.email)}&callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Create account to accept
          </Link>
          <Link
            href={`/login?email=${encodeURIComponent(invitation.email)}&callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Log in to accept
          </Link>
        </div>
      )}
    </div>
  );
}
