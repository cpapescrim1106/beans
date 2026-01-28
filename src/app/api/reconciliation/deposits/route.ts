import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unmatched = searchParams.get("unmatched") === "true";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: {
    batchId?: null;
    depositDate?: { gte?: Date; lte?: Date };
  } = {};

  if (unmatched) {
    where.batchId = null;
  }

  if (startDate || endDate) {
    where.depositDate = {};
    if (startDate) where.depositDate.gte = new Date(startDate);
    if (endDate) where.depositDate.lte = new Date(endDate);
  }

  const deposits = await prisma.qboDeposit.findMany({
    where,
    include: {
      batch: true,
    },
    orderBy: { depositDate: "desc" },
  });

  return NextResponse.json({ deposits });
}
