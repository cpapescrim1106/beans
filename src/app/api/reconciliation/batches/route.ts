import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { ReconciliationStatus } from "@/generated/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as ReconciliationStatus | null;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: {
    reconciliationStatus?: ReconciliationStatus;
    batchDate?: { gte?: Date; lte?: Date };
  } = {};

  if (status) {
    where.reconciliationStatus = status;
  }

  if (startDate || endDate) {
    where.batchDate = {};
    if (startDate) where.batchDate.gte = new Date(startDate);
    if (endDate) where.batchDate.lte = new Date(endDate);
  }

  const [batches, total] = await Promise.all([
    prisma.mscBatch.findMany({
      where,
      include: {
        qboDeposit: true,
        _count: {
          select: { blueprintTransactions: true },
        },
      },
      orderBy: { batchDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.mscBatch.count({ where }),
  ]);

  return NextResponse.json({
    batches,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { externalId, batchDate, totalAmount } = body;

  if (!externalId || !batchDate || totalAmount === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: externalId, batchDate, totalAmount" },
      { status: 400 }
    );
  }

  const batch = await prisma.mscBatch.create({
    data: {
      externalId,
      batchDate: new Date(batchDate),
      totalAmount,
      reconciliationStatus: ReconciliationStatus.PENDING,
    },
  });

  return NextResponse.json({ batch }, { status: 201 });
}
