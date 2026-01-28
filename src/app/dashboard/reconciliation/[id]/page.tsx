"use client";

import DefaultLayout from "@/components/default-layout";
import { Button } from "@/components/ui/button";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

interface Transaction {
  id: string;
  externalId: string;
  transactionDate: string;
  amount: string;
  description: string | null;
}

interface Deposit {
  id: string;
  externalId: string;
  depositDate: string;
  totalAmount: string;
}

interface Batch {
  id: string;
  externalId: string;
  batchDate: string;
  totalAmount: string;
  reconciliationStatus: "PENDING" | "MATCHED" | "DISCREPANCY";
  reconciledAt: string | null;
  qboDeposit: Deposit | null;
  blueprintTransactions: Transaction[];
  syncLogs: Array<{
    id: string;
    provider: string;
    operation: string;
    status: string;
    startedAt: string;
    errorMessage: string | null;
  }>;
}

interface Validation {
  valid: boolean;
  batchTotal: number;
  transactionSum: number;
  difference: number;
}

interface UnmatchedDeposit {
  id: string;
  externalId: string;
  depositDate: string;
  totalAmount: string;
}

const statusColors = {
  PENDING: "bg-yellow-100 text-yellow-800",
  MATCHED: "bg-green-100 text-green-800",
  DISCREPANCY: "bg-red-100 text-red-800",
};

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [unmatchedDeposits, setUnmatchedDeposits] = useState<UnmatchedDeposit[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [showMatchModal, setShowMatchModal] = useState(false);

  useEffect(() => {
    loadBatch();
    loadUnmatchedDeposits();
  }, [id]);

  async function loadBatch() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reconciliation/batches/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBatch(data.batch);
        setValidation(data.validation);
      }
    } catch (error) {
      console.error("Failed to load batch:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUnmatchedDeposits() {
    try {
      const res = await fetch("/api/reconciliation/deposits?unmatched=true");
      if (res.ok) {
        const data = await res.json();
        setUnmatchedDeposits(data.deposits);
      }
    } catch (error) {
      console.error("Failed to load deposits:", error);
    }
  }

  async function handleUnmatch() {
    if (!confirm("Unmatch this batch from its deposit?")) return;

    try {
      const res = await fetch("/api/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unmatch", batchId: id }),
      });

      if (res.ok) {
        loadBatch();
        loadUnmatchedDeposits();
      }
    } catch (error) {
      alert("Failed to unmatch");
    }
  }

  async function handleManualMatch(depositId: string) {
    try {
      const res = await fetch("/api/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual", batchId: id, depositId }),
      });

      if (res.ok) {
        setShowMatchModal(false);
        loadBatch();
      } else {
        const data = await res.json();
        alert(`Match failed: ${data.error}`);
      }
    } catch (error) {
      alert("Failed to match");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this batch and all associated data?")) return;

    try {
      const res = await fetch(`/api/reconciliation/batches/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/dashboard/reconciliation");
      }
    } catch (error) {
      alert("Failed to delete");
    }
  }

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <DefaultLayout title="Loading...">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </DefaultLayout>
    );
  }

  if (!batch) {
    return (
      <DefaultLayout title="Not Found">
        <div className="text-center py-8 text-muted-foreground">
          Batch not found
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout
      title={`Batch ${batch.externalId}`}
      description={`${formatDate(batch.batchDate)} • ${formatCurrency(batch.totalAmount)}`}
    >
      {/* Status and Actions */}
      <div className="flex items-center gap-4 mb-8">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[batch.reconciliationStatus]}`}
        >
          {batch.reconciliationStatus}
        </span>
        {batch.reconciledAt && (
          <span className="text-sm text-muted-foreground">
            Reconciled: {formatDateTime(batch.reconciledAt)}
          </span>
        )}
        <div className="flex-1" />
        {batch.qboDeposit ? (
          <Button variant="outline" onClick={handleUnmatch}>
            Unmatch
          </Button>
        ) : (
          <Button onClick={() => setShowMatchModal(true)}>Manual Match</Button>
        )}
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* MSC Batch Info */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-3">MSC Batch</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">External ID</dt>
              <dd className="font-mono">{batch.externalId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Date</dt>
              <dd>{formatDate(batch.batchDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-mono font-semibold">
                {formatCurrency(batch.totalAmount)}
              </dd>
            </div>
          </dl>
        </div>

        {/* QBO Deposit Info */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-3">QBO Deposit</h3>
          {batch.qboDeposit ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">External ID</dt>
                <dd className="font-mono">{batch.qboDeposit.externalId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{formatDate(batch.qboDeposit.depositDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-mono font-semibold">
                  {formatCurrency(batch.qboDeposit.totalAmount)}
                </dd>
              </div>
              {Number(batch.totalAmount) !==
                Number(batch.qboDeposit.totalAmount) && (
                <div className="flex justify-between text-red-600">
                  <dt>Difference</dt>
                  <dd className="font-mono">
                    {formatCurrency(
                      Math.abs(
                        Number(batch.totalAmount) -
                          Number(batch.qboDeposit.totalAmount)
                      )
                    )}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">
              No deposit matched yet
            </p>
          )}
        </div>
      </div>

      {/* Validation */}
      {validation && (
        <div
          className={`rounded-lg border p-4 mb-8 ${validation.valid ? "bg-green-50" : "bg-red-50"}`}
        >
          <h3 className="font-semibold mb-2">
            Transaction Validation{" "}
            {validation.valid ? "✓" : "✗"}
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Batch Total</div>
              <div className="font-mono">
                {formatCurrency(validation.batchTotal)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Transaction Sum</div>
              <div className="font-mono">
                {formatCurrency(validation.transactionSum)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Difference</div>
              <div
                className={`font-mono ${validation.difference > 0 ? "text-red-600" : ""}`}
              >
                {formatCurrency(validation.difference)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="rounded-lg border mb-8">
        <div className="p-4 border-b bg-muted">
          <h3 className="font-semibold">
            Blueprint Transactions ({batch.blueprintTransactions.length})
          </h3>
        </div>
        {batch.blueprintTransactions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No transactions linked to this batch
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {batch.blueprintTransactions.map((tx) => (
                <tr key={tx.id} className="border-t">
                  <td className="p-3 font-mono text-sm">{tx.externalId}</td>
                  <td className="p-3">{formatDate(tx.transactionDate)}</td>
                  <td className="p-3 text-right font-mono">
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {tx.description || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sync Logs */}
      {batch.syncLogs.length > 0 && (
        <div className="rounded-lg border">
          <div className="p-4 border-b bg-muted">
            <h3 className="font-semibold">Recent Sync Logs</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Provider</th>
                <th className="text-left p-3">Operation</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Time</th>
                <th className="text-left p-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {batch.syncLogs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-3">{log.provider}</td>
                  <td className="p-3">{log.operation}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        log.status === "SUCCESS"
                          ? "bg-green-100 text-green-800"
                          : log.status === "FAILURE"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="p-3 text-sm">{formatDateTime(log.startedAt)}</td>
                  <td className="p-3 text-sm text-red-600">
                    {log.errorMessage || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Match Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-4">
              Select QBO Deposit to Match
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Batch amount: {formatCurrency(batch.totalAmount)} on{" "}
              {formatDate(batch.batchDate)}
            </p>
            {unmatchedDeposits.length === 0 ? (
              <p className="text-muted-foreground">
                No unmatched deposits available. Sync from QBO first.
              </p>
            ) : (
              <div className="space-y-2">
                {unmatchedDeposits.map((deposit) => {
                  const diff = Math.abs(
                    Number(batch.totalAmount) - Number(deposit.totalAmount)
                  );
                  return (
                    <button
                      key={deposit.id}
                      onClick={() => handleManualMatch(deposit.id)}
                      className={`w-full text-left p-3 rounded border hover:bg-muted ${
                        diff < 0.01 ? "border-green-500" : ""
                      }`}
                    >
                      <div className="flex justify-between">
                        <span className="font-mono">{deposit.externalId}</span>
                        <span className="font-mono">
                          {formatCurrency(deposit.totalAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{formatDate(deposit.depositDate)}</span>
                        {diff > 0 && (
                          <span className="text-red-600">
                            Diff: {formatCurrency(diff)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowMatchModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <Button variant="outline" asChild>
          <Link href="/dashboard/reconciliation">← Back to Reconciliation</Link>
        </Button>
      </div>
    </DefaultLayout>
  );
}
