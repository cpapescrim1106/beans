import { auth } from "@/auth";
import { internalServerError, jsonData, unauthorized } from "@/lib/api-response";
import { NextResponse } from "next/server";
import {
  type CashflowReportRequest,
  buildReportRequest,
} from "@/lib/blueprint/report";
import {
  createReportDownloadUrl,
  sendReportMessage,
  waitForReportObject,
} from "@/lib/blueprint/aws";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request, hasSession: boolean) {
  if (hasSession) return true;
  const apiKey = process.env.REPORT_API_KEY;
  if (!apiKey) return true;
  const header =
    request.headers.get("x-api-key") ?? request.headers.get("authorization");
  if (!header) return false;
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : header.trim();
  return token.length > 0 && token === apiKey;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAuthorized(request, Boolean(session?.user?.id))) {
      return unauthorized("Missing or invalid report key.");
    }

    let payload: CashflowReportRequest;
    try {
      payload = (await request.json()) as CashflowReportRequest;
    } catch (error) {
      console.error("Invalid report request body:", error);
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { blueprintPayload, reportResultXml } = buildReportRequest(payload);
    const messageBody = JSON.stringify(blueprintPayload);
    const groupId = process.env.BLUEPRINT_SQS_GROUP_ID ?? "beans_automation";

    const sqsResponse = await sendReportMessage({
      messageBody,
      deduplicationId: reportResultXml,
      groupId,
    });

    const waitForResult = payload.waitForResult ?? true;
    const waitMs = payload.waitMs ?? 15000;
    const waitResult = waitForResult
      ? await waitForReportObject({ key: reportResultXml, timeoutMs: waitMs })
      : null;

    const presigned =
      waitResult?.found
        ? await createReportDownloadUrl({ key: reportResultXml })
        : null;

    return jsonData({
      reportResultXml,
      sqsMessageId: sqsResponse.MessageId ?? null,
      wait: waitResult,
      downloadUrl: presigned?.url ?? null,
      downloadExpiresIn: presigned?.expiresInSeconds ?? null,
    });
  } catch (error) {
    console.error("Blueprint report trigger failed:", error);
    return internalServerError("Failed to trigger report.");
  }
}
