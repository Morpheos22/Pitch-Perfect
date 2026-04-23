import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateLead } from "@/lib/zoho-crm";
import { contactSchema } from '@/lib/validation/schemas';
import { withRateLimit } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';

// Zoho Forms configuration
const ZOHO_FORMS_CONFIG = {
  apiDomain: process.env.ZOHO_FORMS_API_DOMAIN || "https://forms.zoho.com",
  formLinkName: process.env.ZOHO_CONTACT_FORM_LINK_NAME || "contact-form",
  accessToken: process.env.ZOHO_FORMS_ACCESS_TOKEN || "",
};


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
// ZOHO FORMS SUBMISSION
// ============================================


async function submitToZohoForms(data: ContactFormData): Promise<{ success: boolean; recordId?: string; error?: string }> {
  const token = ZOHO_FORMS_CONFIG.accessToken;


  if (!token) {
    // If no Zoho Forms token is configured, skip but don't fail
    console.warn("Zoho Forms access token not configured. Skipping form submission.");
    return { success: true };
  }


  try {
    const formFields: Record<string, string> = {
      Name: data.name,
      Email: data.email,
      Message: data.message,
    };


    if (data.company) formFields.Company = data.company;
    if (data.subject) formFields.Subject = data.subject;


    const response = await fetch(
      `${ZOHO_FORMS_CONFIG.apiDomain}/api/json/${ZOHO_FORMS_CONFIG.formLinkName}/formRecords`,
      {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formFields),
      }
    );


    if (!response.ok) {
      const errorText = await response.text();
      console.error("Zoho Forms submission failed:", response.status, errorText);
      return { success: false, error: `Zoho Forms error: ${response.status}` };
    }


    const result = await response.json();
    return {
      success: true,
      recordId: result?.data?.[0]?.details?.ID || result?.ID,
    };
  } catch (error) {
    console.error("Zoho Forms submission error:", error);
    // Don't fail the entire request if Zoho Forms is down
    return { success: true };
  }
}


// ============================================
// ZOHO CRM LEAD SYNC
// ============================================


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


    // Submit to Zoho Forms
    const formsResult = await submitToZohoForms(formData);


    // Sync to Zoho CRM as a Lead
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
