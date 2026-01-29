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
  const dateParam = searchParams.get("date");

  // Default to today if no date provided
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch MSC batches for the day with related data
  const batches = await prisma.mscBatch.findMany({
    where: {
      batchDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      qboDeposit: true,
      blueprintTransactions: {
        orderBy: { transactionDate: "asc" },
      },
    },
    orderBy: { batchDate: "asc" },
  });

  // Fetch any unmatched QBO deposits for the day
  const unmatchedDeposits = await prisma.qboDeposit.findMany({
    where: {
      depositDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      batchId: null,
    },
    orderBy: { depositDate: "asc" },
  });

  // Fetch any unlinked Blueprint transactions for the day
  const unlinkedTransactions = await prisma.blueprintTransaction.findMany({
    where: {
      transactionDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      batchId: null,
    },
    orderBy: { transactionDate: "asc" },
  });

  // Calculate totals and summary
  const qboTotal = batches.reduce(
    (sum, b) => sum + Number(b.qboDeposit?.totalAmount || 0),
    0
  ) + unmatchedDeposits.reduce((sum, d) => sum + Number(d.totalAmount), 0);

  const mscTotal = batches.reduce((sum, b) => sum + Number(b.totalAmount), 0);

  const bpTotal = batches.reduce(
    (sum, b) =>
      sum + b.blueprintTransactions.reduce((s, t) => s + Number(t.amount), 0),
    0
  ) + unlinkedTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  // Calculate issues
  const issues: Array<{ type: string; message: string; batchId?: string }> = [];

  for (const batch of batches) {
    const bpSum = batch.blueprintTransactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );
    const batchTotal = Number(batch.totalAmount);
    const difference = batchTotal - bpSum;

    if (Math.abs(difference) > 0.01) {
      issues.push({
        type: "amount_mismatch",
        message: `BP transactions ${difference > 0 ? "short" : "over"} by $${Math.abs(difference).toFixed(2)}`,
        batchId: batch.id,
      });
    }

    if (batch.qboDeposit?.categoryStatus === "NEEDS_REVIEW" ||
        batch.qboDeposit?.categoryStatus === "FLAGGED") {
      issues.push({
        type: "category_review",
        message: `QBO category needs review: ${batch.qboDeposit.category}`,
        batchId: batch.id,
      });
    }

    if (!batch.qboDeposit) {
      issues.push({
        type: "no_qbo_match",
        message: "No QBO deposit matched",
        batchId: batch.id,
      });
    }
  }

  // Unmatched deposits
  for (const deposit of unmatchedDeposits) {
    issues.push({
      type: "unmatched_deposit",
      message: `QBO deposit $${Number(deposit.totalAmount).toFixed(2)} has no matching batch`,
    });
  }

  // Unlinked transactions
  if (unlinkedTransactions.length > 0) {
    issues.push({
      type: "unlinked_transactions",
      message: `${unlinkedTransactions.length} BP transactions not linked to any batch`,
    });
  }

  // Determine overall status
  let status: "matched" | "pending" | "issues" = "matched";
  if (issues.some(i => i.type !== "no_qbo_match")) {
    status = "issues";
  } else if (issues.some(i => i.type === "no_qbo_match")) {
    status = "pending";
  }

  return NextResponse.json({
    date: targetDate.toISOString().split("T")[0],
    status,
    summary: {
      qboTotal,
      mscTotal,
      bpTotal,
      issueCount: issues.length,
    },
    issues,
    batches: batches.map((batch) => {
      const bpSum = batch.blueprintTransactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );
      return {
        id: batch.id,
        externalId: batch.externalId,
        batchDate: batch.batchDate,
        totalAmount: Number(batch.totalAmount),
        reconciliationStatus: batch.reconciliationStatus,
        discrepancyAmount: batch.discrepancyAmount ? Number(batch.discrepancyAmount) : null,
        discrepancyNotes: batch.discrepancyNotes,
        discrepancyResolved: batch.discrepancyResolved,
        bpSum,
        bpDifference: Number(batch.totalAmount) - bpSum,
        qboDeposit: batch.qboDeposit
          ? {
              id: batch.qboDeposit.id,
              externalId: batch.qboDeposit.externalId,
              depositDate: batch.qboDeposit.depositDate,
              totalAmount: Number(batch.qboDeposit.totalAmount),
              category: batch.qboDeposit.category,
              expectedCategory: batch.qboDeposit.expectedCategory,
              categoryStatus: batch.qboDeposit.categoryStatus,
              categoryNotes: batch.qboDeposit.categoryNotes,
            }
          : null,
        blueprintTransactions: batch.blueprintTransactions.map((t) => ({
          id: t.id,
          externalId: t.externalId,
          transactionDate: t.transactionDate,
          amount: Number(t.amount),
          description: t.description,
        })),
      };
    }),
    unmatchedDeposits: unmatchedDeposits.map((d) => ({
      id: d.id,
      externalId: d.externalId,
      depositDate: d.depositDate,
      totalAmount: Number(d.totalAmount),
      category: d.category,
      categoryStatus: d.categoryStatus,
    })),
    unlinkedTransactions: unlinkedTransactions.map((t) => ({
      id: t.id,
      externalId: t.externalId,
      transactionDate: t.transactionDate,
      amount: Number(t.amount),
      description: t.description,
    })),
  });
}
