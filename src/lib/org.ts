import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const ACTIVE_ORG_COOKIE = "activeOrgId";

export async function listMemberships(userId: string) {
  return prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * The membership the current request should act within: the org named by the
 * activeOrgId cookie if the user still belongs to it, else their oldest membership.
 */
export async function getActiveMembership(userId: string) {
  const memberships = await listMemberships(userId);
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const active = activeOrgId && memberships.find((m) => m.organizationId === activeOrgId);
  return active || memberships[0];
}
