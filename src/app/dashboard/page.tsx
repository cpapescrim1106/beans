import { auth } from "@/auth";
import DefaultLayout from "@/components/default-layout";
import { Button } from "@/components/ui/button";
import type { Session } from "next-auth";
import Link from "next/link";
import BlueprintReportTrigger from "./blueprint-report-trigger";
import { isQboConnected } from "@/lib/qbo";
import { getReconciliationStats } from "@/lib/reconciliation";

export const dynamic = "force-dynamic";

const DashboardPage = async () => {
  const session = (await auth()) as Session;
  const qboConnected = await isQboConnected();
  const stats = await getReconciliationStats();

  return (
    <DefaultLayout title="Dashboard">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Batches</div>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <div className="text-2xl font-bold text-green-700">{stats.matched}</div>
          <div className="text-sm text-green-600">Matched</div>
        </div>
        <div className="rounded-lg border bg-red-50 p-4">
          <div className="text-2xl font-bold text-red-700">{stats.discrepancies}</div>
          <div className="text-sm text-red-600">Discrepancies</div>
        </div>
        <div className="rounded-lg border bg-yellow-50 p-4">
          <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          <div className="text-sm text-yellow-600">Pending</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border bg-card p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Button asChild>
            <Link href="/dashboard/reconciliation/daily">Daily Reconciliation</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/reconciliation">Batch List</Link>
          </Button>
          {qboConnected ? (
            <Button variant="outline" disabled>
              ✓ QuickBooks Connected
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/api/auth/quickbooks">Connect QuickBooks</Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/dashboard/reconciliation/import">Import Batches</Link>
          </Button>
        </div>
      </div>

      {/* Blueprint Report Trigger */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Blueprint Reports</h2>
        <BlueprintReportTrigger />
      </div>
    </DefaultLayout>
  );
};
export default DashboardPage;
