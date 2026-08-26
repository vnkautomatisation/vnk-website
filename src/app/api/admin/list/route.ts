import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorizedJson();
  const admins = await prisma.admin.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, email: true },
  });
  return NextResponse.json({ admins });
}
