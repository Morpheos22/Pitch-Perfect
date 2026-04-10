import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateLead } from "@/lib/zoho-crm";
import { contactSchema } from '@/lib/validation/schemas';

// Zoho Forms configuration
const ZOHO_FORMS_CONFIG = {
  apiDomain: process.env.ZOHO_FORMS_API_DOMAIN || "https://forms.zoho.com",
  formLinkName: process.env.ZOHO_CONTACT_FORM_LINK_NAME || "contact-form",
  accessToken: process.env.ZOHO_FORMS_ACCESS_TOKEN || "",
};

// ============================================
// VALIDATION
// ============================================

interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  subject?: string;
  message: string;
}

function validateInput(body: unknown): {
  valid: boolean;
  data?: ContactFormData;
  errors?: string[];
} {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Invalid request body"] };
  }

  const data = body as Record<string, unknown>;

  // Name is required
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name || name.length < 2) {
    errors.push("Name is required and must be at least 2 characters");
  }

  // Email is required and must be valid
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    errors.push("Email is required");
  } else if (!emailRegex.test(email)) {
    errors.push("Please provide a valid email address");
  }

  // Message is required with minimum length
  const message = typeof data.message === "string" ? data.message.trim() : "";
  if (!message) {
    errors.push("Message is required");
  } else if (message.length < 10) {
    errors.push("Message must be at least 10 characters long");
  } else if (message.length > 5000) {
    errors.push("Message must be under 5000 characters");
  }

  // Optional fields
  const company = typeof data.company === "string" ? data.company.trim() : "";
  const subject = typeof data.subject === "string" ? data.subject.trim() : "";

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: { name, email, company: company || undefined, subject: subject || undefined, message },
  };
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
// TODO: Add rate limiting (e.g., 5 submissions per 15 minutes per IP)
// Consider using a rate-limiting middleware or service like Upstash Ratelimit

export async function POST(request: NextRequest) {
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
