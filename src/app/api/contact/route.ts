import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateLead } from "@/lib/zoho-crm";
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
// ZOHO CRM LEAD SYNC
// ============================================
// Contact form submissions are synced directly to Zoho CRM as leads.
// Zoho Forms has been removed — CRM is the single source of truth.


async function syncToZohoCRM(data: ContactFormData): Promise<{ success: boolean; leadId?: string; error?: string }> {
  try {
    const result = await createOrUpdateLead({
      email: data.email,
      firstName: data.name.split(" ")[0],
      lastName: data.name.split(" ").slice(1).join(" ") || undefined,
      company: data.company,
      leadSource: "Website Contact Form",
      leadStatus: "New",
      description: `Subject: ${data.subject || "General Inquiry"}\n\n${data.message}`,
    });


    return {
      success: true,
      leadId: result.id,
    };
  } catch (error) {
    console.error("Zoho CRM lead sync error:", error);
    // Don't fail the entire request if CRM is down
    return { success: true };
  }
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


    // Sync to Zoho CRM as a Lead (single source of truth)
    const crmResult = await syncToZohoCRM(formData) as { success: boolean; leadId?: string; isNew?: boolean };


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
        message: "We couldn't process your message. Please try again or email us directly at hello@automagikal.co.za.",
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
