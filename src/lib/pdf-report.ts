// PDF Report Generation Service for Pitch Perfect
// Generates professional PDF reports for deck, script, and video analyses

import jsPDF from 'jspdf';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface DeckReportData {
  sessionName: string;
  userName: string;
  userEmail: string;
  completedAt: Date;
  // Content Scores
  problemClarityScore: number;
  solutionClarityScore: number;
  marketOpportunityScore: number;
  businessModelScore: number;
  teamCredibilityScore: number;
  tractionScore: number;
  financialsScore: number;
  askClarityScore: number;
  overallScore: number;
  // Visual Scores
  designConsistencyScore: number;
  readabilityScore: number;
  visualHierarchyScore: number;
  colorSchemeScore: number;
  typographyScore: number;
  // Feedback
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface ScriptReportData {
  sessionName: string;
  userName: string;
  userEmail: string;
  completedAt: Date;
  // 5-Element Scores
  hookScore: number;
  problemScore: number;
  solutionScore: number;
  credibilityScore: number;
  ctaScore: number;
  overallScore: number;
  // Metrics
  wordCount: number;
  estimatedDuration: number;
  // Feedback
  improvements: {
    hook: string[];
    problem: string[];
    solution: string[];
    credibility: string[];
    cta: string[];
  };
  rewrittenScript: string;
  alternativeHooks: string[];
}

export interface VideoReportData {
  sessionName: string;
  userName: string;
  userEmail: string;
  completedAt: Date;
  duration: number;
  // Delivery Scores
  paceScore: number;
  clarityScore: number;
  fillerWordScore: number;
  energyScore: number;
  confidenceScore: number;
  overallDeliveryScore: number;
  // Body Language Scores
  eyeContactScore: number;
  facialExpressionScore: number;
  gestureScore: number;
  postureScore: number;
  overallBodyLanguageScore: number;
  // Metrics
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWords: Record<string, number>;
  // Feedback
  deliveryFeedback: string;
  bodyLanguageFeedback: string;
  keyMoments: Array<{
    timestamp: string;
    description: string;
    type: 'positive' | 'improvement';
  }>;
  coachingDrills: Array<{
    title: string;
    description: string;
    targetArea: string;
  }>;
}

export interface FullPitchReportData extends DeckReportData, VideoReportData {
  // 6-Dimension Scores
  problemSolutionFit: number;
  marketOpportunity: number;
  businessModelViability: number;
  teamCredibility_full: number;
  tractionMilestones: number;
  deliveryPresence: number;
  investorReadinessLevel: 'NOT_READY' | 'NEEDS_WORK' | 'INVESTOR_READY' | 'HIGHLY_PREPARED';
  // Additional
  anticipatedQuestions: Array<{
    question: string;
    suggestedAnswer: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  investorConcerns: string[];
}

// ============================================
// COLORS & STYLING
// ============================================

const COLORS = {
  primary: '#334B79',
  secondary: '#4AAB9A',
  accent: '#ED3B65',
  dark: '#1a1a2e',
  muted: '#6b6b85',
  light: '#f7f8fc',
  white: '#ffffff',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getScoreColor(score: number): string {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.secondary;
  if (score >= 40) return COLORS.yellow;
  return COLORS.red;
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Work';
  return 'Needs Significant Work';
}

function getReadinessLabel(level: string): { label: string; color: string } {
  switch (level) {
    case 'HIGHLY_PREPARED':
      return { label: 'Highly Prepared', color: COLORS.green };
    case 'INVESTOR_READY':
      return { label: 'Investor Ready', color: COLORS.secondary };
    case 'NEEDS_WORK':
      return { label: 'Needs Work', color: COLORS.yellow };
    default:
      return { label: 'Not Ready', color: COLORS.red };
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// PDF BASE CLASS
// ============================================

class PDFReport {
  protected doc: jsPDF;
  protected pageWidth: number;
  protected pageHeight: number;
  protected margin: number = 20;
  protected currentY: number = 20;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  protected addHeader(sessionName: string, userName: string): void {
    // Logo / Brand
    this.doc.setFontSize(24);
    this.doc.setTextColor(COLORS.primary);
    this.doc.text('Pitch', this.margin, 20);
    this.doc.setTextColor(COLORS.secondary);
    this.doc.text('Perfect', this.margin + 22, 20);
    
    // Session name
    this.doc.setFontSize(12);
    this.doc.setTextColor(COLORS.muted);
    this.doc.text(sessionName, this.pageWidth - this.margin, 20, { align: 'right' });
    
    // User name
    this.doc.setFontSize(10);
    this.doc.text(`Prepared for: ${userName}`, this.pageWidth - this.margin, 26, { align: 'right' });
    
    // Divider
    this.doc.setDrawColor(COLORS.secondary);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, 32, this.pageWidth - this.margin, 32);
    
    this.currentY = 40;
  }

  protected addFooter(): void {
    const totalPages = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(COLORS.muted);
      this.doc.text(
        `Page ${i} of ${totalPages}`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );
      this.doc.text(
        'Generated by Pitch Perfect • pitchperfect.ai',
        this.pageWidth / 2,
        this.pageHeight - 5,
        { align: 'center' }
      );
    }
  }

  protected checkPageBreak(requiredSpace: number): void {
    if (this.currentY + requiredSpace > this.pageHeight - 25) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  protected addSection(title: string): void {
    this.checkPageBreak(20);
    this.doc.setFontSize(14);
    this.doc.setTextColor(COLORS.primary);
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 8;
    
    // Underline
    this.doc.setDrawColor(COLORS.secondary);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, this.currentY, this.margin + 40, this.currentY);
    this.currentY += 8;
  }

  protected addScoreCard(label: string, score: number, x: number, y: number, width: number = 35): void {
    const height = 25;
    const radius = 3;
    
    // Background
    this.doc.setFillColor(COLORS.light);
    this.doc.roundedRect(x, y, width, height, radius, radius, 'F');
    
    // Score bar
    const barWidth = (width - 6) * (score / 100);
    this.doc.setFillColor(getScoreColor(score));
    this.doc.roundedRect(x + 3, y + height - 8, barWidth, 4, 1, 1, 'F');
    
    // Score
    this.doc.setFontSize(16);
    this.doc.setTextColor(COLORS.dark);
    this.doc.text(`${score}`, x + width / 2, y + 10, { align: 'center' });
    
    // Label
    this.doc.setFontSize(6);
    this.doc.setTextColor(COLORS.muted);
    this.doc.text(label, x + width / 2, y + 17, { align: 'center' });
  }

  protected addBulletList(items: string[], indent: number = this.margin + 5): void {
    this.doc.setFontSize(10);
    this.doc.setTextColor(COLORS.dark);
    
    for (const item of items) {
      this.checkPageBreak(8);
      
      // Bullet
      this.doc.setFillColor(COLORS.secondary);
      this.doc.circle(indent, this.currentY + 2, 1, 'F');
      
      // Text (wrap if too long)
      const lines = this.doc.splitTextToSize(item, this.pageWidth - indent - this.margin - 5);
      this.doc.text(lines, indent + 5, this.currentY + 3);
      this.currentY += lines.length * 5 + 3;
    }
  }
}

// ============================================
// DECK REPORT
// ============================================

export class DeckReportPDF extends PDFReport {
  constructor(private data: DeckReportData) {
    super();
  }

  generate(): Buffer {
    this.addHeader(this.data.sessionName, this.data.userName);
    this.addOverallScore();
    this.addContentScores();
    this.addVisualScores();
    this.addFeedback();
    this.addRecommendations();
    this.addFooter();
    
    return Buffer.from(this.doc.output('arraybuffer'));
  }

  private addOverallScore(): void {
    this.checkPageBreak(60);
    
    // Large score circle
    const centerX = this.pageWidth / 2;
    const centerY = this.currentY + 25;
    const radius = 25;
    
    // Outer circle
    this.doc.setDrawColor(COLORS.secondary);
    this.doc.setLineWidth(3);
    this.doc.circle(centerX, centerY, radius);
    
    // Score
    this.doc.setFontSize(36);
    this.doc.setTextColor(getScoreColor(this.data.overallScore));
    this.doc.text(`${this.data.overallScore}`, centerX, centerY + 5, { align: 'center' });
    
    // Label
    this.doc.setFontSize(10);
    this.doc.setTextColor(COLORS.muted);
    this.doc.text(getScoreLabel(this.data.overallScore), centerX, centerY + 12, { align: 'center' });
    this.doc.text('Overall Score', centerX, centerY + 18, { align: 'center' });
    
    this.currentY = centerY + radius + 15;
  }

  private addContentScores(): void {
    this.addSection('Content Analysis');
    
    const scores = [
      { label: 'Problem Clarity', score: this.data.problemClarityScore },
      { label: 'Solution Clarity', score: this.data.solutionClarityScore },
      { label: 'Market Opp.', score: this.data.marketOpportunityScore },
      { label: 'Business Model', score: this.data.businessModelScore },
      { label: 'Team Credibility', score: this.data.teamCredibilityScore },
      { label: 'Traction', score: this.data.tractionScore },
      { label: 'Financials', score: this.data.financialsScore },
      { label: 'Ask Clarity', score: this.data.askClarityScore },
    ];
    
    const cols = 4;
    const cardWidth = 35;
    const gap = 10;
    const startX = (this.pageWidth - (cols * cardWidth + (cols - 1) * gap)) / 2;
    
    scores.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardWidth + gap);
      const y = this.currentY + row * 30;
      this.addScoreCard(item.label, item.score, x, y, cardWidth);
    });
    
    this.currentY += 70;
  }

  private addVisualScores(): void {
    this.addSection('Visual Design Audit');
    
    const scores = [
      { label: 'Design Consistency', score: this.data.designConsistencyScore },
      { label: 'Readability', score: this.data.readabilityScore },
      { label: 'Visual Hierarchy', score: this.data.visualHierarchyScore },
      { label: 'Color Scheme', score: this.data.colorSchemeScore },
      { label: 'Typography', score: this.data.typographyScore },
    ];
    
    const cols = 5;
    const cardWidth = 28;
    const gap = 8;
    const startX = (this.pageWidth - (cols * cardWidth + (cols - 1) * gap)) / 2;
    
    scores.forEach((item, i) => {
      const x = startX + i * (cardWidth + gap);
      this.addScoreCard(item.label, item.score, x, this.currentY, cardWidth);
    });
    
    this.currentY += 35;
  }

  private addFeedback(): void {
    this.addSection('Strengths');
    this.addBulletList(this.data.strengths);
    
    this.currentY += 5;
    this.addSection('Areas for Improvement');
    this.addBulletList(this.data.weaknesses);
  }

  private addRecommendations(): void {
    this.addSection('Top Recommendations');
    
    this.data.recommendations.forEach((rec, i) => {
      this.checkPageBreak(15);
      
      this.doc.setFontSize(10);
      this.doc.setTextColor(COLORS.primary);
      this.doc.text(`${i + 1}.`, this.margin, this.currentY);
      
      const lines = this.doc.splitTextToSize(rec, this.pageWidth - this.margin - 10);
      this.doc.setTextColor(COLORS.dark);
      this.doc.text(lines, this.margin + 8, this.currentY);
      this.currentY += lines.length * 5 + 5;
    });
  }
}

// ============================================
// SCRIPT REPORT
// ============================================

export class ScriptReportPDF extends PDFReport {
  constructor(private data: ScriptReportData) {
    super();
  }

  generate(): Buffer {
    this.addHeader(this.data.sessionName, this.data.userName);
    this.addOverallScore();
    this.addElementScores();
    this.addMetrics();
    this.addImprovements();
    this.addRewrittenScript();
    this.addAlternativeHooks();
    this.addFooter();
    
    return Buffer.from(this.doc.output('arraybuffer'));
  }

  private addOverallScore(): void {
    this.checkPageBreak(60);
    
    const centerX = this.pageWidth / 2;
    const centerY = this.currentY + 25;
    
    this.doc.setDrawColor(COLORS.secondary);
    this.doc.setLineWidth(3);
    this.doc.circle(centerX, centerY, 25);
    
    this.doc.setFontSize(36);
    this.doc.setTextColor(getScoreColor(this.data.overallScore));
    this.doc.text(`${this.data.overallScore}`, centerX, centerY + 5, { align: 'center' });
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(COLORS.muted);
    this.doc.text(getScoreLabel(this.data.overallScore), centerX, centerY + 12, { align: 'center' });
    this.doc.text('5-Element Score', centerX, centerY + 18, { align: 'center' });
    
    this.currentY = centerY + 40;
  }

  private addElementScores(): void {
    this.addSection('5-Element Framework Scores');
    
    const elements = [
      { label: 'Hook', score: this.data.hookScore },
      { label: 'Problem', score: this.data.problemScore },
      { label: 'Solution', score: this.data.solutionScore },
      { label: 'Credibility', score: this.data.credibilityScore },
      { label: 'Call to Action', score: this.data.ctaScore },
    ];
    
    elements.forEach((item, i) => {
      const x = this.margin + i * 34;
      this.addScoreCard(item.label, item.score, x, this.currentY, 30);
    });
    
    this.currentY += 35;
  }

  private addMetrics(): void {
    this.addSection('Script Metrics');
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(COLORS.dark);
    this.doc.text(`Word Count: ${this.data.wordCount}`, this.margin, this.currentY);
    this.doc.text(`Est. Duration: ${formatDuration(this.data.estimatedDuration)}`, this.margin + 60, this.currentY);
    this.currentY += 10;
  }

  private addImprovements(): void {
    const elements = ['hook', 'problem', 'solution', 'credibility', 'cta'] as const;
    const labels: Record<string, string> = {
      hook: 'Hook',
      problem: 'Problem',
      solution: 'Solution',
      credibility: 'Credibility',
      cta: 'Call to Action',
    };
    
    for (const element of elements) {
      this.currentY += 3;
      this.addSection(`${labels[element]} Improvements`);
      this.addBulletList(this.data.improvements[element]);
    }
  }

  private addRewrittenScript(): void {
    this.addSection('AI-Suggested Rewrite');
    
    this.doc.setFontSize(9);
    this.doc.setTextColor(COLORS.dark);
    
    const lines = this.doc.splitTextToSize(this.data.rewrittenScript, this.pageWidth - 2 * this.margin);
    
    // Background
    this.doc.setFillColor(COLORS.light);
    this.doc.roundedRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, Math.min(lines.length * 4 + 10, 60), 2, 2, 'F');
    
    this.doc.text(lines.slice(0, 15), this.margin + 5, this.currentY + 6);
    if (lines.length > 15) {
      this.doc.text('...', this.margin + 5, this.currentY + 6 + 15 * 4);
    }
    
    this.currentY += Math.min(lines.length * 4 + 15, 70);
  }

  private addAlternativeHooks(): void {
    this.addSection('Alternative Opening Hooks');
    
    this.data.alternativeHooks.forEach((hook, i) => {
      this.checkPageBreak(12);
      
      this.doc.setFontSize(10);
      this.doc.setTextColor(COLORS.secondary);
      this.doc.text(`${i + 1}.`, this.margin, this.currentY);
      
      const lines = this.doc.splitTextToSize(`"${hook}"`, this.pageWidth - this.margin - 10);
      this.doc.setTextColor(COLORS.dark);
      this.doc.text(lines, this.margin + 8, this.currentY);
      this.currentY += lines.length * 5 + 5;
    });
  }
}

// ============================================
// VIDEO REPORT
// ============================================

export class VideoReportPDF extends PDFReport {
  constructor(private data: VideoReportData) {
    super();
  }

  generate(): Buffer {
    this.addHeader(this.data.sessionName, this.data.userName);
    this.addOverallScores();
    this.addDeliveryScores();
    this.addBodyLanguageScores();
    this.addMetrics();
    this.addKeyMoments();
    this.addCoachingDrills();
    this.addFooter();
    
    return Buffer.from(this.doc.output('arraybuffer'));
  }

  private addOverallScores(): void {
    this.checkPageBreak(50);
    
    // Delivery score
    this.addScoreCard('Delivery', this.data.overallDeliveryScore, this.margin + 20, this.currentY, 50);
    
    // Body language score
    this.addScoreCard('Body Language', this.data.overallBodyLanguageScore, this.pageWidth - this.margin - 70, this.currentY, 50);
    
    this.currentY += 40;
  }

  private addDeliveryScores(): void {
    this.addSection('Delivery Scores');
    
    const scores = [
      { label: 'Pace', score: this.data.paceScore },
      { label: 'Clarity', score: this.data.clarityScore },
      { label: 'Filler Words', score: this.data.fillerWordScore },
      { label: 'Energy', score: this.data.energyScore },
      { label: 'Confidence', score: this.data.confidenceScore },
    ];
    
    scores.forEach((item, i) => {
      const x = this.margin + i * 34;
      this.addScoreCard(item.label, item.score, x, this.currentY, 30);
    });
    
    this.currentY += 35;
  }

  private addBodyLanguageScores(): void {
    this.addSection('Body Language Scores');
    
    const scores = [
      { label: 'Eye Contact', score: this.data.eyeContactScore },
      { label: 'Expressions', score: this.data.facialExpressionScore },
      { label: 'Gestures', score: this.data.gestureScore },
      { label: 'Posture', score: this.data.postureScore },
    ];
    
    scores.forEach((item, i) => {
      const x = this.margin + i * 42;
      this.addScoreCard(item.label, item.score, x, this.currentY, 38);
    });
    
    this.currentY += 35;
  }

  private addMetrics(): void {
    this.addSection('Session Metrics');
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(COLORS.dark);
    this.doc.text(`Duration: ${formatDuration(this.data.duration)}`, this.margin, this.currentY);
    this.doc.text(`Words per Minute: ${this.data.wordsPerMinute}`, this.margin + 50, this.currentY);
    this.doc.text(`Filler Words: ${this.data.fillerWordCount}`, this.margin + 110, this.currentY);
    this.currentY += 8;
    
    // Filler word breakdown
    if (Object.keys(this.data.fillerWords).length > 0) {
      const fillerText = Object.entries(this.data.fillerWords)
        .map(([word, count]) => `"${word}": ${count}`)
        .join(', ');
      this.doc.setFontSize(8);
      this.doc.setTextColor(COLORS.muted);
      this.doc.text(`Breakdown: ${fillerText}`, this.margin, this.currentY);
      this.currentY += 5;
    }
    this.currentY += 5;
  }

  private addKeyMoments(): void {
    this.addSection('Key Moments');
    
    this.data.keyMoments.slice(0, 6).forEach((moment) => {
      this.checkPageBreak(10);
      
      const color = moment.type === 'positive' ? COLORS.green : COLORS.accent;
      
      this.doc.setFontSize(9);
      this.doc.setTextColor(color);
      this.doc.text(`[${moment.timestamp}]`, this.margin, this.currentY);
      
      this.doc.setTextColor(COLORS.dark);
      const lines = this.doc.splitTextToSize(moment.description, this.pageWidth - this.margin - 30);
      this.doc.text(lines, this.margin + 20, this.currentY);
      this.currentY += lines.length * 4 + 3;
    });
  }

  private addCoachingDrills(): void {
    this.addSection('Personalized Coaching Drills');
    
    this.data.coachingDrills.forEach((drill, i) => {
      this.checkPageBreak(20);
      
      // Drill card
      this.doc.setFillColor(COLORS.light);
      this.doc.roundedRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 18, 2, 2, 'F');
      
      this.doc.setFontSize(10);
      this.doc.setTextColor(COLORS.primary);
      this.doc.text(`${i + 1}. ${drill.title}`, this.margin + 5, this.currentY + 6);
      
      this.doc.setFontSize(8);
      this.doc.setTextColor(COLORS.muted);
      this.doc.text(`Target: ${drill.targetArea}`, this.pageWidth - this.margin - 5, this.currentY + 6, { align: 'right' });
      
      const descLines = this.doc.splitTextToSize(drill.description, this.pageWidth - 2 * this.margin - 10);
      this.doc.setTextColor(COLORS.dark);
      this.doc.text(descLines, this.margin + 5, this.currentY + 11);
      
      this.currentY += 22;
    });
  }
}

// ============================================
// FULL PITCH REPORT
// ============================================

export class FullPitchReportPDF extends PDFReport {
  constructor(private data: FullPitchReportData) {
    super();
  }

  generate(): Buffer {
    this.addHeader(this.data.sessionName, this.data.userName);
    this.addInvestorReadiness();
    this.add6DimensionScores();
    this.addContentScores();
    this.addDeliveryScores();
    this.addAnticipatedQuestions();
    this.addConcerns();
    this.addRecommendations();
    this.addFooter();
    
    return Buffer.from(this.doc.output('arraybuffer'));
  }

  private addInvestorReadiness(): void {
    this.checkPageBreak(50);
    
    const { label, color } = getReadinessLabel(this.data.investorReadinessLevel);
    
    const centerX = this.pageWidth / 2;
    
    // Badge
    this.doc.setFillColor(color);
    this.doc.roundedRect(centerX - 35, this.currentY, 70, 20, 3, 3, 'F');
    
    this.doc.setFontSize(12);
    this.doc.setTextColor(COLORS.white);
    this.doc.text(label, centerX, this.currentY + 13, { align: 'center' });
    
    this.currentY += 30;
    
    // Overall score
    this.doc.setFontSize(36);
    this.doc.setTextColor(getScoreColor(this.data.overallReadinessScore));
    this.doc.text(`${this.data.overallReadinessScore}`, centerX, this.currentY + 15, { align: 'center' });
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(COLORS.muted);
    this.doc.text('Investor Readiness Score', centerX, this.currentY + 22, { align: 'center' });
    
    this.currentY += 35;
  }

  private add6DimensionScores(): void {
    this.addSection('6-Dimension Investor Readiness');
    
    const dimensions = [
      { label: 'Problem-Solution', score: this.data.problemSolutionFit },
      { label: 'Market Opp.', score: this.data.marketOpportunity },
      { label: 'Business Model', score: this.data.businessModelViability },
      { label: 'Team Cred.', score: this.data.teamCredibility_full || this.data.teamCredibilityScore },
      { label: 'Traction', score: this.data.tractionMilestones },
      { label: 'Delivery', score: this.data.deliveryPresence },
    ];
    
    // Two rows of 3
    dimensions.forEach((item, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = this.margin + col * 60;
      const y = this.currentY + row * 35;
      this.addScoreCard(item.label, item.score, x, y, 55);
    });
    
    this.currentY += 80;
  }

  private addContentScores(): void {
    this.addSection('Content Scores');
    
    const scores = [
      { label: 'Problem', score: this.data.problemClarityScore },
      { label: 'Solution', score: this.data.solutionClarityScore },
      { label: 'Market', score: this.data.marketOpportunityScore },
      { label: 'Business', score: this.data.businessModelScore },
      { label: 'Team', score: this.data.teamCredibilityScore },
      { label: 'Traction', score: this.data.tractionScore },
      { label: 'Financials', score: this.data.financialsScore },
      { label: 'Ask', score: this.data.askClarityScore },
    ];
    
    scores.forEach((item, i) => {
      const x = this.margin + i * 21;
      this.addScoreCard(item.label, item.score, x, this.currentY, 18);
    });
    
    this.currentY += 35;
  }

  private addDeliveryScores(): void {
    this.addSection('Delivery Scores');
    
    const scores = [
      { label: 'Pace', score: this.data.paceScore },
      { label: 'Clarity', score: this.data.clarityScore },
      { label: 'Confidence', score: this.data.confidenceScore },
      { label: 'Energy', score: this.data.energyScore },
      { label: 'Eye Contact', score: this.data.eyeContactScore },
    ];
    
    scores.forEach((item, i) => {
      const x = this.margin + i * 34;
      this.addScoreCard(item.label, item.score, x, this.currentY, 30);
    });
    
    this.currentY += 35;
  }

  private addAnticipatedQuestions(): void {
    this.addSection('Anticipated Investor Questions');
    
    this.data.anticipatedQuestions.slice(0, 5).forEach((q, i) => {
      this.checkPageBreak(25);
      
      // Question
      this.doc.setFontSize(10);
      this.doc.setTextColor(COLORS.primary);
      const qLines = this.doc.splitTextToSize(`Q${i + 1}: ${q.question}`, this.pageWidth - 2 * this.margin);
      this.doc.text(qLines, this.margin, this.currentY);
      this.currentY += qLines.length * 4 + 2;
      
      // Answer
      this.doc.setFontSize(9);
      this.doc.setTextColor(COLORS.dark);
      const aLines = this.doc.splitTextToSize(`A: ${q.suggestedAnswer}`, this.pageWidth - 2 * this.margin - 5);
      this.doc.text(aLines, this.margin + 5, this.currentY);
      this.currentY += aLines.length * 4 + 6;
      
      // Difficulty badge
      const diffColor = q.difficulty === 'easy' ? COLORS.green : q.difficulty === 'medium' ? COLORS.yellow : COLORS.red;
      this.doc.setFillColor(diffColor);
      this.doc.roundedRect(this.pageWidth - this.margin - 20, this.currentY - 4, 18, 6, 1, 1, 'F');
      this.doc.setFontSize(5);
      this.doc.setTextColor(COLORS.white);
      this.doc.text(q.difficulty.toUpperCase(), this.pageWidth - this.margin - 11, this.currentY, { align: 'center' });
      this.currentY += 5;
    });
  }

  private addConcerns(): void {
    this.addSection('Potential Investor Concerns');
    this.addBulletList(this.data.investorConcerns);
  }

  private addRecommendations(): void {
    this.addSection('Recommended Actions');
    this.addBulletList(this.data.recommendations);
  }
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export function generateDeckReport(data: DeckReportData): Buffer {
  const report = new DeckReportPDF(data);
  return report.generate();
}

export function generateScriptReport(data: ScriptReportData): Buffer {
  const report = new ScriptReportPDF(data);
  return report.generate();
}

export function generateVideoReport(data: VideoReportData): Buffer {
  const report = new VideoReportPDF(data);
  return report.generate();
}

export function generateFullPitchReport(data: FullPitchReportData): Buffer {
  const report = new FullPitchReportPDF(data);
  return report.generate();
}
