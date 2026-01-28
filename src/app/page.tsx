import DefaultLayout from "@/components/default-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <DefaultLayout
      title="🫘 Beans"
      description="AccuHear Bookkeeping Reconciliation"
    >
      <div className="space-y-8">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/api/auth/quickbooks">Connect QuickBooks</Link>
            </Button>
            <Button variant="outline" disabled>
              Run Reconciliation (coming soon)
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li><strong>MSC Batch</strong> — Source of truth (credit card totals)</li>
            <li><strong>QuickBooks</strong> — Verify deposits match batches</li>
            <li><strong>Blueprint</strong> — Individual transactions sum to batch</li>
            <li><strong>Reconcile</strong> — Flag discrepancies or label QBO entries</li>
          </ol>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <ul className="space-y-2 text-sm">
            <li>✅ App running</li>
            <li>✅ Database connected</li>
            <li>🔲 QuickBooks — Not connected</li>
            <li>🔲 MSC — Not configured</li>
            <li>🔲 Blueprint — Not configured</li>
          </ul>
        </div>
      </div>
    </DefaultLayout>
  );
}
