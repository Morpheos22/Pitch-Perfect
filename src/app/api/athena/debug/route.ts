/**
 * GET /api/athena/debug
 *
 * Diagnostic endpoint that tests the function-calling pipeline end-to-end.
 * Returns the raw Cloudflare AI response so we can see exactly what the
 * model returns when tools are provided.
 *
 * This route is for debugging only — it should be removed after the
 * function-calling loop is verified working.
 *
 * Requires auth (admin/founder email only).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAvailableTools, toolsToFunctionSchema } from "@/lib/athena-mcp";
import { isAdminEmail } from "@/lib/dev-auth";
import { clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(_request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only allow admin/founder emails to access debug
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email || !isAdminEmail(email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  const CF_AI_TOKEN = process.env.CLOUDFLARE_AI_TOKEN || process.env.CF_API_TOKEN || "";
  const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run`;
  const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

  // Step 1: Get available tools
  const tools = await getAvailableTools();
  const functionSchema = toolsToFunctionSchema(tools);

  // Step 2: Build a test message that should trigger a tool call
  const messages = [
    {
      role: "system",
      content: "You are a helpful assistant with access to tools. When asked to read a file from a repo, use the github_read_file tool.",
    },
    {
      role: "user",
      content: "Read the README.md file from the Morpheos22/Pitch-Perfect repository.",
    },
  ];

  // Step 3: Call Cloudflare AI WITH tools
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let rawResponse: any = null;
  let requestError: string | null = null;

  try {
    const res = await fetch(`${CF_BASE}/${MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_AI_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        max_tokens: 1024,
        temperature: 0.5,
        tools: functionSchema,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    try {
      rawResponse = JSON.parse(text);
    } catch {
      rawResponse = { rawText: text.slice(0, 500) };
    }

    if (!res.ok) {
      requestError = `HTTP ${res.status}`;
    }
  } catch (err) {
    requestError = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeout);
  }

  // Step 4: Also test WITHOUT tools (plain text mode)
  let plainResponse: any = null;
  try {
    const res2 = await fetch(`${CF_BASE}/${MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_AI_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        max_tokens: 256,
        temperature: 0.5,
      }),
    });
    plainResponse = await res2.json();
  } catch (err) {
    plainResponse = { error: err instanceof Error ? err.message : String(err) };
  }

  // Return everything for debugging
  return NextResponse.json({
    step1_tools_available: {
      count: tools.length,
      tool_names: tools.map(t => t.name),
      // Show the first tool's schema to verify format
      first_tool_schema: functionSchema[0] || null,
    },
    step2_cf_config: {
      has_account_id: !!CF_ACCOUNT_ID,
      has_ai_token: !!CF_AI_TOKEN,
      model: MODEL,
      endpoint: CF_BASE,
    },
    step3_with_tools: {
      request_error: requestError,
      has_result: !!rawResponse?.result,
      response_text: rawResponse?.result?.response?.slice(0, 500) || null,
      tool_calls: rawResponse?.result?.tool_calls || null,
      errors: rawResponse?.errors || null,
      raw: rawResponse,
    },
    step4_without_tools: {
      response_text: plainResponse?.result?.response?.slice(0, 300) || null,
      errors: plainResponse?.errors || null,
    },
    conclusion: {
      tools_are_working: !!(rawResponse?.result?.tool_calls?.length > 0),
      model_returned_text: !!rawResponse?.result?.response,
      issue: rawResponse?.result?.tool_calls?.length > 0
        ? "Tools are working — the issue is elsewhere"
        : rawResponse?.errors
          ? `Cloudflare API error: ${JSON.stringify(rawResponse.errors)}`
          : rawResponse?.result?.response
            ? "Model responded with text only — it did NOT call any tools. The tools format may be wrong, or the model may not support function calling."
            : "No response from Cloudflare API — check token/config",
    },
  }, { status: 200 });
}
