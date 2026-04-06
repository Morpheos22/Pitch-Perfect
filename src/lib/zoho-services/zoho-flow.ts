// Zoho Flow Integration Service for Pitch Perfect × Automagikal
// Handles workflow automation — founder journeys, payment triggers, CRM sync, email sequences
// Uses API key authentication (simpler than OAuth)

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Workflow execution status */
export type ExecutionStatus = 'in_progress' | 'completed' | 'failed' | 'cancelled';

/** A workflow definition returned by Zoho Flow */
export interface Workflow {
  workflowId: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'draft';
  triggerType: string;
  createdAt: string;
  updatedAt: string;
}

/** Workflow execution result */
export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  output?: Record<string, unknown>;
  error?: string;
}

/** Webhook trigger configuration */
export interface WebhookTrigger {
  triggerId: string;
  event: string;
  targetUrl: string;
  createdAt: string;
}

// ============================================
// ZOHO FLOW API CONFIGURATION
// ============================================

const ZOHO_FLOW_CONFIG = {
  apiDomain: process.env.ZOHO_FLOW_API_DOMAIN || 'https://flow.zoho.com',
  apiKey: process.env.ZOHO_FLOW_API_KEY,
};

// ============================================
// API HELPER
// ============================================

async function flowRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object,
): Promise<unknown> {
  if (!ZOHO_FLOW_CONFIG.apiKey) {
    throw new Error('ZOHO_FLOW_API_KEY environment variable is required');
  }

  const headers: Record<string, string> = {
    'Authorization': `Zoho-oauthtoken ${ZOHO_FLOW_CONFIG.apiKey}`,
  };
  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${ZOHO_FLOW_CONFIG.apiDomain}/api/v1${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho Flow API error (${method} ${endpoint}): ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ============================================
// WORKFLOW MANAGEMENT
// ============================================

/**
 * Trigger a workflow execution with the given payload.
 * Use this to initiate founder onboarding journeys, payment-processing flows, etc.
 * @param workflowId - The Zoho Flow workflow identifier
 * @param payload - Data to pass into the workflow input fields
 * @returns Execution record with ID for status tracking
 */
export async function triggerWorkflow(
  workflowId: string,
  payload: Record<string, unknown>,
): Promise<WorkflowExecution> {
  const result = await flowRequest(`/workflows/${workflowId}/execute`, 'POST', {
    input_data: payload,
  }) as { execution: WorkflowExecution };

  return result.execution;
}

/**
 * Check the status and output of a previously triggered workflow execution.
 * @param executionId - The execution ID returned from triggerWorkflow
 */
export async function getWorkflowStatus(executionId: string): Promise<WorkflowExecution> {
  const result = await flowRequest(`/executions/${executionId}`) as {
    execution: WorkflowExecution;
  };
  return result.execution;
}

/**
 * List all workflows available in the Zoho Flow account.
 * Useful for discovering available automation IDs.
 */
export async function listWorkflows(): Promise<Workflow[]> {
  const result = await flowRequest('/workflows') as {
    workflows: Workflow[];
  };
  return result.workflows || [];
}

// ============================================
// WEBHOOK MANAGEMENT
// ============================================

/**
 * Create a webhook trigger that fires on a specific event.
 * External systems can POST to this URL to trigger downstream Zoho Flow actions.
 * @param event - The event name that this webhook listens for
 * @param targetUrl - The URL that Zoho Flow will forward events to
 */
export async function createWebhookTrigger(
  event: string,
  targetUrl: string,
): Promise<WebhookTrigger> {
  const result = await flowRequest('/webhooks', 'POST', {
    event,
    target_url: targetUrl,
  }) as { webhook: WebhookTrigger };

  return result.webhook;
}
