// Zoho Surveys Integration Service for Pitch Perfect × Automagikal
// Founder feedback collection, NPS scores, post-session surveys
// Uses API key authentication (simpler than OAuth)

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Supported question types in Zoho Surveys */
export type QuestionType =
  | 'multiple_choice'
  | 'checkbox'
  | 'rating'
  | 'linear_scale'
  | 'open_ended'
  | 'matrix'
  | 'date_time'
  | 'nps';

/** A survey question definition */
export interface SurveyQuestion {
  questionText: string;
  type: QuestionType;
  options?: string[];
  required?: boolean;
  helpText?: string;
}

/** A created survey */
export interface Survey {
  surveyId: string;
  title: string;
  status: 'active' | 'closed' | 'draft';
  createdAt: string;
  responseCount?: number;
}

/** Individual survey response */
export interface SurveyResponse {
  responseId: string;
  submittedAt: string;
  email?: string;
  answers: Record<string, string | number | string[]>;
}

/** Aggregated analytics for a survey */
export interface ResponseAnalytics {
  surveyId: string;
  totalResponses: number;
  completionRate: number;
  averageDuration: number;
  questionStats: Array<{
    questionId: string;
    questionText: string;
    responseCount: number;
    distribution?: Record<string, number>;
    averageScore?: number;
  }>;
}

// ============================================
// ZOHO SURVEYS API CONFIGURATION
// ============================================

const ZOHO_SURVEYS_CONFIG = {
  apiDomain: process.env.ZOHO_SURVEYS_API_DOMAIN || 'https://www.zohoapis.com/surveys',
  apiKey: process.env.ZOHO_SURVEYS_API_KEY,
};

// ============================================
// API HELPER
// ============================================

async function surveysRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object,
): Promise<unknown> {
  if (!ZOHO_SURVEYS_CONFIG.apiKey) {
    throw new Error('ZOHO_SURVEYS_API_KEY environment variable is required');
  }

  const headers: Record<string, string> = {
    'Authorization': `Zoho-oauthtoken ${ZOHO_SURVEYS_CONFIG.apiKey}`,
  };
  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${ZOHO_SURVEYS_CONFIG.apiDomain}/api/v1${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho Surveys API error (${method} ${endpoint}): ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ============================================
// SURVEY MANAGEMENT
// ============================================

/**
 * Create a new survey with the given title and questions.
 * @param title - Survey title (e.g. "Post-Session Feedback — Deck Analysis")
 * @param questions - Array of question definitions
 */
export async function createSurvey(
  title: string,
  questions: SurveyQuestion[],
): Promise<{ surveyId: string }> {
  const formattedQuestions = questions.map((q, index) => ({
    type: q.type,
    question: q.questionText,
    options: q.options || [],
    required: q.required !== false,
    helpText: q.helpText || '',
    order: index + 1,
  }));

  const result = await surveysRequest('/surveys', 'POST', {
    title,
    questions: formattedQuestions,
    status: 'active',
  }) as { surveyId: string };

  return { surveyId: result.surveyId };
}

/**
 * Retrieve all responses for a given survey.
 * @param surveyId - The survey to fetch responses for
 */
export async function getSurveyResults(surveyId: string): Promise<SurveyResponse[]> {
  const result = await surveysRequest(
    `/surveys/${surveyId}/responses`,
  ) as {
    responses: Array<{
      id: string;
      submittedAt: string;
      email?: string;
      answers: Record<string, string | number | string[]>;
    }>;
  };

  return (result.responses || []).map((r) => ({
    responseId: r.id,
    submittedAt: r.submittedAt,
    email: r.email,
    answers: r.answers,
  }));
}

/**
 * Send a survey invitation to a specific email address.
 * @param surveyId - The survey to send
 * @param email - Recipient email address
 */
export async function sendSurvey(
  surveyId: string,
  email: string,
): Promise<{ invitationId: string }> {
  const result = await surveysRequest(`/surveys/${surveyId}/invitations`, 'POST', {
    emails: [email],
    template: 'default',
  }) as { invitationId: string };

  return { invitationId: result.invitationId };
}

/**
 * Get aggregated analytics for a survey — response counts, completion rates,
 * per-question distributions and average scores.
 * @param surveyId - The survey to analyse
 */
export async function getResponseAnalytics(surveyId: string): Promise<ResponseAnalytics> {
  const result = await surveysRequest(
    `/surveys/${surveyId}/analytics`,
  ) as {
    totalResponses: number;
    completionRate: number;
    averageDuration: number;
    questionStats: ResponseAnalytics['questionStats'];
  };

  return {
    surveyId,
    totalResponses: result.totalResponses || 0,
    completionRate: result.completionRate || 0,
    averageDuration: result.averageDuration || 0,
    questionStats: result.questionStats || [],
  };
}
