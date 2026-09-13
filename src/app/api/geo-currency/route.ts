/**
 * GET /api/geo-currency
 *
 * Returns the user's detected country and local currency based on their IP.
 * Uses Vercel's x-vercel-ip-country header (set at edge, cannot be spoofed).
 *
 * Response: { country: string, currency: string, symbol: string, currencyName: string }
 *
 * This endpoint is called automatically by the pricing page on load.
 * It replaces the old currency selector dropdown.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Currency mapping
const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string; name: string }> = {
  NG: { code: "NGN", symbol: "₦", name: "Naira" },
  US: { code: "USD", symbol: "$", name: "USD" },
  CA: { code: "CAD", symbol: "C$", name: "CAD" },
  GB: { code: "GBP", symbol: "£", name: "GBP" },
  DE: { code: "EUR", symbol: "€", name: "EUR" },
  FR: { code: "EUR", symbol: "€", name: "EUR" },
  ES: { code: "EUR", symbol: "€", name: "EUR" },
  IT: { code: "EUR", symbol: "€", name: "EUR" },
  NL: { code: "EUR", symbol: "€", name: "EUR" },
  GH: { code: "GHS", symbol: "₵", name: "Cedis" },
  KE: { code: "KES", symbol: "KSh", name: "Shilling" },
  AU: { code: "AUD", symbol: "A$", name: "AUD" },
};

const DEFAULT_CURRENCY = { code: "USD", symbol: "$", name: "USD" };

export async function GET(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country") || "NG";

  if (country === "ZA") {
    return NextResponse.json(
      { error: "geo_blocked", redirect: "https://motionmuse.ai/explore" },
      { status: 451 }
    );
  }

  const currency = COUNTRY_CURRENCY[country] || DEFAULT_CURRENCY;

  return NextResponse.json(
    {
      country,
      currency: currency.code,
      symbol: currency.symbol,
      currencyName: currency.name,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
}
