import { NextResponse } from "next/server";
import crypto from "crypto";

const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const SCOPE = "com.intuit.quickbooks.accounting";
const STATE_COOKIE = "qbo_oauth_state";

export const GET = async () => {
  const clientId = process.env.QBO_CLIENT_ID;
  const redirectUri = process.env.QBO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing QBO_CLIENT_ID or QBO_REDIRECT_URI" },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set({
    name: STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
};
