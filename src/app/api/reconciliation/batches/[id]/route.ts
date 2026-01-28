import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { validateBatchTransactions } from "@/lib/reconciliation";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const batch = await prisma.mscBatch.findUnique({
    where: { id },
    include: {
      qboDeposit: true,
      blueprintTransactions: {
        orderBy: { transactionDate: "desc" },
      },
      syncLogs: {
        orderBy: { startedAt: "desc" },
        take: 10,
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  // Validate transactions sum
  const validation = await validateBatchTransactions(id);

  return NextResponse.json({
    batch,
    validation,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // First unlink any deposits
  await prisma.qboDeposit.updateMany({
    where: { batchId: id },
    data: { batchId: null },
  });

  // Delete related transactions and logs
  await prisma.blueprintTransaction.deleteMany({
    where: { batchId: id },
  });

  await prisma.syncLog.deleteMany({
    where: { batchId: id },
  });

  // Delete the batch
  await prisma.mscBatch.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
