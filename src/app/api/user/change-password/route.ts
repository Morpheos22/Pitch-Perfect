import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// POST /api/user/change-password
// Proxies password change to Clerk Backend API to avoid CORS issues
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        { error: "New password is too long (max 128 characters)." },
        { status: 400 }
      );
    }

    // Get the session token from the client and forward it to Clerk's API
    // This keeps the Clerk API call server-side to avoid CORS issues
    const authHeader = request.headers.get("authorization");
    const clientToken = authHeader?.replace("Bearer ", "");

    if (!clientToken) {
      return NextResponse.json(
        { error: "No session token found. Please sign in again." },
        { status: 401 }
      );
    }

    const res = await fetch("https://api.clerk.com/v1/me/password", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${clientToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    if (res.ok) {
      return NextResponse.json({ success: true });
    }

    const data = await res.json().catch(() => ({}));
    const clerkError = data?.errors?.[0];
    const message = clerkError?.long_message || clerkError?.message || "Failed to change password.";

    return NextResponse.json(
      { error: message },
      { status: res.status }
    );
  } catch (error: any) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "Failed to change password. Please try again." },
      { status: 500 }
    );
  }
}
