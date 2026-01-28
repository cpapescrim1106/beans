import prisma from "@/lib/prisma";
import { ReconciliationStatus } from "@/generated/prisma";

// Default tolerance for amount matching (in dollars)
const DEFAULT_TOLERANCE = 0.01;

interface MatchResult {
  matched: number;
  discrepancies: number;
  unmatched: number;
  details: Array<{
    batchId: string;
    depositId: string | null;
    status: ReconciliationStatus;
    amountDifference?: number;
  }>;
}

interface BatchWithDeposit {
  id: string;
  externalId: string;
  batchDate: Date;
  totalAmount: number;
  qboDeposit: {
    id: string;
    externalId: string;
    totalAmount: number;
  } | null;
}

/**
 * Find the best matching QBO deposit for an MSC batch
 */
async function findMatchingDeposit(
  batchDate: Date,
  batchAmount: number,
  tolerance: number = DEFAULT_TOLERANCE
): Promise<{ depositId: string; amountDiff: number } | null> {
  // Look for deposits on the same date or within 1 day
  const startDate = new Date(batchDate);
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date(batchDate);
  endDate.setDate(endDate.getDate() + 1);

  // Find unmatched deposits in the date range
  const deposits = await prisma.qboDeposit.findMany({
    where: {
      depositDate: {
        gte: startDate,
        lte: endDate,
      },
      batchId: null, // Not yet matched
    },
  });

  // Find the best match by amount
  let bestMatch: { depositId: string; amountDiff: number } | null = null;

  for (const deposit of deposits) {
    const amountDiff = Math.abs(
      Number(deposit.totalAmount) - Number(batchAmount)
    );

    // Check if within tolerance
    if (amountDiff <= tolerance) {
      if (!bestMatch || amountDiff < bestMatch.amountDiff) {
        bestMatch = {
          depositId: deposit.id,
          amountDiff,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Run automatic matching for all unmatched batches
 */
export async function runAutoMatch(
  tolerance: number = DEFAULT_TOLERANCE
): Promise<MatchResult> {
  const result: MatchResult = {
    matched: 0,
    discrepancies: 0,
    unmatched: 0,
    details: [],
  };

  // Get all pending batches
  const pendingBatches = await prisma.mscBatch.findMany({
    where: {
      reconciliationStatus: ReconciliationStatus.PENDING,
    },
  });

  for (const batch of pendingBatches) {
    const match = await findMatchingDeposit(
      batch.batchDate,
      Number(batch.totalAmount),
      tolerance
    );

    if (match) {
      // Found a match - link them
      await prisma.$transaction([
        prisma.mscBatch.update({
          where: { id: batch.id },
          data: {
            reconciliationStatus:
              match.amountDiff === 0
                ? ReconciliationStatus.MATCHED
                : ReconciliationStatus.DISCREPANCY,
            reconciledAt: new Date(),
          },
        }),
        prisma.qboDeposit.update({
          where: { id: match.depositId },
          data: { batchId: batch.id },
        }),
      ]);

      if (match.amountDiff === 0) {
        result.matched++;
      } else {
        result.discrepancies++;
      }

      result.details.push({
        batchId: batch.id,
        depositId: match.depositId,
        status:
          match.amountDiff === 0
            ? ReconciliationStatus.MATCHED
            : ReconciliationStatus.DISCREPANCY,
        amountDifference: match.amountDiff,
      });
    } else {
      result.unmatched++;
      result.details.push({
        batchId: batch.id,
        depositId: null,
        status: ReconciliationStatus.PENDING,
      });
    }
  }

  return result;
}

/**
 * Manually match a batch to a deposit
 */
export async function manualMatch(
  batchId: string,
  depositId: string
): Promise<{ success: boolean; amountDifference: number }> {
  const batch = await prisma.mscBatch.findUnique({
    where: { id: batchId },
  });

  const deposit = await prisma.qboDeposit.findUnique({
    where: { id: depositId },
  });

  if (!batch || !deposit) {
    throw new Error("Batch or deposit not found");
  }

  const amountDiff = Math.abs(
    Number(batch.totalAmount) - Number(deposit.totalAmount)
  );
  const status =
    amountDiff < DEFAULT_TOLERANCE
      ? ReconciliationStatus.MATCHED
      : ReconciliationStatus.DISCREPANCY;

  await prisma.$transaction([
    prisma.mscBatch.update({
      where: { id: batchId },
      data: {
        reconciliationStatus: status,
        reconciledAt: new Date(),
      },
    }),
    prisma.qboDeposit.update({
      where: { id: depositId },
      data: { batchId },
    }),
  ]);

  return {
    success: true,
    amountDifference: amountDiff,
  };
}

/**
 * Unmatch a batch from its deposit
 */
export async function unmatch(batchId: string): Promise<void> {
  await prisma.$transaction([
    prisma.mscBatch.update({
      where: { id: batchId },
      data: {
        reconciliationStatus: ReconciliationStatus.PENDING,
        reconciledAt: null,
      },
    }),
    prisma.qboDeposit.updateMany({
      where: { batchId },
      data: { batchId: null },
    }),
  ]);
}

/**
 * Get reconciliation summary stats
 */
export async function getReconciliationStats(): Promise<{
  total: number;
  matched: number;
  discrepancies: number;
  pending: number;
  totalAmount: number;
  matchedAmount: number;
}> {
  const [total, matched, discrepancies, pending] = await Promise.all([
    prisma.mscBatch.count(),
    prisma.mscBatch.count({
      where: { reconciliationStatus: ReconciliationStatus.MATCHED },
    }),
    prisma.mscBatch.count({
      where: { reconciliationStatus: ReconciliationStatus.DISCREPANCY },
    }),
    prisma.mscBatch.count({
      where: { reconciliationStatus: ReconciliationStatus.PENDING },
    }),
  ]);

  const totalAmountResult = await prisma.mscBatch.aggregate({
    _sum: { totalAmount: true },
  });

  const matchedAmountResult = await prisma.mscBatch.aggregate({
    where: { reconciliationStatus: ReconciliationStatus.MATCHED },
    _sum: { totalAmount: true },
  });

  return {
    total,
    matched,
    discrepancies,
    pending,
    totalAmount: Number(totalAmountResult._sum.totalAmount || 0),
    matchedAmount: Number(matchedAmountResult._sum.totalAmount || 0),
  };
}

/**
 * Validate that Blueprint transactions sum to batch total
 */
export async function validateBatchTransactions(
  batchId: string
): Promise<{
  valid: boolean;
  batchTotal: number;
  transactionSum: number;
  difference: number;
}> {
  const batch = await prisma.mscBatch.findUnique({
    where: { id: batchId },
    include: {
      blueprintTransactions: true,
    },
  });

  if (!batch) {
    throw new Error("Batch not found");
  }

  const batchTotal = Number(batch.totalAmount);
  const transactionSum = batch.blueprintTransactions.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0
  );
  const difference = Math.abs(batchTotal - transactionSum);

  return {
    valid: difference < DEFAULT_TOLERANCE,
    batchTotal,
    transactionSum,
    difference,
  };
}
