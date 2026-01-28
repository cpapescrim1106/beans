import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getDefaultQboClient } from "@/lib/qbo";
import { SyncProvider, SyncStatus } from "@/generated/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, startDate, endDate } = body;

  if (!provider || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Missing required fields: provider, startDate, endDate" },
      { status: 400 }
    );
  }

  // Create sync log entry
  const syncLog = await prisma.syncLog.create({
    data: {
      provider: provider as SyncProvider,
      operation: "SYNC",
      status: SyncStatus.PENDING,
      startedAt: new Date(),
      request: { startDate, endDate },
    },
  });

  try {
    let result: { synced: number; message: string };

    switch (provider) {
      case "QBO": {
        const client = await getDefaultQboClient();
        if (!client) {
          throw new Error("QuickBooks not connected");
        }

        const synced = await client.syncDeposits(
          new Date(startDate),
          new Date(endDate)
        );

        result = {
          synced,
          message: `Synced ${synced} deposits from QuickBooks`,
        };
        break;
      }

      case "MSC": {
        // MSC sync would be implemented based on their API
        // For now, return a placeholder
        result = {
          synced: 0,
          message: "MSC sync not yet implemented - use CSV import",
        };
        break;
      }

      case "BLUEPRINT": {
        // Blueprint sync would parse report data
        // For now, return a placeholder
        result = {
          synced: 0,
          message: "Blueprint sync not yet implemented - use report import",
        };
        break;
      }

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Update sync log with success
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: SyncStatus.SUCCESS,
        finishedAt: new Date(),
        response: result,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    // Update sync log with failure
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: SyncStatus.FAILURE,
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
