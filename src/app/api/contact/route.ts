import { NextRequest, NextResponse } from "next/server";
import { contactSchema } from '@/lib/validation/schemas';
import { withRateLimit } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';

// ============================================
// TYPES
// ============================================

interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  subject?: string;
  message: string;
}

// ============================================
// API ROUTE HANDLER
// ============================================


async function handlePost(request: NextRequest) {
  try {
    // Parse and validate input
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;
    const formData = {
      ...validatedData,
      company: (body as Record<string, unknown>).company as string | undefined,
    };


    return NextResponse.json({
      success: true,
      message: 'Thank you for contacting us!',
    });
  } catch (error) {
    console.error("Contact form error:", error);


    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid request body. Please send JSON." },
        { status: 400 }
      );
    }


    return NextResponse.json(
      {
        error: "Something went wrong",
        message: "We couldn't process your message. Please try again or email us directly at hello@athena agentic.co.za.",
      },
      { status: 500 }
    );
  }
}

// Rate-limited POST: 3 submissions per 15 minutes per IP
// Prevents spam and CRM pollution from unauthenticated endpoints
export const POST = withRateLimit(handlePost, {
  limit: 3,
  windowMs: 15 * 60_000, // 15 minutes
  identifierType: 'ip',
  name: 'Contact Form',
});
