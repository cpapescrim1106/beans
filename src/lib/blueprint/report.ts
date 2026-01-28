const DEFAULT_REPORT_NAME = "Payments and Refunds (Cash Flow)";

export type CashflowReportRequest = {
  reportName?: string;
  periodStart?: string;
  periodEnd?: string;
  showDetails?: "Yes" | "No";
  groupBy?: "Location" | "Provider";
  clinics?: string[];
  providers?: string[];
  paymentMethods?: string[];
  onlinePaymentsPrompt?:
    | "Include online payments"
    | "Exclude online payments"
    | "Only online payments";
  reportVersion?: "PDF" | "XLS" | "Excel";
  reportResultXml?: string;
  waitForResult?: boolean;
  waitMs?: number;
};

export function buildLocalReportUrl(payload: CashflowReportRequest) {
  const baseUrl =
    process.env.BLUEPRINT_REPORT_URL ?? "http://127.0.0.1:7777/report";
  const url = new URL(baseUrl);
  const reportName = payload.reportName ?? DEFAULT_REPORT_NAME;

  url.searchParams.set("name", reportName);

  const params: Record<string, string | string[] | undefined> = {
    periodStart: payload.periodStart,
    periodEnd: payload.periodEnd,
    showDetails: payload.showDetails,
    groupBy: payload.groupBy,
    clinics: payload.clinics,
    providers: payload.providers,
    paymentMethods: payload.paymentMethods,
    onlinePaymentsPrompt: payload.onlinePaymentsPrompt,
    reportVersion:
      payload.reportVersion === "Excel" ? "XLS" : payload.reportVersion,
  };

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      url.searchParams.set(key, JSON.stringify(value));
      continue;
    }
    url.searchParams.set(key, value);
  }

  return url;
}

const DEFAULT_REPORT_FILENAME_XLS = "/reports/cashFlowSummary_excel.jasper";
const DEFAULT_REPORT_FILENAME_PDF = "/reports/cashFlowSummary.jasper";

type BlueprintReportPayload = {
  branchId: number;
  userId: number;
  username: string;
  reportName: string;
  reportFilename: string;
  clinicIdentifier: string;
  parameterMap: Record<string, unknown>;
  reportResultXml: string;
  hearingClinic: boolean;
  isHearingClinic: boolean;
};

const readIntEnv = (name: string, fallback: number) => {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const readBoolEnv = (name: string, fallback: boolean) => {
  const value = process.env[name];
  if (!value) return fallback;
  return value.toLowerCase() === "true";
};

const readListEnv = (name: string) => {
  const value = process.env[name];
  if (!value) return undefined;
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export function buildReportRequest(payload: CashflowReportRequest) {
  const reportResultXml =
    payload.reportResultXml ??
    `${process.env.BLUEPRINT_REPORT_KEY_PREFIX ?? "FL_acc_50_"}${Date.now()}`;
  const reportName = payload.reportName ?? DEFAULT_REPORT_NAME;
  const reportVersion =
    payload.reportVersion === "Excel"
      ? "XLS"
      : payload.reportVersion ?? "XLS";
  const reportFilename =
    reportVersion === "PDF"
      ? DEFAULT_REPORT_FILENAME_PDF
      : DEFAULT_REPORT_FILENAME_XLS;

  const parameterMap: Record<string, unknown> = {
    reportVersion,
    REPORT_LOCALE: process.env.BLUEPRINT_REPORT_LOCALE ?? "en_US",
    REPORT_TIME_ZONE: process.env.BLUEPRINT_REPORT_TIME_ZONE ?? "US/Eastern",
    SUBREPORT_DIR: process.env.BLUEPRINT_REPORT_SUBREPORT_DIR ?? "/reports/",
  };

  if (payload.periodStart) {
    parameterMap.periodStart = payload.periodStart;
  }
  if (payload.periodEnd) {
    parameterMap.periodEnd = payload.periodEnd;
  }
  if (payload.showDetails) {
    parameterMap.showDetails = payload.showDetails;
  }
  if (payload.groupBy) {
    parameterMap.groupBy = payload.groupBy;
  }
  if (payload.onlinePaymentsPrompt) {
    parameterMap.onlinePaymentsPrompt = payload.onlinePaymentsPrompt;
  }

  const clinics = payload.clinics ?? readListEnv("BLUEPRINT_DEFAULT_CLINICS");
  if (clinics?.length) {
    parameterMap.clinics = clinics;
  }
  if (payload.providers?.length) {
    parameterMap.providers = payload.providers;
  }
  if (payload.paymentMethods?.length) {
    parameterMap.paymentMethods = payload.paymentMethods;
  }

  const blueprintPayload: BlueprintReportPayload = {
    branchId: readIntEnv("BLUEPRINT_BRANCH_ID", 1269),
    userId: readIntEnv("BLUEPRINT_USER_ID", 50),
    username: process.env.BLUEPRINT_USERNAME ?? "cpape",
    reportName,
    reportFilename,
    clinicIdentifier: process.env.BLUEPRINT_CLINIC_IDENTIFIER ?? "RkxfYWNj",
    parameterMap,
    reportResultXml,
    hearingClinic: readBoolEnv("BLUEPRINT_HEARING_CLINIC", true),
    isHearingClinic: readBoolEnv("BLUEPRINT_IS_HEARING_CLINIC", true),
  };

  return { blueprintPayload, reportResultXml };
}
