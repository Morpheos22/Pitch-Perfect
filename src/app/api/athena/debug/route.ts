/**
 * GET /api/athena/debug
 *
 * Diagnostic endpoint that tests the function-calling pipeline end-to-end.
 * Tests: tool discovery → model tool call → tool execution → second model call.
 *
 * Requires auth (admin/founder email only).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAvailableTools, toolsToFunctionSchema, callTool } from "@/lib/athena-mcp";
import { isAdminEmail } from "@/lib/dev-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(_request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

  // Step 1: Get available tools
  const tools = await getAvailableTools();
  const functionSchema = toolsToFunctionSchema(tools);

  // Step 2: Build a test message
  const messages: any[] = [
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
  let step3Result: any = {};
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
    });
    const raw = await res.json();
    step3Result = {
      status: res.status,
      tool_calls: raw?.result?.tool_calls || null,
      response: raw?.result?.response || null,
      errors: raw?.errors || null,
    };
  } catch (err) {
    step3Result = { error: String(err) };
  }

  // Step 4: If we got tool calls, EXECUTE the tool
  let step4Result: any = {};
  const toolCalls = step3Result.tool_calls || [];
  if (toolCalls.length > 0) {
    const tc = toolCalls[0];
    const toolName = tc.name;
    const args = tc.arguments || {};
    step4Result = {
      tool_name: toolName,
      args: args,
      github_token_set: !!GITHUB_TOKEN,
      github_token_length: GITHUB_TOKEN.length,
      github_token_prefix: GITHUB_TOKEN.slice(0, 8) + "...",
    };
    try {
      const result = await callTool(toolName, args);
      step4Result.result_content = result.content.slice(0, 500);
      step4Result.result_is_error = result.isError;
    } catch (err) {
      step4Result.execution_error = String(err);
    }

    // Step 5: Call model AGAIN without tools, with the tool result
    const messagesWithResult = [...messages, {
      role: "user",
      content: `[Tool result from ${toolName}]: ${step4Result.result_content || "no result"}\n\nBased on this, answer my original question concisely.`,
    }];
    let step5Result: any = {};
    try {
      const res2 = await fetch(`${CF_BASE}/${MODEL}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_AI_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messagesWithResult,
          max_tokens: 512,
          temperature: 0.5,
          // NO tools — force text response
        }),
      });
      const raw2 = await res2.json();
      step5Result = {
        status: res2.status,
        response: raw2?.result?.response?.slice(0, 500) || null,
        errors: raw2?.errors || null,
      };
    } catch (err) {
      step5Result = { error: String(err) };
    }
    step4Result.second_model_call = step5Result;
  }

  return NextResponse.json({
    step1_tools: {
      count: tools.length,
      names: tools.map(t => t.name),
    },
    step2_config: {
      has_github_token: !!GITHUB_TOKEN,
      github_token_length: GITHUB_TOKEN.length,
      has_cf_account_id: !!CF_ACCOUNT_ID,
      has_cf_ai_token: !!CF_AI_TOKEN,
    },
    step3_model_call_with_tools: step3Result,
    step4_tool_execution: step4Result,
    conclusion: {
      tools_discovered: tools.length,
      model_called_tool: toolCalls.length > 0,
      tool_executed: !!step4Result.result_content,
      second_call_succeeded: !!step4Result.second_model_call?.response,
      issue: !toolCalls.length
        ? "Model did not call any tools"
        : !step4Result.result_content
          ? "Tool execution failed — see execution_error"
          : !step4Result.second_model_call?.response
            ? "Second model call (text response) failed — see second_model_call"
            : "Full pipeline works — issue is in the chat route code, not the tools",
    },
  }, { status: 200 });
}
