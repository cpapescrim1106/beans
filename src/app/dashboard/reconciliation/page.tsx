"use client";

import DefaultLayout from "@/components/default-layout";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Batch {
  id: string;
  externalId: string;
  batchDate: string;
  totalAmount: string;
  reconciliationStatus: "PENDING" | "MATCHED" | "DISCREPANCY";
  reconciledAt: string | null;
  qboDeposit: {
    id: string;
    externalId: string;
    totalAmount: string;
  } | null;
  _count: {
    blueprintTransactions: number;
  };
}

interface Stats {
  total: number;
  matched: number;
  discrepancies: number;
  pending: number;
  totalAmount: number;
  matchedAmount: number;
}

const statusColors = {
  PENDING: "bg-yellow-100 text-yellow-800",
  MATCHED: "bg-green-100 text-green-800",
  DISCREPANCY: "bg-red-100 text-red-800",
};

export default function ReconciliationPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    setLoading(true);
    try {
      const statusParam = filter !== "all" ? `?status=${filter}` : "";
      const [batchRes, statsRes] = await Promise.all([
        fetch(`/api/reconciliation/batches${statusParam}`),
        fetch("/api/reconciliation/match"),
      ]);

      if (batchRes.ok) {
        const data = await batchRes.json();
        setBatches(data.batches);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function syncQbo() {
    setSyncing(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const res = await fetch("/api/reconciliation/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "QBO",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        loadData();
      } else {
        alert(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      alert("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function runAutoMatch() {
    setMatching(true);
    try {
      const res = await fetch("/api/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto" }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(
          `Matching complete: ${data.matched} matched, ${data.discrepancies} discrepancies, ${data.unmatched} unmatched`
        );
        loadData();
      } else {
        alert(`Matching failed: ${data.error}`);
      }
    } catch (error) {
      alert("Matching failed");
    } finally {
      setMatching(false);
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

  return (
    <DefaultLayout
      title="Reconciliation"
      description="Match MSC batches with QuickBooks deposits"
    >
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Batches</div>
          </div>
          <div className="rounded-lg border bg-green-50 p-4">
            <div className="text-2xl font-bold text-green-700">
              {stats.matched}
            </div>
            <div className="text-sm text-green-600">Matched</div>
          </div>
          <div className="rounded-lg border bg-red-50 p-4">
            <div className="text-2xl font-bold text-red-700">
              {stats.discrepancies}
            </div>
            <div className="text-sm text-red-600">Discrepancies</div>
          </div>
          <div className="rounded-lg border bg-yellow-50 p-4">
            <div className="text-2xl font-bold text-yellow-700">
              {stats.pending}
            </div>
            <div className="text-sm text-yellow-600">Pending</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Button onClick={syncQbo} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync QBO Deposits"}
        </Button>
        <Button onClick={runAutoMatch} disabled={matching} variant="secondary">
          {matching ? "Matching..." : "Run Auto-Match"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/reconciliation/import">Import MSC Batches</Link>
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {["all", "PENDING", "MATCHED", "DISCREPANCY"].map((status) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status === "all" ? "All" : status}
          </Button>
        ))}
      </div>

      {/* Batch List */}
      <div className="rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Batch ID</th>
              <th className="text-left p-3">Date</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">QBO Deposit</th>
              <th className="text-right p-3">Transactions</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-muted-foreground">
                  No batches found. Import MSC batches or sync from QBO.
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 font-mono text-sm">{batch.externalId}</td>
                  <td className="p-3">{formatDate(batch.batchDate)}</td>
                  <td className="p-3 text-right font-mono">
                    {formatCurrency(batch.totalAmount)}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[batch.reconciliationStatus]}`}
                    >
                      {batch.reconciliationStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    {batch.qboDeposit ? (
                      <span className="text-sm">
                        {batch.qboDeposit.externalId} (
                        {formatCurrency(batch.qboDeposit.totalAmount)})
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Not matched
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {batch._count.blueprintTransactions}
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/reconciliation/${batch.id}`}>
                        View
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DefaultLayout>
  );
}
