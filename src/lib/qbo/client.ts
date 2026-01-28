import prisma from "@/lib/prisma";

const QBO_BASE_URL = "https://quickbooks.api.intuit.com";
const QBO_SANDBOX_URL = "https://sandbox-quickbooks.api.intuit.com";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// Use sandbox in development
const getBaseUrl = () =>
  process.env.NODE_ENV === "production" ? QBO_BASE_URL : QBO_SANDBOX_URL;

interface QboToken {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresAt: Date;
}

interface QboDeposit {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  PrivateNote?: string;
  DepositToAccountRef?: {
    value: string;
    name: string;
  };
  Line?: Array<{
    Amount: number;
    DetailType: string;
    DepositLineDetail?: {
      Entity?: { value: string; name: string };
      AccountRef?: { value: string; name: string };
    };
  }>;
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

interface QboQueryResponse<T> {
  QueryResponse: {
    [key: string]: T[];
    startPosition: number;
    maxResults: number;
    totalCount?: number;
  };
}

export class QboClient {
  private realmId: string;

  constructor(realmId: string) {
    this.realmId = realmId;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidToken(): Promise<string> {
    const token = await prisma.qboToken.findUnique({
      where: { realmId: this.realmId },
    });

    if (!token) {
      throw new Error(`No QBO token found for realm ${this.realmId}`);
    }

    // Check if token expires in the next 5 minutes
    const expiresIn = token.expiresAt.getTime() - Date.now();
    if (expiresIn < 5 * 60 * 1000) {
      return this.refreshToken(token);
    }

    return token.accessToken;
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshToken(token: QboToken): Promise<string> {
    const clientId = process.env.QBO_CLIENT_ID;
    const clientSecret = process.env.QBO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing QBO_CLIENT_ID or QBO_CLIENT_SECRET");
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh QBO token: ${error}`);
    }

    const data = await response.json();

    // Update token in database
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    await prisma.qboToken.update({
      where: { realmId: this.realmId },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
      },
    });

    return data.access_token;
  }

  /**
   * Make an authenticated request to the QBO API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await this.getValidToken();
    const url = `${getBaseUrl()}/v3/company/${this.realmId}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`QBO API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Query the QBO API using SQL-like syntax
   */
  async query<T>(entity: string, query: string): Promise<T[]> {
    const fullQuery = `SELECT * FROM ${entity} WHERE ${query}`;
    const encoded = encodeURIComponent(fullQuery);
    const response = await this.request<QboQueryResponse<T>>(
      `/query?query=${encoded}`
    );
    return response.QueryResponse[entity] || [];
  }

  /**
   * Fetch deposits within a date range
   */
  async getDeposits(startDate: Date, endDate: Date): Promise<QboDeposit[]> {
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];

    return this.query<QboDeposit>(
      "Deposit",
      `TxnDate >= '${start}' AND TxnDate <= '${end}'`
    );
  }

  /**
   * Fetch a single deposit by ID
   */
  async getDeposit(depositId: string): Promise<QboDeposit> {
    const response = await this.request<{ Deposit: QboDeposit }>(
      `/deposit/${depositId}`
    );
    return response.Deposit;
  }

  /**
   * Fetch company info
   */
  async getCompanyInfo(): Promise<{
    CompanyName: string;
    LegalName?: string;
    Country: string;
  }> {
    const response = await this.request<{
      CompanyInfo: { CompanyName: string; LegalName?: string; Country: string };
    }>(`/companyinfo/${this.realmId}`);
    return response.CompanyInfo;
  }

  /**
   * Get all deposits and sync to local database
   */
  async syncDeposits(startDate: Date, endDate: Date): Promise<number> {
    const deposits = await this.getDeposits(startDate, endDate);

    let synced = 0;
    for (const deposit of deposits) {
      await prisma.qboDeposit.upsert({
        where: { externalId: deposit.Id },
        create: {
          externalId: deposit.Id,
          depositDate: new Date(deposit.TxnDate),
          totalAmount: deposit.TotalAmt,
        },
        update: {
          depositDate: new Date(deposit.TxnDate),
          totalAmount: deposit.TotalAmt,
        },
      });
      synced++;
    }

    return synced;
  }
}

/**
 * Get QBO client for the first connected realm (convenience function)
 */
export async function getDefaultQboClient(): Promise<QboClient | null> {
  const token = await prisma.qboToken.findFirst();
  if (!token) return null;
  return new QboClient(token.realmId);
}

/**
 * Check if QBO is connected
 */
export async function isQboConnected(): Promise<boolean> {
  const token = await prisma.qboToken.findFirst();
  return !!token;
}
