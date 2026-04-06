// Zoho Services — Barrel Export for Pitch Perfect × Automagikal
// All Zoho service modules are self-contained with their own OAuth token caching.
// Import individual modules or re-export everything from this single entry point.

export {
  createPlan,
  listPlans,
  createCustomer,
  getCustomer,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  getSubscription,
  generateInvoice,
} from './zoho-billing';

export type {
  BillingInterval,
  SubscriptionStatus,
  PlanConfig,
  Subscription,
  BillingCustomer,
  Invoice,
} from './zoho-billing';

export {
  uploadFile,
  downloadFile,
  createFolder,
  listFiles,
  getFileInfo,
  deleteFile,
  shareFile,
  getPublicLink,
} from './zoho-workdrive';

export type {
  ShareRole,
  WorkDriveFile,
  WorkDriveFolder,
  UploadResult,
  ShareResult,
  PublicLink,
} from './zoho-workdrive';

export {
  triggerWorkflow,
  getWorkflowStatus,
  listWorkflows,
  createWebhookTrigger,
} from './zoho-flow';

export type {
  ExecutionStatus,
  Workflow,
  WorkflowExecution,
  WebhookTrigger,
} from './zoho-flow';

export {
  createDocument,
  mergeTemplate,
  exportToPdf,
  shareDocument,
} from './zoho-writer';

export type {
  WriterShareRole,
  WriterDocument,
  MergeData,
  PdfExportOptions,
  WriterShareResult,
} from './zoho-writer';

export {
  createTicket,
  updateTicket,
  getTicket,
  listTickets,
  addComment,
} from './zoho-desk';

export type {
  TicketPriority,
  TicketStatus,
  TicketCategory,
  DeskTicket,
  TicketComment,
} from './zoho-desk';

export {
  queryView,
  getColumnMetadata,
  exportData,
  importData,
} from './zoho-analytics';

export type {
  ExportFormat,
  ColumnMetadata,
  QueryResult,
  ImportRow,
  ImportResult,
} from './zoho-analytics';

export {
  createSurvey,
  getSurveyResults,
  sendSurvey,
  getResponseAnalytics,
} from './zoho-surveys';

export type {
  QuestionType,
  SurveyQuestion,
  Survey,
  SurveyResponse,
  ResponseAnalytics,
} from './zoho-surveys';

export {
  createContactList,
  addContactsToList,
  createCampaign,
  sendCampaign,
  getCampaignStats,
} from './zoho-campaigns';

export type {
  CampaignContact,
  CampaignStatus,
  Campaign,
  CampaignStats,
  ContactList,
} from './zoho-campaigns';

export {
  createDocument as createSignDocument,
  sendDocument as sendSignDocument,
  getDocumentStatus as getSignDocumentStatus,
  downloadSignedDocument,
  createTemplate as createSignTemplate,
} from './zoho-sign';

export type {
  SignStatus,
  SignField,
  SignTemplate,
  SignDocument,
  CreatedDocument,
} from './zoho-sign';
