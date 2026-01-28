import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { ReconciliationStatus, SyncProvider, SyncStatus } from "@/generated/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface BatchRow {
  externalId: string;
  batchDate: string;
  totalAmount: string | number;
  description?: string;
}

function parseCSV(csvText: string): BatchRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV must have header row and at least one data row");
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  // Find column indices
  const idIndex =
    headers.findIndex((h) => h.includes("id") || h.includes("batch")) ?? 0;
  const dateIndex =
    headers.findIndex((h) => h.includes("date")) ?? 1;
  const amountIndex =
    headers.findIndex((h) => h.includes("amount") || h.includes("total")) ?? 2;
  const descIndex = headers.findIndex((h) => h.includes("desc"));

  const rows: BatchRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values with commas
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const externalId = values[idIndex];
    const batchDate = values[dateIndex];
    const totalAmount = values[amountIndex]?.replace(/[$,]/g, "");

    if (!externalId || !batchDate || !totalAmount) {
      continue; // Skip invalid rows
    }

    rows.push({
      externalId,
      batchDate,
      totalAmount,
      description: descIndex >= 0 ? values[descIndex] : undefined,
    });
  }

  return rows;
}

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
      provider: SyncProvider.MSC,
      operation: "IMPORT",
      status: SyncStatus.PENDING,
      startedAt: new Date(),
    },
  });

  try {
    const rows = parseCSV(data);

    if (rows.length === 0) {
      throw new Error("No valid data rows found in CSV");
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        // Parse date - try multiple formats
        let batchDate: Date;
        const dateStr = row.batchDate;

        if (dateStr.includes("/")) {
          // MM/DD/YYYY or M/D/YYYY
          const [month, day, year] = dateStr.split("/");
          batchDate = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day)
          );
        } else if (dateStr.includes("-")) {
          // YYYY-MM-DD
          batchDate = new Date(dateStr);
        } else {
          throw new Error(`Invalid date format: ${dateStr}`);
        }

        if (isNaN(batchDate.getTime())) {
          throw new Error(`Invalid date: ${dateStr}`);
        }

        const totalAmount = parseFloat(String(row.totalAmount));
        if (isNaN(totalAmount)) {
          throw new Error(`Invalid amount: ${row.totalAmount}`);
        }

        // Upsert the batch
        await prisma.mscBatch.upsert({
          where: { externalId: row.externalId },
          create: {
            externalId: row.externalId,
            batchDate,
            totalAmount,
            reconciliationStatus: ReconciliationStatus.PENDING,
          },
          update: {
            batchDate,
            totalAmount,
            // Don't update status if already reconciled
          },
        });

        imported++;
      } catch (error) {
        skipped++;
        errors.push(
          `Row ${row.externalId}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: SyncStatus.SUCCESS,
        finishedAt: new Date(),
        response: { imported, skipped, totalRows: rows.length },
      },
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      totalRows: rows.length,
      errors: errors.slice(0, 10), // Return first 10 errors
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
