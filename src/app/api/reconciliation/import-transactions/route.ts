import { auth } from "@/auth";
import { importBlueprintTransactions } from "@/lib/blueprint/parser";
import prisma from "@/lib/prisma";
import { SyncProvider, SyncStatus } from "@/generated/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const csvText = formData.get("csv") as string | null;

  let data: string;
  if (file) {
    data = await file.text();
  } else if (csvText) {
    data = csvText;
  } else {
    return NextResponse.json(
      { error: "No file or CSV data provided" },
      { status: 400 }
    );
  }

  // Create sync log
  const syncLog = await prisma.syncLog.create({
    data: {
      provider: SyncProvider.BLUEPRINT,
      operation: "IMPORT_TRANSACTIONS",
      status: SyncStatus.PENDING,
      startedAt: new Date(),
    },
  });

  try {
    const result = await importBlueprintTransactions(data);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: SyncStatus.SUCCESS,
        finishedAt: new Date(),
        response: result,
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: SyncStatus.FAILURE,
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Import failed",
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
