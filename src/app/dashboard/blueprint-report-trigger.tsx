"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = {
  periodStart: string;
  periodEnd: string;
  clinics: string;
  paymentMethods: string;
  showDetails: boolean;
  groupBy: "" | "Location" | "Provider";
  reportVersion: "PDF" | "XLS";
  onlinePaymentsPrompt:
    | "Include online payments"
    | "Exclude online payments"
    | "Only online payments";
};

const initialState: FormState = {
  periodStart: "",
  periodEnd: "",
  clinics: "",
  paymentMethods: "",
  showDetails: false,
  groupBy: "Location",
  reportVersion: "XLS",
  onlinePaymentsPrompt: "Include online payments",
};

export default function BlueprintReportTrigger() {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setDownloadUrl(null);
    setError(null);

    try {
      const clinics = form.clinics
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      const paymentMethods = form.paymentMethods
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      const payload = {
        periodStart: form.periodStart || undefined,
        periodEnd: form.periodEnd || undefined,
        showDetails: form.showDetails ? "Yes" : "No",
        groupBy: form.groupBy || undefined,
        reportVersion: form.reportVersion,
        onlinePaymentsPrompt: form.onlinePaymentsPrompt,
        clinics: clinics.length ? clinics : undefined,
        paymentMethods: paymentMethods.length ? paymentMethods : undefined,
        waitForResult: true,
        waitMs: 15000,
      };

      const response = await fetch("/api/blueprint/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? `Request failed (${response.status}).`);
        return;
      }

      const waitStatus = data?.wait?.found
        ? "Report file is ready in S3."
        : "Report queued (S3 not ready yet).";
      setMessage(
        data?.reportResultXml
          ? `Triggered: ${data.reportResultXml}. ${waitStatus}`
          : "Report queued.",
      );
      if (data?.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
      }
    } catch (err) {
      console.error("Report trigger failed:", err);
      setError("Failed to trigger report.");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled =
    loading ||
    form.periodStart.length === 0 ||
    form.periodEnd.length === 0 ||
    form.clinics.trim().length === 0;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="min-w-[180px] space-y-1">
          <Label htmlFor="periodStart">Start date</Label>
          <Input
            id="periodStart"
            type="date"
            value={form.periodStart}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, periodStart: event.target.value }))
            }
          />
        </div>
        <div className="min-w-[180px] space-y-1">
          <Label htmlFor="periodEnd">End date</Label>
          <Input
            id="periodEnd"
            type="date"
            value={form.periodEnd}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, periodEnd: event.target.value }))
            }
          />
        </div>
        <div className="min-w-[200px] space-y-1">
          <Label htmlFor="clinics">Clinics (comma-separated)</Label>
          <Input
            id="clinics"
            placeholder="SHD"
            value={form.clinics}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, clinics: event.target.value }))
            }
          />
        </div>
        <div className="min-w-[220px] space-y-1">
          <Label htmlFor="paymentMethods">Payment methods (comma-separated)</Label>
          <Input
            id="paymentMethods"
            placeholder="Visa, Mastercard, Cash"
            value={form.paymentMethods}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                paymentMethods: event.target.value,
              }))
            }
          />
        </div>
        <div className="min-w-[160px] space-y-1">
          <Label htmlFor="groupBy">Group by</Label>
          <select
            id="groupBy"
            value={form.groupBy}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                groupBy: event.target.value as FormState["groupBy"],
              }))
            }
            className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm text-zinc-900 shadow-sm focus:outline-none dark:border-zinc-800 dark:text-zinc-100"
          >
            <option value="">None</option>
            <option value="Location">Location</option>
            <option value="Provider">Provider</option>
          </select>
        </div>
        <div className="min-w-[140px] space-y-1">
          <Label htmlFor="reportVersion">Format</Label>
          <select
            id="reportVersion"
            value={form.reportVersion}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                reportVersion: event.target.value as FormState["reportVersion"],
              }))
            }
            className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm text-zinc-900 shadow-sm focus:outline-none dark:border-zinc-800 dark:text-zinc-100"
          >
            <option value="PDF">PDF</option>
            <option value="XLS">XLS</option>
          </select>
        </div>
        <div className="min-w-[220px] space-y-1">
          <Label htmlFor="onlinePaymentsPrompt">Online payments</Label>
          <select
            id="onlinePaymentsPrompt"
            value={form.onlinePaymentsPrompt}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                onlinePaymentsPrompt:
                  event.target.value as FormState["onlinePaymentsPrompt"],
              }))
            }
            className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm text-zinc-900 shadow-sm focus:outline-none dark:border-zinc-800 dark:text-zinc-100"
          >
            <option value="Include online payments">
              Include online payments
            </option>
            <option value="Exclude online payments">
              Exclude online payments
            </option>
            <option value="Only online payments">Only online payments</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pt-6 text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={form.showDetails}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, showDetails: event.target.checked }))
            }
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
          />
          Show details
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isDisabled}>
          {loading ? "Requesting..." : "Run Cashflow Report"}
        </Button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Sends an SQS report request and waits briefly for S3 output.
        </span>
      </div>
      {message ? (
        <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
          {message}
        </p>
      ) : null}
      {downloadUrl ? (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          <a
            href={downloadUrl}
            className="text-blue-600 underline underline-offset-4 dark:text-blue-400"
            target="_blank"
            rel="noreferrer"
          >
            Download report (expires soon)
          </a>
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </form>
  );
}
