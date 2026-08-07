import { prisma } from "@/lib/prisma";
import LinksClient from "./LinksClient";

export const dynamic = "force-dynamic";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: { company?: string };
}) {
  const companyId = searchParams.company || undefined;
  const [links, companies] = await Promise.all([
    prisma.link.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { createdAt: "desc" },
      include: { company: true, lineGroup: true },
    }),
    prisma.company.findMany({
      orderBy: { createdAt: "asc" },
      include: { lineGroups: { orderBy: { createdAt: "asc" } } },
    }),
  ]);
  return (
    <LinksClient
      initialLinks={JSON.parse(JSON.stringify(links))}
      companies={JSON.parse(JSON.stringify(companies))}
      currentCompany={companyId}
    />
  );
}
