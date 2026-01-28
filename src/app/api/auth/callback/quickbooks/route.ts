import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const STATE_COOKIE = "qbo_oauth_state";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");

  if (!code || !realmId) {
    return NextResponse.json(
      { error: "Missing code or realmId" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Missing QBO credentials" },
      { status: 500 },
    );
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    return NextResponse.json(
      { error: "QuickBooks token exchange failed", details },
      { status: 502 },
    );
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token as string | undefined;
  const refreshToken = tokenData.refresh_token as string | undefined;
  const expiresIn = tokenData.expires_in as number | undefined;

  if (!accessToken || !refreshToken || !expiresIn) {
    return NextResponse.json(
      { error: "Missing token fields in response" },
      { status: 502 },
    );
  }

  const expiresAt = new Date(Date.now() + Number(expiresIn) * 1000);

  await prisma.qboToken.upsert({
    where: { realmId },
    create: {
      realmId,
      accessToken,
      refreshToken,
      expiresAt,
    },
    update: {
      accessToken,
      refreshToken,
      expiresAt,
    },
  });

  const response = NextResponse.redirect(
    new URL("/dashboard?quickbooks=connected", request.url),
  );
  response.cookies.set({ name: STATE_COOKIE, value: "", maxAge: 0, path: "/" });

  return response;
};
