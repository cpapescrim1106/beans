"use client";

import DefaultLayout from "@/components/default-layout";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  totalRows: number;
  errors?: string[];
}

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setCsvText(text);
  }

  async function handleImport() {
    if (!csvText.trim()) {
      setError("Please provide CSV data");
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("csv", csvText);

      const res = await fetch("/api/reconciliation/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || "Import failed");
      }
    } catch (err) {
      setError("Import failed");
    } finally {
      setImporting(false);
    }
  }

  const sampleCSV = `batch_id,date,amount,description
BATCH001,01/15/2025,1234.56,Daily credit card batch
BATCH002,01/16/2025,2345.67,Daily credit card batch
BATCH003,01/17/2025,3456.78,Daily credit card batch`;

  return (
    <DefaultLayout
      title="Import MSC Batches"
      description="Upload CSV file with batch data"
    >
      <div className="max-w-2xl space-y-6">
        {/* Instructions */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-2">CSV Format</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Your CSV should have columns for batch ID, date, and amount. Column
            names are flexible - the importer will detect common names like
            &quot;id&quot;, &quot;batch&quot;, &quot;date&quot;, &quot;amount&quot;, &quot;total&quot;.
          </p>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
            {sampleCSV}
          </pre>
        </div>

        {/* File Upload */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-3">Upload File</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="block w-full text-sm text-muted-foreground
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-primary file:text-primary-foreground
              hover:file:bg-primary/90"
          />
        </div>

        {/* Or Paste CSV */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-3">Or Paste CSV Data</h3>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste CSV data here..."
            rows={10}
            className="w-full p-3 border rounded font-mono text-sm"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={`rounded-lg border p-4 ${result.imported > 0 ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}
          >
            <h3 className="font-semibold mb-2">Import Complete</h3>
            <ul className="text-sm space-y-1">
              <li>Total rows: {result.totalRows}</li>
              <li className="text-green-700">Imported: {result.imported}</li>
              {result.skipped > 0 && (
                <li className="text-yellow-700">Skipped: {result.skipped}</li>
              )}
            </ul>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium text-red-700">Errors:</div>
                <ul className="text-xs text-red-600 mt-1">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={handleImport} disabled={importing || !csvText.trim()}>
            {importing ? "Importing..." : "Import Batches"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/reconciliation">Cancel</Link>
          </Button>
          {result && result.imported > 0 && (
            <Button
              variant="secondary"
              onClick={() => router.push("/dashboard/reconciliation")}
            >
              View Batches →
            </Button>
          )}
        </div>
      </div>
    </DefaultLayout>
  );
}
