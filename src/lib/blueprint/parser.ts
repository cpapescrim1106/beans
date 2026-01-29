import prisma from "@/lib/prisma";

interface BlueprintTransaction {
  externalId: string;
  transactionDate: Date;
  amount: number;
  description: string;
  paymentMethod?: string;
  clinic?: string;
}

interface ParseResult {
  transactions: BlueprintTransaction[];
  totalAmount: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

/**
 * Parse Blueprint cashflow report CSV
 * Expected columns vary but typically include:
 * - Transaction ID / Reference
 * - Date
 * - Amount
 * - Payment Method
 * - Description / Notes
 * - Clinic / Location
 */
export function parseBlueprintCSV(csvText: string): ParseResult {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV must have header row and at least one data row");
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  // Find column indices (flexible matching)
  const idIndex = headers.findIndex(
    (h) =>
      h.includes("id") ||
      h.includes("reference") ||
      h.includes("transaction") ||
      h.includes("ref")
  );
  const dateIndex = headers.findIndex((h) => h.includes("date"));
  const amountIndex = headers.findIndex(
    (h) => h.includes("amount") || h.includes("total") || h.includes("payment")
  );
  const descIndex = headers.findIndex(
    (h) => h.includes("desc") || h.includes("note") || h.includes("memo")
  );
  const methodIndex = headers.findIndex(
    (h) => h.includes("method") || h.includes("type") || h.includes("payment")
  );
  const clinicIndex = headers.findIndex(
    (h) => h.includes("clinic") || h.includes("location") || h.includes("site")
  );

  if (dateIndex === -1 || amountIndex === -1) {
    throw new Error("CSV must have date and amount columns");
  }

  const transactions: BlueprintTransaction[] = [];
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let totalAmount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV values handling quoted strings
    const values = parseCSVLine(line);

    const dateStr = values[dateIndex];
    const amountStr = values[amountIndex]?.replace(/[$,]/g, "");

    if (!dateStr || !amountStr) continue;

    // Parse date
    const transactionDate = parseDate(dateStr);
    if (!transactionDate) continue;

    // Parse amount
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) continue;

    // Generate ID if not present
    const externalId =
      idIndex >= 0 && values[idIndex]
        ? values[idIndex]
        : `BP-${transactionDate.toISOString().split("T")[0]}-${i}`;

    transactions.push({
      externalId,
      transactionDate,
      amount,
      description: descIndex >= 0 ? values[descIndex] || "" : "",
      paymentMethod: methodIndex >= 0 ? values[methodIndex] : undefined,
      clinic: clinicIndex >= 0 ? values[clinicIndex] : undefined,
    });

    totalAmount += amount;

    if (!minDate || transactionDate < minDate) minDate = transactionDate;
    if (!maxDate || transactionDate > maxDate) maxDate = transactionDate;
  }

  return {
    transactions,
    totalAmount,
    dateRange: {
      start: minDate,
      end: maxDate,
    },
  };
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
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

  return values;
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): Date | null {
  // Try MM/DD/YYYY
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [month, day, year] = parts;
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day)
      );
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Try YYYY-MM-DD
  if (dateStr.includes("-")) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Import Blueprint transactions and link to batches by date
 */
export async function importBlueprintTransactions(
  csvText: string
): Promise<{
  imported: number;
  linked: number;
  totalAmount: number;
}> {
  const parsed = parseBlueprintCSV(csvText);

  let imported = 0;
  let linked = 0;

  for (const tx of parsed.transactions) {
    // Find a batch on the same date that doesn't have this transaction
    const batch = await prisma.mscBatch.findFirst({
      where: {
        batchDate: {
          gte: new Date(tx.transactionDate.setHours(0, 0, 0, 0)),
          lt: new Date(tx.transactionDate.setHours(23, 59, 59, 999)),
        },
      },
    });

    let transaction;
    if (batch) {
      transaction = await prisma.blueprintTransaction.upsert({
        where: { externalId: tx.externalId },
        create: {
          externalId: tx.externalId,
          transactionDate: tx.transactionDate,
          amount: tx.amount,
          description: tx.description,
          batch: { connect: { id: batch.id } },
        },
        update: {
          transactionDate: tx.transactionDate,
          amount: tx.amount,
          description: tx.description,
          batch: { connect: { id: batch.id } },
        },
      });
    } else {
      transaction = await prisma.blueprintTransaction.upsert({
        where: { externalId: tx.externalId },
        create: {
          externalId: tx.externalId,
          transactionDate: tx.transactionDate,
          amount: tx.amount,
          description: tx.description,
        },
        update: {
          transactionDate: tx.transactionDate,
          amount: tx.amount,
          description: tx.description,
        },
      });
    }

    imported++;
    if (transaction.batchId) linked++;
  }

  return {
    imported,
    linked,
    totalAmount: parsed.totalAmount,
  };
}

/**
 * Auto-link unlinked transactions to batches by date
 */
export async function linkTransactionsToBatches(): Promise<number> {
  const unlinkedTransactions = await prisma.blueprintTransaction.findMany({
    where: { batchId: null },
  });

  let linked = 0;

  for (const tx of unlinkedTransactions) {
    const startOfDay = new Date(tx.transactionDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(tx.transactionDate);
    endOfDay.setHours(23, 59, 59, 999);

    const batch = await prisma.mscBatch.findFirst({
      where: {
        batchDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (batch) {
      await prisma.blueprintTransaction.update({
        where: { id: tx.id },
        data: { batchId: batch.id },
      });
      linked++;
    }
  }

  return linked;
}
