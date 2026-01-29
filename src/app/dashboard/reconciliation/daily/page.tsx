"use client";

import DefaultLayout from "@/components/default-layout";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

interface Transaction {
  id: string;
  externalId: string | null;
  transactionDate: string;
  amount: number;
  description: string | null;
}

interface QboDeposit {
  id: string;
  externalId: string | null;
  depositDate: string;
  totalAmount: number;
  category: string | null;
  expectedCategory: string | null;
  categoryStatus: "UNCHECKED" | "CORRECT" | "NEEDS_REVIEW" | "FLAGGED";
  categoryNotes: string | null;
}

interface Batch {
  id: string;
  externalId: string | null;
  batchDate: string;
  totalAmount: number;
  reconciliationStatus: "PENDING" | "MATCHED" | "DISCREPANCY";
  discrepancyAmount: number | null;
  discrepancyNotes: string | null;
  discrepancyResolved: boolean;
  bpSum: number;
  bpDifference: number;
  qboDeposit: QboDeposit | null;
  blueprintTransactions: Transaction[];
}

interface Issue {
  type: string;
  message: string;
  batchId?: string;
}

interface DailyData {
  date: string;
  status: "matched" | "pending" | "issues";
  summary: {
    qboTotal: number;
    mscTotal: number;
    bpTotal: number;
    issueCount: number;
  };
  issues: Issue[];
  batches: Batch[];
  unmatchedDeposits: QboDeposit[];
  unlinkedTransactions: Transaction[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default function DailyReconciliationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);

  const dateParam = searchParams.get("date");
  const currentDate = dateParam || new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadData();
  }, [currentDate]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reconciliation/daily?date=${currentDate}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  function navigateDate(days: number) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + days);
    router.push(`/dashboard/reconciliation/daily?date=${date.toISOString().split("T")[0]}`);
  }

  if (loading) {
    return (
      <DefaultLayout title="Daily Reconciliation">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </DefaultLayout>
    );
  }

  if (!data) {
    return (
      <DefaultLayout title="Daily Reconciliation">
        <div className="text-center py-12 text-muted-foreground">
          Failed to load data
        </div>
      </DefaultLayout>
    );
  }

  const statusColors = {
    matched: "bg-green-100 border-green-500 text-green-800",
    pending: "bg-gray-100 border-gray-400 text-gray-700",
    issues: "bg-yellow-100 border-yellow-500 text-yellow-800",
  };

  const statusLabels = {
    matched: "ALL MATCHED",
    pending: "PENDING - Awaiting QBO Data",
    issues: `${data.issues.length} ISSUE${data.issues.length !== 1 ? "S" : ""} FOUND`,
  };

  const statusIcons = {
    matched: "✓",
    pending: "○",
    issues: "⚠",
  };

  return (
    <DefaultLayout title="Daily Reconciliation">
      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => navigateDate(-1)}>
          ◀ Previous
        </Button>
        <h2 className="text-xl font-semibold min-w-[280px] text-center">
          {formatDate(currentDate)}
        </h2>
        <Button variant="outline" size="sm" onClick={() => navigateDate(1)}>
          Next ▶
        </Button>
      </div>

      {/* Summary Banner */}
      <div
        className={`rounded-lg border-2 p-4 mb-6 ${statusColors[data.status]}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{statusIcons[data.status]}</span>
            <span className="font-semibold text-lg">{statusLabels[data.status]}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 text-center">
          <div>
            <div className="text-sm opacity-75">QBO Deposits</div>
            <div className="text-xl font-mono font-bold">
              {formatCurrency(data.summary.qboTotal)}
            </div>
          </div>
          <div>
            <div className="text-sm opacity-75">MSC Batches</div>
            <div className="text-xl font-mono font-bold">
              {formatCurrency(data.summary.mscTotal)}
            </div>
          </div>
          <div>
            <div className="text-sm opacity-75">BP Transactions</div>
            <div className="text-xl font-mono font-bold">
              {formatCurrency(data.summary.bpTotal)}
            </div>
          </div>
        </div>
        {data.issues.length > 0 && (
          <div className="mt-4 pt-4 border-t border-current/20">
            <ul className="text-sm space-y-1">
              {data.issues.slice(0, 5).map((issue, i) => (
                <li key={i}>• {issue.message}</li>
              ))}
              {data.issues.length > 5 && (
                <li className="opacity-75">...and {data.issues.length - 5} more</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-3 gap-4">
        {/* QBO Column */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">
            QBO Deposits
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (QuickBooks)
            </span>
          </h3>

          {data.batches.map((batch) =>
            batch.qboDeposit ? (
              <QboCard key={batch.qboDeposit.id} deposit={batch.qboDeposit} />
            ) : (
              <div
                key={`no-qbo-${batch.id}`}
                className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center text-muted-foreground"
              >
                <div className="text-sm">No QBO deposit</div>
                <div className="text-xs mt-1">for {batch.externalId}</div>
              </div>
            )
          )}

          {data.unmatchedDeposits.map((deposit) => (
            <QboCard key={deposit.id} deposit={deposit} unmatched />
          ))}

          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-mono font-bold">
                {formatCurrency(data.summary.qboTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* MSC Column */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">
            MSC Batches
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Merchant Services)
            </span>
          </h3>

          {data.batches.map((batch) => (
            <MscCard key={batch.id} batch={batch} />
          ))}

          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-mono font-bold">
                {formatCurrency(data.summary.mscTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* BP Column */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">
            BP Transactions
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Blueprint POS)
            </span>
          </h3>

          {data.batches.map((batch) => (
            <BpCard
              key={batch.id}
              batch={batch}
              transactions={batch.blueprintTransactions}
            />
          ))}

          {data.unlinkedTransactions.length > 0 && (
            <div className="rounded-lg border-2 border-dashed border-yellow-400 bg-yellow-50 p-3">
              <div className="text-sm font-medium text-yellow-800 mb-2">
                Unlinked Transactions
              </div>
              {data.unlinkedTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex justify-between text-sm py-1 border-t border-yellow-200"
                >
                  <span className="truncate flex-1">{tx.description || tx.externalId}</span>
                  <span className="font-mono ml-2">{formatCurrency(tx.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-mono font-bold">
                {formatCurrency(data.summary.bpTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}

function QboCard({
  deposit,
  unmatched = false,
}: {
  deposit: QboDeposit;
  unmatched?: boolean;
}) {
  const categoryStatusColors = {
    UNCHECKED: "bg-gray-100 text-gray-600",
    CORRECT: "bg-green-100 text-green-700",
    NEEDS_REVIEW: "bg-yellow-100 text-yellow-700",
    FLAGGED: "bg-red-100 text-red-700",
  };

  return (
    <div
      className={`rounded-lg border p-3 ${
        unmatched ? "border-yellow-400 bg-yellow-50" : "bg-white"
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-sm">{deposit.externalId || "—"}</span>
        <span className="font-mono font-bold">{formatCurrency(deposit.totalAmount)}</span>
      </div>

      {deposit.category && (
        <div className="mt-2 pt-2 border-t">
          <div className="text-xs text-muted-foreground mb-1">Category:</div>
          <div
            className={`text-sm px-2 py-1 rounded ${categoryStatusColors[deposit.categoryStatus]}`}
          >
            {deposit.category}
          </div>
          {deposit.expectedCategory &&
            deposit.category !== deposit.expectedCategory && (
              <div className="text-xs text-yellow-600 mt-1">
                Expected: {deposit.expectedCategory}
              </div>
            )}
        </div>
      )}

      {unmatched && (
        <div className="mt-2 pt-2 border-t">
          <span className="text-xs text-yellow-700">⚠ No matching batch</span>
        </div>
      )}
    </div>
  );
}

function MscCard({ batch }: { batch: Batch }) {
  const hasDiscrepancy = Math.abs(batch.bpDifference) > 0.01;
  const hasQbo = !!batch.qboDeposit;

  let borderColor = "border-gray-200";
  if (!hasQbo) borderColor = "border-gray-300 border-dashed";
  else if (hasDiscrepancy) borderColor = "border-yellow-400";
  else borderColor = "border-green-400";

  return (
    <div className={`rounded-lg border-2 p-3 bg-white ${borderColor}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-sm">{batch.externalId || "—"}</span>
        <span className="font-mono font-bold">{formatCurrency(batch.totalAmount)}</span>
      </div>

      {/* Match indicators */}
      <div className="space-y-1 mt-2 pt-2 border-t text-sm">
        {hasQbo ? (
          <div className="flex items-center gap-2 text-green-600">
            <span>✓</span>
            <span>QBO matched</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-400">
            <span>○</span>
            <span>Awaiting QBO</span>
          </div>
        )}

        {hasDiscrepancy ? (
          <div className="flex items-center gap-2 text-yellow-600">
            <span>⚠</span>
            <span>
              BP {batch.bpDifference > 0 ? "short" : "over"}{" "}
              {formatCurrency(Math.abs(batch.bpDifference))}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-600">
            <span>✓</span>
            <span>BP matches</span>
          </div>
        )}
      </div>

      {batch.discrepancyNotes && (
        <div className="mt-2 pt-2 border-t">
          <div className="text-xs text-muted-foreground">Notes:</div>
          <div className="text-sm">{batch.discrepancyNotes}</div>
        </div>
      )}
    </div>
  );
}

function BpCard({
  batch,
  transactions,
}: {
  batch: Batch;
  transactions: Transaction[];
}) {
  const hasDiscrepancy = Math.abs(batch.bpDifference) > 0.01;

  return (
    <div
      className={`rounded-lg border p-3 bg-white ${
        hasDiscrepancy ? "border-yellow-400" : "border-gray-200"
      }`}
    >
      <div className="text-xs text-muted-foreground mb-2">
        {batch.externalId} ({transactions.length} transactions)
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0"
          >
            <span className="truncate flex-1 pr-2">
              {tx.description || tx.externalId}
            </span>
            <span className="font-mono">{formatCurrency(tx.amount)}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t flex justify-between text-sm">
        <span className="text-muted-foreground">Sum:</span>
        <span className="font-mono font-bold">{formatCurrency(batch.bpSum)}</span>
      </div>

      {hasDiscrepancy && (
        <div className="mt-1 flex justify-between text-sm text-yellow-600">
          <span>Expected:</span>
          <span className="font-mono">{formatCurrency(batch.totalAmount)}</span>
        </div>
      )}

      {hasDiscrepancy && (
        <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
          <div className="text-xs text-yellow-700 font-medium">
            ⚠ Missing: {formatCurrency(Math.abs(batch.bpDifference))}
          </div>
        </div>
      )}
    </div>
  );
}
