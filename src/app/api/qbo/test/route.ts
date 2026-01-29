import { auth } from "@/auth";
import { getDefaultQboClient } from "@/lib/qbo";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await getDefaultQboClient();
    if (!client) {
      return NextResponse.json({ error: "QBO not connected" }, { status: 400 });
    }

    const companyInfo = await client.getCompanyInfo();

    // Also try to fetch recent deposits (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const deposits = await client.getDeposits(startDate, endDate);

    return NextResponse.json({
      success: true,
      company: companyInfo,
      recentDeposits: {
        count: deposits.length,
        total: deposits.reduce((sum, d) => sum + d.TotalAmt, 0),
        deposits: deposits.map(d => ({
          id: d.Id,
          date: d.TxnDate,
          amount: d.TotalAmt,
        })),
      },
    });
  } catch (error) {
    console.error("[QBO Test] Error:", error);
    return NextResponse.json(
      { error: "QBO API error", details: String(error) },
      { status: 500 }
    );
  }
}
