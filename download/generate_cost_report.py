#!/usr/bin/env python3
"""
PitchCoach AI - Cost Analysis & Infrastructure Report
Prepared for Automagikal - CONFIDENTIAL
"""

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import os
from datetime import datetime

# Brand Colors
BRAND_BLUE = colors.HexColor('#334B79')
BRAND_GREEN = colors.HexColor('#4AAB9A')
BRAND_RED = colors.HexColor('#ED3B65')
BRAND_WHITE = colors.HexColor('#FFFFFF')
DARK_GRAY = colors.HexColor('#333333')
LIGHT_GRAY = colors.HexColor('#F5F5F5')

# Register fonts
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('Calibri', '/usr/share/fonts/truetype/english/calibri-regular.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')
registerFontFamily('Calibri', normal='Calibri', bold='Calibri')

def create_pdf():
    filename = "/home/z/my-project/download/PitchCoach_AI_Cost_Analysis.pdf"
    
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
        title="PitchCoach AI - Cost Analysis & Infrastructure Report",
        author="Z.ai",
        creator="Z.ai",
        subject="Confidential cost analysis for investor review"
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles with brand colors
    cover_title = ParagraphStyle(
        name='CoverTitle',
        fontName='Times New Roman',
        fontSize=32,
        leading=40,
        alignment=TA_CENTER,
        textColor=BRAND_BLUE,
        spaceAfter=20
    )
    
    cover_subtitle = ParagraphStyle(
        name='CoverSubtitle',
        fontName='Times New Roman',
        fontSize=16,
        leading=24,
        alignment=TA_CENTER,
        textColor=DARK_GRAY,
        spaceAfter=12
    )
    
    section_header = ParagraphStyle(
        name='SectionHeader',
        fontName='Times New Roman',
        fontSize=18,
        leading=24,
        alignment=TA_LEFT,
        textColor=BRAND_BLUE,
        spaceBefore=18,
        spaceAfter=12
    )
    
    subsection_header = ParagraphStyle(
        name='SubsectionHeader',
        fontName='Times New Roman',
        fontSize=14,
        leading=18,
        alignment=TA_LEFT,
        textColor=BRAND_GREEN,
        spaceBefore=12,
        spaceAfter=8
    )
    
    body_text = ParagraphStyle(
        name='BodyText',
        fontName='Times New Roman',
        fontSize=11,
        leading=16,
        alignment=TA_JUSTIFY,
        textColor=DARK_GRAY,
        spaceAfter=8
    )
    
    bullet_style = ParagraphStyle(
        name='BulletStyle',
        fontName='Times New Roman',
        fontSize=11,
        leading=16,
        alignment=TA_LEFT,
        textColor=DARK_GRAY,
        leftIndent=20,
        spaceAfter=4
    )
    
    highlight_style = ParagraphStyle(
        name='HighlightStyle',
        fontName='Times New Roman',
        fontSize=11,
        leading=16,
        alignment=TA_LEFT,
        textColor=BRAND_BLUE,
        spaceAfter=4
    )
    
    confidential_style = ParagraphStyle(
        name='Confidential',
        fontName='Times New Roman',
        fontSize=12,
        leading=16,
        alignment=TA_CENTER,
        textColor=BRAND_RED,
        spaceAfter=12
    )
    
    # Table styles
    header_style = ParagraphStyle(
        name='TableHeader',
        fontName='Times New Roman',
        fontSize=10,
        textColor=BRAND_WHITE,
        alignment=TA_CENTER
    )
    
    cell_style = ParagraphStyle(
        name='TableCell',
        fontName='Times New Roman',
        fontSize=10,
        textColor=DARK_GRAY,
        alignment=TA_LEFT
    )
    
    cell_center = ParagraphStyle(
        name='TableCellCenter',
        fontName='Times New Roman',
        fontSize=10,
        textColor=DARK_GRAY,
        alignment=TA_CENTER
    )
    
    story = []
    
    # ========== COVER PAGE ==========
    story.append(Spacer(1, 100))
    story.append(Paragraph("PitchCoach AI", cover_title))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Cost Analysis & Infrastructure Report", cover_subtitle))
    story.append(Spacer(1, 30))
    story.append(Paragraph("Prepared for Automagikal", cover_subtitle))
    story.append(Spacer(1, 20))
    story.append(Paragraph("CONFIDENTIAL", confidential_style))
    story.append(Spacer(1, 60))
    story.append(Paragraph(f"Date: {datetime.now().strftime('%B %d, %Y')}", cover_subtitle))
    story.append(Paragraph("Version 1.0", cover_subtitle))
    story.append(PageBreak())
    
    # ========== EXECUTIVE SUMMARY ==========
    story.append(Paragraph("<b>Executive Summary</b>", section_header))
    
    exec_summary = """PitchCoach AI is an AI-powered pitch coaching platform designed to help founders and entrepreneurs improve their investor pitches through four comprehensive coaching modules. This document provides a detailed cost analysis for infrastructure, AI services, and operational expenses at scale, with projections for 1,000 active users."""
    story.append(Paragraph(exec_summary, body_text))
    story.append(Spacer(1, 8))
    
    key_findings = """<b>Key Findings:</b> The platform is designed with cost efficiency as a core principle. Using a combination of free tiers during development, pay-as-you-go AI services, and serverless infrastructure, the estimated monthly operational cost for 1,000 active users ranges from $400 to $800, with per-session AI costs averaging $0.15 to $0.70 depending on the coaching module utilized."""
    story.append(Paragraph(key_findings, body_text))
    story.append(Spacer(1, 12))
    
    # Key metrics highlight box
    metrics_data = [
        [Paragraph('<b>Metric</b>', header_style), Paragraph('<b>MVP Stage</b>', header_style), Paragraph('<b>1,000 Users</b>', header_style)],
        [Paragraph('Monthly Infrastructure', cell_style), Paragraph('$0 - $50', cell_center), Paragraph('$100 - $200', cell_center)],
        [Paragraph('Monthly AI Costs', cell_style), Paragraph('$10 - $20', cell_center), Paragraph('$300 - $600', cell_center)],
        [Paragraph('Total Monthly Cost', cell_style), Paragraph('$10 - $70', cell_center), Paragraph('$400 - $800', cell_center)],
        [Paragraph('Cost Per Active User', cell_style), Paragraph('N/A', cell_center), Paragraph('$0.40 - $0.80', cell_center)],
    ]
    
    metrics_table = Table(metrics_data, colWidths=[2.5*inch, 1.8*inch, 1.8*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('BACKGROUND', (0, 4), (-1, 4), LIGHT_GRAY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(metrics_table)
    story.append(Spacer(1, 18))
    
    # ========== TECHNOLOGY STACK OVERVIEW ==========
    story.append(Paragraph("<b>Technology Stack Overview</b>", section_header))
    
    stack_intro = """PitchCoach AI is built on a modern, scalable technology stack optimized for cost efficiency and developer productivity. The architecture leverages serverless computing, managed databases, and specialized AI services to minimize operational overhead while maximizing performance."""
    story.append(Paragraph(stack_intro, body_text))
    story.append(Spacer(1, 12))
    
    # Tech stack table
    stack_data = [
        [Paragraph('<b>Component</b>', header_style), Paragraph('<b>Service</b>', header_style), Paragraph('<b>Purpose</b>', header_style)],
        [Paragraph('Frontend', cell_style), Paragraph('Next.js 16 + React 19', cell_style), Paragraph('Server-side rendered UI with App Router', cell_style)],
        [Paragraph('Styling', cell_style), Paragraph('Tailwind CSS + shadcn/ui', cell_style), Paragraph('Responsive design with component library', cell_style)],
        [Paragraph('Database', cell_style), Paragraph('Supabase (PostgreSQL)', cell_style), Paragraph('Primary data storage with RLS security', cell_style)],
        [Paragraph('Authentication', cell_style), Paragraph('Clerk', cell_style), Paragraph('OAuth + email authentication', cell_style)],
        [Paragraph('File Storage', cell_style), Paragraph('Cloudflare R2', cell_style), Paragraph('PDF/PPTX deck uploads', cell_style)],
        [Paragraph('Video Processing', cell_style), Paragraph('Cloudflare Stream', cell_style), Paragraph('Pitch video hosting and processing', cell_style)],
        [Paragraph('AI - Text', cell_style), Paragraph('Anthropic Claude Sonnet 4', cell_style), Paragraph('Document and script analysis', cell_style)],
        [Paragraph('AI - Video', cell_style), Paragraph('Google Gemini', cell_style), Paragraph('Video analysis and transcription', cell_style)],
        [Paragraph('Billing', cell_style), Paragraph('Stripe', cell_style), Paragraph('Subscriptions and one-time purchases', cell_style)],
        [Paragraph('Hosting', cell_style), Paragraph('Vercel', cell_style), Paragraph('Edge deployment and CDN', cell_style)],
    ]
    
    stack_table = Table(stack_data, colWidths=[1.3*inch, 2*inch, 2.8*inch])
    stack_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('BACKGROUND', (0, 4), (-1, 4), LIGHT_GRAY),
        ('BACKGROUND', (0, 5), (-1, 5), BRAND_WHITE),
        ('BACKGROUND', (0, 6), (-1, 6), LIGHT_GRAY),
        ('BACKGROUND', (0, 7), (-1, 7), BRAND_WHITE),
        ('BACKGROUND', (0, 8), (-1, 8), LIGHT_GRAY),
        ('BACKGROUND', (0, 9), (-1, 9), BRAND_WHITE),
        ('BACKGROUND', (0, 10), (-1, 10), LIGHT_GRAY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(stack_table)
    story.append(PageBreak())
    
    # ========== COACHING MODULES ==========
    story.append(Paragraph("<b>Coaching Modules & AI Costs</b>", section_header))
    
    modules_intro = """PitchCoach AI offers four distinct coaching modules, each leveraging different AI capabilities and incurring varying computational costs. Understanding these per-session costs is critical for pricing strategy and margin analysis."""
    story.append(Paragraph(modules_intro, body_text))
    story.append(Spacer(1, 12))
    
    # E1: Deck Analyser
    story.append(Paragraph("<b>E1: Pitch Deck Analyser</b>", subsection_header))
    e1_desc = """The Pitch Deck Analyser accepts PDF or PPTX files and provides comprehensive content scoring across eight dimensions, plus a visual audit of design quality. The module uses Claude Sonnet 4 for document parsing and analysis. Typical document processing requires approximately 5,000 input tokens and 2,000 output tokens per session, resulting in a per-session cost of approximately $0.045. This module has the lowest AI cost due to efficient text processing."""
    story.append(Paragraph(e1_desc, body_text))
    
    e1_scores = """<b>Scoring Dimensions:</b> Problem Clarity, Solution Clarity, Market Opportunity, Business Model, Team Credibility, Traction, Financials, Ask Clarity. <b>Visual Audit:</b> Design Consistency, Readability, Visual Hierarchy, Color Scheme, Typography."""
    story.append(Paragraph(e1_scores, bullet_style))
    story.append(Spacer(1, 10))
    
    # E2: Script Coach
    story.append(Paragraph("<b>E2: Elevator Pitch Script Coach</b>", subsection_header))
    e2_desc = """The Script Coach analyzes elevator pitch scripts for the five essential elements of a compelling pitch: Hook, Problem, Solution, Credibility, and Call-to-Action. Input can be direct text, PDF, or DOCX upload. With approximately 2,000 input tokens and 1,000 output tokens per analysis, the per-session cost averages $0.021. The module also provides AI-rewritten versions and alternative opening hooks."""
    story.append(Paragraph(e2_desc, body_text))
    
    e2_features = """<b>Features:</b> 5-element scoring, tone analysis, estimated duration, word count, AI-generated rewrites, alternative hooks."""
    story.append(Paragraph(e2_features, bullet_style))
    story.append(Spacer(1, 10))
    
    # E3: Live Pitch
    story.append(Paragraph("<b>E3: Live Elevator Pitch Coach</b>", subsection_header))
    e3_desc = """The Live Pitch module accepts video recordings up to 3 minutes and analyzes both delivery (pace, clarity, filler words, energy, confidence) and body language (eye contact, facial expressions, gestures, posture). Video processing uses Gemini 2.5 Flash for cost efficiency on short-form content. Per-session costs range from $0.05 to $0.10 depending on video duration and transcript length."""
    story.append(Paragraph(e3_desc, body_text))
    
    e3_features = """<b>Features:</b> Delivery scoring, body language analysis, transcript generation, key moment identification, personalized coaching drills."""
    story.append(Paragraph(e3_features, bullet_style))
    story.append(Spacer(1, 10))
    
    # E4: Full Session
    story.append(Paragraph("<b>E4: Full Pitch Session</b>", subsection_header))
    e4_desc = """The most comprehensive module combines deck analysis with video processing for sessions up to 30 minutes. This module provides 6-dimension investor readiness scoring, anticipated Q&A questions, and prioritized recommendations. Due to the extended video length, this module uses Gemini 1.5 Pro for its larger context window, resulting in higher per-session costs ranging from $0.50 to $1.00."""
    story.append(Paragraph(e4_desc, body_text))
    
    e4_features = """<b>Features:</b> 6-dimension scoring (Problem-Solution Fit, Market Opportunity, Business Model Viability, Team Credibility, Traction/Milestones, Delivery/Presence), investor readiness level assessment, anticipated questions with suggested answers."""
    story.append(Paragraph(e4_features, bullet_style))
    story.append(Spacer(1, 12))
    
    # AI Cost Summary Table
    story.append(Paragraph("<b>Per-Session AI Cost Summary</b>", subsection_header))
    
    ai_cost_data = [
        [Paragraph('<b>Module</b>', header_style), Paragraph('<b>AI Service</b>', header_style), Paragraph('<b>Tokens (Avg)</b>', header_style), Paragraph('<b>Cost/Session</b>', header_style)],
        [Paragraph('E1: Deck Analyser', cell_style), Paragraph('Claude Sonnet 4', cell_style), Paragraph('7,000', cell_center), Paragraph('$0.05', cell_center)],
        [Paragraph('E2: Script Coach', cell_style), Paragraph('Claude Sonnet 4', cell_style), Paragraph('3,000', cell_center), Paragraph('$0.02', cell_center)],
        [Paragraph('E3: Live Pitch', cell_style), Paragraph('Gemini 2.5 Flash', cell_style), Paragraph('Video + 5,000', cell_center), Paragraph('$0.08', cell_center)],
        [Paragraph('E4: Full Session', cell_style), Paragraph('Claude + Gemini Pro', cell_style), Paragraph('Video + 20,000', cell_center), Paragraph('$0.62', cell_center)],
    ]
    
    ai_table = Table(ai_cost_data, colWidths=[1.8*inch, 1.5*inch, 1.4*inch, 1.4*inch])
    ai_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('BACKGROUND', (0, 4), (-1, 4), LIGHT_GRAY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(ai_table)
    story.append(PageBreak())
    
    # ========== INFRASTRUCTURE COSTS ==========
    story.append(Paragraph("<b>Infrastructure Cost Analysis</b>", section_header))
    
    infra_intro = """This section details the cost structure for each infrastructure component, comparing MVP-stage pricing with projected costs at 1,000 active users. All pricing reflects current provider rates as of March 2026."""
    story.append(Paragraph(infra_intro, body_text))
    story.append(Spacer(1, 12))
    
    # Database
    story.append(Paragraph("<b>Database: Supabase (PostgreSQL)</b>", subsection_header))
    db_desc = """Supabase provides a managed PostgreSQL database with built-in authentication, real-time subscriptions, and storage. The platform offers generous free tiers ideal for development and early-stage testing, with predictable scaling costs for production workloads."""
    story.append(Paragraph(db_desc, body_text))
    
    db_data = [
        [Paragraph('<b>Tier</b>', header_style), Paragraph('<b>Price/Month</b>', header_style), Paragraph('<b>Storage</b>', header_style), Paragraph('<b>Bandwidth</b>', header_style), Paragraph('<b>Best For</b>', header_style)],
        [Paragraph('Free', cell_style), Paragraph('$0', cell_center), Paragraph('500 MB', cell_center), Paragraph('5 GB', cell_center), Paragraph('MVP / Testing', cell_style)],
        [Paragraph('Pro', cell_style), Paragraph('$25', cell_center), Paragraph('8 GB', cell_center), Paragraph('250 GB', cell_center), Paragraph('Production', cell_style)],
        [Paragraph('Team', cell_style), Paragraph('$599', cell_center), Paragraph('8 GB+', cell_center), Paragraph('Custom', cell_center), Paragraph('Enterprise', cell_style)],
    ]
    
    db_table = Table(db_data, colWidths=[1*inch, 1.2*inch, 1*inch, 1.2*inch, 1.7*inch])
    db_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(db_table)
    
    db_rec = """<b>Recommendation:</b> Begin with the Free tier during development. Upgrade to Pro ($25/month) when approaching storage limits or requiring production-grade support. At 1,000 users, the Pro tier provides ample headroom."""
    story.append(Paragraph(db_rec, highlight_style))
    story.append(Spacer(1, 12))
    
    # Authentication
    story.append(Paragraph("<b>Authentication: Clerk</b>", subsection_header))
    auth_desc = """Clerk provides modern authentication with OAuth providers (Google, LinkedIn), email/password, and multi-factor authentication. The free tier supports up to 10,000 monthly active users, making it ideal for startups and growing applications."""
    story.append(Paragraph(auth_desc, body_text))
    
    auth_data = [
        [Paragraph('<b>Tier</b>', header_style), Paragraph('<b>Price/Month</b>', header_style), Paragraph('<b>MAUs</b>', header_style), Paragraph('<b>Features</b>', header_style)],
        [Paragraph('Free', cell_style), Paragraph('$0', cell_center), Paragraph('10,000', cell_center), Paragraph('OAuth, MFA, Webhooks', cell_style)],
        [Paragraph('Pro', cell_style), Paragraph('$25+', cell_center), Paragraph('10,000+', cell_center), Paragraph('SSO, Advanced fraud protection', cell_style)],
    ]
    
    auth_table = Table(auth_data, colWidths=[1.2*inch, 1.3*inch, 1.3*inch, 2.3*inch])
    auth_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(auth_table)
    
    auth_rec = """<b>Recommendation:</b> The Free tier covers the entire projected user base of 1,000 users with significant headroom. No upgrade needed until exceeding 10,000 MAUs."""
    story.append(Paragraph(auth_rec, highlight_style))
    story.append(Spacer(1, 12))
    
    # File Storage
    story.append(Paragraph("<b>File Storage: Cloudflare R2</b>", subsection_header))
    r2_desc = """Cloudflare R2 provides S3-compatible object storage without egress fees, making it ideal for user-uploaded pitch decks (PDF/PPTX files). The pay-as-you-go model ensures costs scale linearly with usage."""
    story.append(Paragraph(r2_desc, body_text))
    
    r2_data = [
        [Paragraph('<b>Resource</b>', header_style), Paragraph('<b>Rate</b>', header_style), Paragraph('<b>Est. 1K Users/Month</b>', header_style)],
        [Paragraph('Storage', cell_style), Paragraph('$0.015/GB', cell_center), Paragraph('$2 - $5', cell_center)],
        [Paragraph('Class A Operations (writes)', cell_style), Paragraph('$4.50/million', cell_center), Paragraph('< $1', cell_center)],
        [Paragraph('Class B Operations (reads)', cell_style), Paragraph('$0.36/million', cell_center), Paragraph('< $0.50', cell_center)],
    ]
    
    r2_table = Table(r2_data, colWidths=[2.2*inch, 1.5*inch, 2.4*inch])
    r2_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(r2_table)
    
    r2_rec = """<b>Recommendation:</b> R2 is highly cost-effective. At 1,000 users with average deck uploads of 5MB each, expect $5-10/month in storage costs."""
    story.append(Paragraph(r2_rec, highlight_style))
    story.append(Spacer(1, 12))
    
    # Video Processing
    story.append(Paragraph("<b>Video Processing: Cloudflare Stream</b>", subsection_header))
    stream_desc = """Cloudflare Stream handles video uploads, transcoding, and delivery for the E3 and E4 coaching modules. The service provides automatic optimization and global CDN distribution."""
    story.append(Paragraph(stream_desc, body_text))
    
    stream_data = [
        [Paragraph('<b>Resource</b>', header_style), Paragraph('<b>Rate</b>', header_style), Paragraph('<b>Est. 1K Users/Month</b>', header_style)],
        [Paragraph('Storage', cell_style), Paragraph('$5/1,000 minutes', cell_center), Paragraph('$10 - $20', cell_center)],
        [Paragraph('Streaming', cell_style), Paragraph('$1/1,000 minutes', cell_center), Paragraph('$5 - $10', cell_center)],
        [Paragraph('Uploads', cell_style), Paragraph('Free', cell_center), Paragraph('$0', cell_center)],
    ]
    
    stream_table = Table(stream_data, colWidths=[2.2*inch, 1.5*inch, 2.4*inch])
    stream_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(stream_table)
    
    stream_rec = """<b>Recommendation:</b> For 1,000 users with mixed E3 (3-min) and E4 (30-min) sessions, budget $15-30/month for video infrastructure."""
    story.append(Paragraph(stream_rec, highlight_style))
    story.append(PageBreak())
    
    # Hosting
    story.append(Paragraph("<b>Hosting: Vercel</b>", subsection_header))
    vercel_desc = """Vercel provides edge deployment with automatic SSL, preview deployments, and seamless GitHub integration. The platform is optimized for Next.js applications with global CDN distribution."""
    story.append(Paragraph(vercel_desc, body_text))
    
    vercel_data = [
        [Paragraph('<b>Tier</b>', header_style), Paragraph('<b>Price/Month</b>', header_style), Paragraph('<b>Bandwidth</b>', header_style), Paragraph('<b>Build Minutes</b>', header_style)],
        [Paragraph('Hobby', cell_style), Paragraph('$0', cell_center), Paragraph('100 GB', cell_center), Paragraph('6,000', cell_center)],
        [Paragraph('Pro', cell_style), Paragraph('$20', cell_center), Paragraph('1 TB', cell_center), Paragraph('Unlimited', cell_center)],
        [Paragraph('Enterprise', cell_style), Paragraph('Custom', cell_center), Paragraph('Custom', cell_center), Paragraph('Custom', cell_center)],
    ]
    
    vercel_table = Table(vercel_data, colWidths=[1.5*inch, 1.3*inch, 1.5*inch, 1.8*inch])
    vercel_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(vercel_table)
    
    vercel_rec = """<b>Recommendation:</b> Start with Hobby (free). Upgrade to Pro ($20/month) at launch for production features, analytics, and priority support."""
    story.append(Paragraph(vercel_rec, highlight_style))
    story.append(Spacer(1, 12))
    
    # Billing
    story.append(Paragraph("<b>Billing: Stripe</b>", subsection_header))
    stripe_desc = """Stripe handles subscription management, one-time purchases, and bundle sales. Stripe operates on a transaction-fee model with no monthly costs, making it ideal for variable revenue streams."""
    story.append(Paragraph(stripe_desc, body_text))
    
    stripe_data = [
        [Paragraph('<b>Transaction Type</b>', header_style), Paragraph('<b>Fee Structure</b>', header_style)],
        [Paragraph('Standard Cards', cell_style), Paragraph('2.9% + $0.30 per transaction', cell_style)],
        [Paragraph('International Cards', cell_style), Paragraph('3.9% + $0.30 per transaction', cell_style)],
        [Paragraph('Subscription Billing', cell_style), Paragraph('Included in standard fee', cell_style)],
    ]
    
    stripe_table = Table(stripe_data, colWidths=[2.5*inch, 3.6*inch])
    stripe_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(stripe_table)
    
    stripe_rec = """<b>Note:</b> Stripe fees are variable based on revenue. At $10,000 monthly revenue, expect approximately $320 in processing fees (3.2% effective rate)."""
    story.append(Paragraph(stripe_rec, highlight_style))
    story.append(Spacer(1, 18))
    
    # ========== 1,000 USER PROJECTION ==========
    story.append(Paragraph("<b>1,000 Active User Cost Projection</b>", section_header))
    
    projection_intro = """This section provides a detailed cost projection for operating PitchCoach AI with 1,000 monthly active users. Assumptions include average session usage patterns and typical user behavior based on industry benchmarks for SaaS coaching platforms."""
    story.append(Paragraph(projection_intro, body_text))
    story.append(Spacer(1, 8))
    
    assumptions = """<b>Usage Assumptions:</b> Each of the 1,000 users averages 2 sessions per month across all modules. Distribution: E1 (40%), E2 (35%), E3 (15%), E4 (10%). This reflects the lower barrier to entry for text-based modules versus video-intensive sessions."""
    story.append(Paragraph(assumptions, body_text))
    story.append(Spacer(1, 12))
    
    # Monthly cost breakdown
    story.append(Paragraph("<b>Monthly Cost Breakdown at Scale</b>", subsection_header))
    
    monthly_data = [
        [Paragraph('<b>Category</b>', header_style), Paragraph('<b>Service</b>', header_style), Paragraph('<b>Low Estimate</b>', header_style), Paragraph('<b>High Estimate</b>', header_style)],
        [Paragraph('Database', cell_style), Paragraph('Supabase Pro', cell_style), Paragraph('$25', cell_center), Paragraph('$25', cell_center)],
        [Paragraph('Authentication', cell_style), Paragraph('Clerk Free', cell_style), Paragraph('$0', cell_center), Paragraph('$0', cell_center)],
        [Paragraph('File Storage', cell_style), Paragraph('Cloudflare R2', cell_style), Paragraph('$5', cell_center), Paragraph('$10', cell_center)],
        [Paragraph('Video Processing', cell_style), Paragraph('Cloudflare Stream', cell_style), Paragraph('$15', cell_center), Paragraph('$30', cell_center)],
        [Paragraph('Hosting', cell_style), Paragraph('Vercel Pro', cell_style), Paragraph('$20', cell_center), Paragraph('$20', cell_center)],
        [Paragraph('AI - E1 Sessions (800)', cell_style), Paragraph('Claude Sonnet 4', cell_style), Paragraph('$40', cell_center), Paragraph('$50', cell_center)],
        [Paragraph('AI - E2 Sessions (700)', cell_style), Paragraph('Claude Sonnet 4', cell_style), Paragraph('$14', cell_center), Paragraph('$20', cell_center)],
        [Paragraph('AI - E3 Sessions (300)', cell_style), Paragraph('Gemini 2.5 Flash', cell_style), Paragraph('$24', cell_center), Paragraph('$30', cell_center)],
        [Paragraph('AI - E4 Sessions (200)', cell_style), Paragraph('Claude + Gemini Pro', cell_style), Paragraph('$100', cell_center), Paragraph('$200', cell_center)],
        [Paragraph('<b>TOTAL</b>', cell_style), Paragraph('', cell_style), Paragraph('<b>$243</b>', cell_center), Paragraph('<b>$385</b>', cell_center)],
    ]
    
    monthly_table = Table(monthly_data, colWidths=[1.7*inch, 1.5*inch, 1.4*inch, 1.4*inch])
    monthly_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('BACKGROUND', (0, 4), (-1, 4), LIGHT_GRAY),
        ('BACKGROUND', (0, 5), (-1, 5), BRAND_WHITE),
        ('BACKGROUND', (0, 6), (-1, 6), LIGHT_GRAY),
        ('BACKGROUND', (0, 7), (-1, 7), BRAND_WHITE),
        ('BACKGROUND', (0, 8), (-1, 8), LIGHT_GRAY),
        ('BACKGROUND', (0, 9), (-1, 9), BRAND_WHITE),
        ('BACKGROUND', (0, 10), (-1, 10), colors.HexColor('#E8F4F8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(monthly_table)
    story.append(Spacer(1, 18))
    
    # Key metrics
    story.append(Paragraph("<b>Key Financial Metrics</b>", subsection_header))
    
    metrics_final = [
        [Paragraph('<b>Metric</b>', header_style), Paragraph('<b>Value</b>', header_style), Paragraph('<b>Notes</b>', header_style)],
        [Paragraph('Cost Per Active User', cell_style), Paragraph('$0.24 - $0.39', cell_center), Paragraph('Infrastructure + AI combined', cell_style)],
        [Paragraph('Cost Per Session', cell_style), Paragraph('$0.12 - $0.19', cell_center), Paragraph('Average across all modules', cell_style)],
        [Paragraph('AI Cost Ratio', cell_style), Paragraph('60-70%', cell_center), Paragraph('AI represents majority of variable costs', cell_style)],
        [Paragraph('Infrastructure Cost Ratio', cell_style), Paragraph('30-40%', cell_center), Paragraph('Fixed costs for database, hosting', cell_style)],
        [Paragraph('Breakeven Revenue/User', cell_style), Paragraph('$1.00 - $1.50', cell_center), Paragraph('Assuming 80% gross margin target', cell_style)],
    ]
    
    metrics_table_final = Table(metrics_final, colWidths=[1.8*inch, 1.5*inch, 2.8*inch])
    metrics_table_final.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('BACKGROUND', (0, 4), (-1, 4), LIGHT_GRAY),
        ('BACKGROUND', (0, 5), (-1, 5), BRAND_WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(metrics_table_final)
    story.append(PageBreak())
    
    # ========== SCALING CONSIDERATIONS ==========
    story.append(Paragraph("<b>Scaling Considerations & Cost Optimization</b>", section_header))
    
    scaling_intro = """As PitchCoach AI grows beyond 1,000 users, several strategies can help manage costs while maintaining service quality. This section outlines key optimization opportunities and projected costs at higher scales."""
    story.append(Paragraph(scaling_intro, body_text))
    story.append(Spacer(1, 12))
    
    # Optimization strategies
    story.append(Paragraph("<b>Cost Optimization Strategies</b>", subsection_header))
    
    opt1 = """<b>1. Response Caching:</b> Implement caching for repeated analyses of similar content. If a user re-uploads the same deck with minor changes, leverage cached analysis results. Expected savings: 15-20% on AI costs."""
    story.append(Paragraph(opt1, body_text))
    
    opt2 = """<b>2. Smart Video Processing:</b> For E4 sessions, implement a two-stage analysis. First, use Gemini Flash for initial assessment, only escalating to Gemini Pro for sessions flagged as needing deeper analysis. Expected savings: 30-40% on E4 AI costs."""
    story.append(Paragraph(opt2, body_text))
    
    opt3 = """<b>3. Batch Processing:</b> Queue non-urgent analyses for off-peak processing. This enables bulk API usage and potential volume discounts with AI providers."""
    story.append(Paragraph(opt3, body_text))
    
    opt4 = """<b>4. Tiered Access:</b> Limit high-cost modules (E4) to premium subscriptions. Structure pricing to ensure profitable unit economics per module."""
    story.append(Paragraph(opt4, body_text))
    story.append(Spacer(1, 12))
    
    # Scale projections
    story.append(Paragraph("<b>Scale Projections</b>", subsection_header))
    
    scale_data = [
        [Paragraph('<b>Users</b>', header_style), Paragraph('<b>Monthly Cost</b>', header_style), Paragraph('<b>Cost/User</b>', header_style), Paragraph('<b>Recommended Actions</b>', header_style)],
        [Paragraph('100', cell_style), Paragraph('$50 - $100', cell_center), Paragraph('$0.50 - $1.00', cell_center), Paragraph('Free tiers, development focus', cell_style)],
        [Paragraph('1,000', cell_style), Paragraph('$250 - $400', cell_center), Paragraph('$0.25 - $0.40', cell_center), Paragraph('Pro tiers, optimize AI usage', cell_style)],
        [Paragraph('5,000', cell_style), Paragraph('$800 - $1,500', cell_center), Paragraph('$0.16 - $0.30', cell_center), Paragraph('Volume discounts, caching', cell_style)],
        [Paragraph('10,000', cell_style), Paragraph('$1,500 - $2,500', cell_center), Paragraph('$0.15 - $0.25', cell_center), Paragraph('Enterprise DB tier, CDN optimization', cell_style)],
        [Paragraph('25,000', cell_style), Paragraph('$3,000 - $5,000', cell_center), Paragraph('$0.12 - $0.20', cell_center), Paragraph('Custom AI agreements, dedicated infra', cell_style)],
    ]
    
    scale_table = Table(scale_data, colWidths=[1*inch, 1.3*inch, 1.3*inch, 2.5*inch])
    scale_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('BACKGROUND', (0, 1), (-1, 1), BRAND_WHITE),
        ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
        ('BACKGROUND', (0, 3), (-1, 3), BRAND_WHITE),
        ('BACKGROUND', (0, 4), (-1, 4), LIGHT_GRAY),
        ('BACKGROUND', (0, 5), (-1, 5), BRAND_WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(scale_table)
    story.append(Spacer(1, 18))
    
    # ========== RISK FACTORS ==========
    story.append(Paragraph("<b>Risk Factors & Considerations</b>", section_header))
    
    risk_intro = """Investors should be aware of the following risk factors that could impact cost projections and operational stability."""
    story.append(Paragraph(risk_intro, body_text))
    story.append(Spacer(1, 10))
    
    risk1 = """<b>AI Pricing Volatility:</b> The AI services market is rapidly evolving. While current pricing from Anthropic and Google is competitive, price changes could significantly impact unit economics. Mitigation: Maintain relationships with multiple AI providers and build abstraction layers for easy model switching."""
    story.append(Paragraph(risk1, body_text))
    
    risk2 = """<b>Usage Pattern Variance:</b> Actual user behavior may differ from projections. Higher-than-expected E4 usage would increase costs disproportionately. Mitigation: Implement usage monitoring and dynamic pricing adjustments."""
    story.append(Paragraph(risk2, body_text))
    
    risk3 = """<b>Service Dependencies:</b> The platform relies on multiple third-party services (Supabase, Clerk, Cloudflare). Service outages or policy changes could impact operations. Mitigation: Maintain disaster recovery procedures and consider multi-region deployment for critical services."""
    story.append(Paragraph(risk3, body_text))
    
    risk4 = """<b>Video Processing Limits:</b> Extended video sessions (E4) consume significant AI resources. Unexpected growth in this module could strain budgets. Mitigation: Implement strict session duration limits and tiered access controls."""
    story.append(Paragraph(risk4, body_text))
    story.append(Spacer(1, 18))
    
    # ========== CONCLUSION ==========
    story.append(Paragraph("<b>Conclusion & Recommendations</b>", section_header))
    
    conclusion = """PitchCoach AI is positioned for cost-effective scaling with a well-architected technology stack. The estimated monthly operational cost for 1,000 active users ranges from $250 to $400, with per-user costs decreasing as scale increases due to infrastructure efficiency gains."""
    story.append(Paragraph(conclusion, body_text))
    story.append(Spacer(1, 10))
    
    rec_list = """<b>Key Recommendations:</b>"""
    story.append(Paragraph(rec_list, body_text))
    
    rec1 = """Start with free tiers during MVP development to minimize burn rate while validating product-market fit."""
    story.append(Paragraph("• " + rec1, bullet_style))
    
    rec2 = """Implement robust usage monitoring before launch to track AI costs per module and identify optimization opportunities."""
    story.append(Paragraph("• " + rec2, bullet_style))
    
    rec3 = """Structure pricing tiers to ensure profitable unit economics, with higher-cost modules (E4) reserved for premium subscribers."""
    story.append(Paragraph("• " + rec3, bullet_style))
    
    rec4 = """Build caching infrastructure early to reduce redundant AI API calls and improve response times."""
    story.append(Paragraph("• " + rec4, bullet_style))
    
    rec5 = """Maintain flexibility in AI provider selection through abstraction layers to capitalize on pricing competition."""
    story.append(Paragraph("• " + rec5, bullet_style))
    story.append(Spacer(1, 20))
    
    # Footer
    story.append(Paragraph("CONFIDENTIAL - For Automagikal Internal Use Only", confidential_style))
    
    # Build PDF
    doc.build(story)
    print(f"PDF generated: {filename}")
    return filename

if __name__ == "__main__":
    create_pdf()
