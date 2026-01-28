import { auth } from "@/auth";
import {
  runAutoMatch,
  manualMatch,
  unmatch,
  getReconciliationStats,
} from "@/lib/reconciliation";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getReconciliationStats();
  return NextResponse.json(stats);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, batchId, depositId, tolerance } = body;

  switch (action) {
    case "auto": {
      // Run automatic matching
      const result = await runAutoMatch(tolerance);
      return NextResponse.json(result);
    }

    case "manual": {
      // Manual match
      if (!batchId || !depositId) {
        return NextResponse.json(
          { error: "Missing batchId or depositId for manual match" },
          { status: 400 }
        );
      }

      const result = await manualMatch(batchId, depositId);
      return NextResponse.json(result);
    }

    case "unmatch": {
      // Unmatch a batch
      if (!batchId) {
        return NextResponse.json(
          { error: "Missing batchId for unmatch" },
          { status: 400 }
        );
      }

      await unmatch(batchId);
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json(
        { error: "Invalid action. Use: auto, manual, or unmatch" },
        { status: 400 }
      );
  }
}
