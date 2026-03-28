from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    PageBreak, Image
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import os

# Register fonts
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

# Brand colors
BLUE = colors.HexColor('#334B79')
GREEN = colors.HexColor('#4AAB9A')
RED = colors.HexColor('#ED3B65')

def create_pdf():
    doc = SimpleDocTemplate(
        "/home/z/my-project/download/PitchCoach_AI_Cost_Implication_Analysis.pdf",
        pagesize=letter,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
        leftMargin=0.75*inch,
        rightMargin=0.75*inch,
        title="PitchCoach AI Cost Implication Analysis",
        author="Z.ai",
        creator="Z.ai",
        subject="Detailed cost analysis for PitchCoach AI infrastructure and operations"
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontName='Times New Roman',
        fontSize=28,
        textColor=BLUE,
        alignment=TA_CENTER,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontName='Times New Roman',
        fontSize=14,
        textColor=colors.gray,
        alignment=TA_CENTER,
        spaceAfter=24
    )
    
    heading1_style = ParagraphStyle(
        'Heading1',
        parent=styles['Heading1'],
        fontName='Times New Roman',
        fontSize=18,
        textColor=BLUE,
        spaceBefore=18,
        spaceAfter=12
    )
    
    heading2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontName='Times New Roman',
        fontSize=14,
        textColor=BLUE,
        spaceBefore=12,
        spaceAfter=8
    )
    
    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontName='Times New Roman',
        fontSize=10.5,
        leading=16,
        alignment=TA_JUSTIFY,
        spaceAfter=8
    )
    
    bold_body = ParagraphStyle(
        'BoldBody',
        parent=body_style,
        fontName='Times New Roman',
    )
    
    table_header_style = ParagraphStyle(
        'TableHeader',
        fontName='Times New Roman',
        fontSize=10,
        textColor=colors.white,
        alignment=TA_CENTER
    )
    
    table_cell_style = ParagraphStyle(
        'TableCell',
        fontName='Times New Roman',
        fontSize=9,
        alignment=TA_LEFT
    )
    
    table_cell_center = ParagraphStyle(
        'TableCellCenter',
        fontName='Times New Roman',
        fontSize=9,
        alignment=TA_CENTER
    )
    
    table_cell_right = ParagraphStyle(
        'TableCellRight',
        fontName='Times New Roman',
        fontSize=9,
        alignment=TA_RIGHT
    )

    # === COVER PAGE ===
    story.append(Spacer(1, 100))
    story.append(Paragraph("PitchCoach AI", title_style))
    story.append(Paragraph("Cost Implication Analysis", ParagraphStyle(
        'SubTitle2', parent=title_style, fontSize=20, textColor=colors.black, spaceAfter=30
    )))
    story.append(Paragraph("Infrastructure, Operations & Margin Analysis", subtitle_style))
    story.append(Spacer(1, 30))
    story.append(Paragraph("CONFIDENTIAL", ParagraphStyle(
        'Confidential', parent=subtitle_style, fontSize=12, textColor=RED
    )))
    story.append(Paragraph("Prepared for Automagikal", ParagraphStyle(
        'PreparedFor', parent=body_style, alignment=TA_CENTER, fontSize=11
    )))
    story.append(Paragraph("March 2025", ParagraphStyle(
        'Date', parent=body_style, alignment=TA_CENTER, fontSize=11, textColor=colors.gray
    )))
    story.append(PageBreak())
    
    # === EXECUTIVE SUMMARY ===
    story.append(Paragraph("Executive Summary", heading1_style))
    
    exec_summary = """
    This document provides a comprehensive cost analysis for the PitchCoach AI platform, covering all infrastructure 
    components, AI model usage, payment processing fees, and operational expenses. The analysis is designed to 
    inform pricing strategy and ensure sustainable margins at the target price point of $15-20 per month per user.
    """
    story.append(Paragraph(exec_summary, body_style))
    story.append(Spacer(1, 12))
    
    # Key Findings Table
    key_findings = [
        [Paragraph('<b>Category</b>', table_header_style), 
         Paragraph('<b>Monthly Fixed Cost</b>', table_header_style),
         Paragraph('<b>Cost Per Active User</b>', table_header_style),
         Paragraph('<b>Notes</b>', table_header_style)],
        [Paragraph('Infrastructure', table_cell_style), 
         Paragraph('$44-74', table_cell_center),
         Paragraph('$0.02-0.05', table_cell_center),
         Paragraph('Scales with storage', table_cell_style)],
        [Paragraph('AI Models', table_cell_style), 
         Paragraph('$0', table_cell_center),
         Paragraph('$0.15-2.50', table_cell_center),
         Paragraph('Per-session usage', table_cell_style)],
        [Paragraph('Payment Processing', table_cell_style), 
         Paragraph('$0', table_cell_center),
         Paragraph('$0.45-0.60', table_cell_center),
         Paragraph('3.4-3.9% per transaction', table_cell_style)],
        [Paragraph('TOTAL', table_cell_style), 
         Paragraph('$44-74', table_cell_center),
         Paragraph('$0.62-3.15', table_cell_center),
         Paragraph('Highly variable by usage tier', table_cell_style)],
    ]
    
    findings_table = Table(key_findings, colWidths=[1.5*inch, 1.3*inch, 1.5*inch, 1.7*inch])
    findings_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.white),
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#E8F4E8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(findings_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 1:</b> Cost Summary Overview", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 18))
    
    # === INFRASTRUCTURE COSTS ===
    story.append(Paragraph("1. Infrastructure Costs (Fixed Monthly)", heading1_style))
    
    infra_intro = """
    Infrastructure costs represent the baseline operational expenses required to run the platform regardless of user 
    count. These costs include database hosting, authentication services, file storage, video streaming, and 
    application hosting. The following breakdown details each component with specific pricing tiers.
    """
    story.append(Paragraph(infra_intro, body_style))
    
    # Infrastructure Table
    infra_data = [
        [Paragraph('<b>Service</b>', table_header_style),
         Paragraph('<b>Provider</b>', table_header_style),
         Paragraph('<b>Plan</b>', table_header_style),
         Paragraph('<b>Monthly Cost</b>', table_header_style),
         Paragraph('<b>Limits</b>', table_header_style)],
        [Paragraph('Database', table_cell_style),
         Paragraph('Supabase', table_cell_center),
         Paragraph('Pro', table_cell_center),
         Paragraph('$25', table_cell_right),
         Paragraph('8GB, 250GB bandwidth', table_cell_style)],
        [Paragraph('Authentication', table_cell_style),
         Paragraph('Clerk', table_cell_center),
         Paragraph('Pro', table_cell_center),
         Paragraph('$25', table_cell_right),
         Paragraph('10K MAUs included', table_cell_style)],
        [Paragraph('Hosting', table_cell_style),
         Paragraph('Vercel', table_cell_center),
         Paragraph('Pro', table_cell_center),
         Paragraph('$20', table_cell_right),
         Paragraph('100GB bandwidth', table_cell_style)],
        [Paragraph('File Storage', table_cell_style),
         Paragraph('Cloudflare R2', table_cell_center),
         Paragraph('Pay-as-you-go', table_cell_center),
         Paragraph('$0-15', table_cell_right),
         Paragraph('$0.015/GB storage', table_cell_style)],
        [Paragraph('Video Streaming', table_cell_style),
         Paragraph('Cloudflare Stream', table_cell_center),
         Paragraph('Pay-as-you-go', table_cell_center),
         Paragraph('$0-10', table_cell_right),
         Paragraph('$5/1000 min stored', table_cell_style)],
        [Paragraph('<b>TOTAL FIXED</b>', table_cell_style),
         Paragraph('', table_cell_center),
         Paragraph('', table_cell_center),
         Paragraph('<b>$44-74</b>', table_cell_right),
         Paragraph('Scales with storage usage', table_cell_style)],
    ]
    
    infra_table = Table(infra_data, colWidths=[1.2*inch, 1.0*inch, 1.0*inch, 1.0*inch, 1.8*inch])
    infra_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.white),
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 5), (-1, 5), colors.white),
        ('BACKGROUND', (0, 6), (-1, 6), colors.HexColor('#E8F4E8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(infra_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 2:</b> Monthly Fixed Infrastructure Costs", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 18))
    
    # === AI MODEL COSTS ===
    story.append(Paragraph("2. AI Model Costs (Variable Per-Session)", heading1_style))
    
    ai_intro = """
    AI model costs are the primary variable expense, directly tied to user engagement with each coaching module. 
    These costs scale linearly with usage and represent the most significant margin consideration for pricing strategy.
    """
    story.append(Paragraph(ai_intro, body_style))
    
    # Model Pricing Table
    story.append(Paragraph("2.1 Model Pricing Reference", heading2_style))
    
    model_pricing = [
        [Paragraph('<b>Model</b>', table_header_style),
         Paragraph('<b>Provider</b>', table_header_style),
         Paragraph('<b>Input (per 1M tokens)</b>', table_header_style),
         Paragraph('<b>Output (per 1M tokens)</b>', table_header_style),
         Paragraph('<b>Best For</b>', table_header_style)],
        [Paragraph('Claude Sonnet 4', table_cell_style),
         Paragraph('Anthropic', table_cell_center),
         Paragraph('$3.00', table_cell_right),
         Paragraph('$15.00', table_cell_right),
         Paragraph('Text analysis, E1/E2/E4', table_cell_style)],
        [Paragraph('Gemini 2.5 Flash', table_cell_style),
         Paragraph('Google', table_cell_center),
         Paragraph('$0.10', table_cell_right),
         Paragraph('$0.40', table_cell_right),
         Paragraph('Video analysis, E3', table_cell_style)],
        [Paragraph('Gemini 1.5 Pro', table_cell_style),
         Paragraph('Google', table_cell_center),
         Paragraph('$1.25', table_cell_right),
         Paragraph('$5.00', table_cell_right),
         Paragraph('Long video analysis, E4', table_cell_style)],
    ]
    
    model_table = Table(model_pricing, colWidths=[1.3*inch, 0.9*inch, 1.3*inch, 1.3*inch, 1.2*inch])
    model_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(model_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 3:</b> AI Model Pricing (as of March 2025)", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 18))
    
    # === MODULE-BY-MODULE COST BREAKDOWN ===
    story.append(Paragraph("3. Module-by-Module Cost Breakdown", heading1_style))
    
    # E1: Deck Analyser
    story.append(Paragraph("3.1 E1: Pitch Deck Analyser", heading2_style))
    
    e1_desc = """
    The Deck Analyser processes uploaded PDF or PPTX files through Claude Sonnet for comprehensive content 
    and visual analysis. Each deck analysis requires document extraction, multi-page processing, and 
    structured scoring output.
    """
    story.append(Paragraph(e1_desc, body_style))
    
    e1_data = [
        [Paragraph('<b>Cost Component</b>', table_header_style),
         Paragraph('<b>Unit</b>', table_header_style),
         Paragraph('<b>Cost</b>', table_header_style),
         Paragraph('<b>Notes</b>', table_header_style)],
        [Paragraph('File Upload (R2)', table_cell_style),
         Paragraph('Per upload', table_cell_center),
         Paragraph('$0.0001', table_cell_right),
         Paragraph('Negligible', table_cell_style)],
        [Paragraph('PDF Extraction', table_cell_style),
         Paragraph('Per deck', table_cell_center),
         Paragraph('$0.002', table_cell_right),
         Paragraph('Server-side processing', table_cell_style)],
        [Paragraph('Claude Sonnet Input', table_cell_style),
         Paragraph('~5K tokens/deck', table_cell_center),
         Paragraph('$0.015', table_cell_right),
         Paragraph('Deck content + images', table_cell_style)],
        [Paragraph('Claude Sonnet Output', table_cell_style),
         Paragraph('~2K tokens/deck', table_cell_center),
         Paragraph('$0.030', table_cell_right),
         Paragraph('Analysis results', table_cell_style)],
        [Paragraph('<b>TOTAL PER DECK</b>', table_cell_style),
         Paragraph('', table_cell_center),
         Paragraph('<b>$0.047</b>', table_cell_right),
         Paragraph('~5 cents per analysis', table_cell_style)],
    ]
    
    e1_table = Table(e1_data, colWidths=[1.5*inch, 1.1*inch, 1.0*inch, 2.4*inch])
    e1_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.white),
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor('#E8F4E8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(e1_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 4:</b> E1 Deck Analyser Cost Per Session", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 12))
    
    # E2: Script Coach
    story.append(Paragraph("3.2 E2: Elevator Pitch Script Coach", heading2_style))
    
    e2_desc = """
    The Script Coach analyzes text input or uploaded documents, evaluating the 5-element structure (Hook, Problem, 
    Solution, Credibility, CTA) and generating rewritten versions with alternative opening hooks.
    """
    story.append(Paragraph(e2_desc, body_style))
    
    e2_data = [
        [Paragraph('<b>Cost Component</b>', table_header_style),
         Paragraph('<b>Unit</b>', table_header_style),
         Paragraph('<b>Cost</b>', table_header_style),
         Paragraph('<b>Notes</b>', table_header_style)],
        [Paragraph('Claude Sonnet Input', table_cell_style),
         Paragraph('~1K tokens/script', table_cell_center),
         Paragraph('$0.003', table_cell_right),
         Paragraph('Script + prompts', table_cell_style)],
        [Paragraph('Claude Sonnet Output', table_cell_style),
         Paragraph('~1.5K tokens/script', table_cell_center),
         Paragraph('$0.023', table_cell_right),
         Paragraph('Analysis + rewrites', table_cell_style)],
        [Paragraph('<b>TOTAL PER SCRIPT</b>', table_cell_style),
         Paragraph('', table_cell_center),
         Paragraph('<b>$0.026</b>', table_cell_right),
         Paragraph('~2.6 cents per analysis', table_cell_style)],
    ]
    
    e2_table = Table(e2_data, colWidths=[1.5*inch, 1.1*inch, 1.0*inch, 2.4*inch])
    e2_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#E8F4E8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(e2_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 5:</b> E2 Script Coach Cost Per Session", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 12))
    
    # E3: Live Pitch
    story.append(Paragraph("3.3 E3: Live Pitch Coach (Video)", heading2_style))
    
    e3_desc = """
    The Live Pitch module processes video recordings up to 3 minutes for delivery and body language analysis. 
    Gemini 2.5 Flash is used for its cost-effective video understanding capabilities.
    """
    story.append(Paragraph(e3_desc, body_style))
    
    e3_data = [
        [Paragraph('<b>Cost Component</b>', table_header_style),
         Paragraph('<b>Unit</b>', table_header_style),
         Paragraph('<b>Cost</b>', table_header_style),
         Paragraph('<b>Notes</b>', table_header_style)],
        [Paragraph('Video Upload (Stream)', table_cell_style),
         Paragraph('Per video', table_cell_center),
         Paragraph('$0.05', table_cell_right),
         Paragraph('Storage + processing', table_cell_style)],
        [Paragraph('Gemini 2.5 Flash Input', table_cell_style),
         Paragraph('~3 min video', table_cell_center),
         Paragraph('$0.02', table_cell_right),
         Paragraph('Video + audio analysis', table_cell_style)],
        [Paragraph('Gemini 2.5 Flash Output', table_cell_style),
         Paragraph('~2K tokens', table_cell_center),
         Paragraph('$0.001', table_cell_right),
         Paragraph('Analysis results', table_cell_style)],
        [Paragraph('<b>TOTAL PER VIDEO</b>', table_cell_style),
         Paragraph('', table_cell_center),
         Paragraph('<b>$0.071</b>', table_cell_right),
         Paragraph('~7 cents per analysis', table_cell_style)],
    ]
    
    e3_table = Table(e3_data, colWidths=[1.5*inch, 1.1*inch, 1.0*inch, 2.4*inch])
    e3_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.white),
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#E8F4E8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(e3_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 6:</b> E3 Live Pitch Cost Per Session", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 12))
    
    # E4: Full Session
    story.append(Paragraph("3.4 E4: Full Pitch Session (30-min Video + Deck)", heading2_style))
    
    e4_desc = """
    The Full Session module is the most resource-intensive, combining 30-minute video analysis with deck evaluation. 
    Gemini 1.5 Pro is required for longer video context, combined with Claude Sonnet for deck analysis.
    """
    story.append(Paragraph(e4_desc, body_style))
    
    e4_data = [
        [Paragraph('<b>Cost Component</b>', table_header_style),
         Paragraph('<b>Unit</b>', table_header_style),
         Paragraph('<b>Cost</b>', table_header_style),
         Paragraph('<b>Notes</b>', table_header_style)],
        [Paragraph('Deck Analysis (Claude)', table_cell_style),
         Paragraph('Per deck', table_cell_center),
         Paragraph('$0.047', table_cell_right),
         Paragraph('Same as E1', table_cell_style)],
        [Paragraph('Video Upload (Stream)', table_cell_style),
         Paragraph('Per video', table_cell_center),
         Paragraph('$0.50', table_cell_right),
         Paragraph('30 min storage', table_cell_style)],
        [Paragraph('Gemini 1.5 Pro Input', table_cell_style),
         Paragraph('~30 min video', table_cell_center),
         Paragraph('$1.50', table_cell_right),
         Paragraph('Long context processing', table_cell_style)],
        [Paragraph('Gemini 1.5 Pro Output', table_cell_style),
         Paragraph('~4K tokens', table_cell_center),
         Paragraph('$0.020', table_cell_right),
         Paragraph('Comprehensive analysis', table_cell_style)],
        [Paragraph('Synthesis (Claude)', table_cell_style),
         Paragraph('Combined analysis', table_cell_center),
         Paragraph('$0.10', table_cell_right),
         Paragraph('Merge deck + video results', table_cell_style)],
        [Paragraph('<b>TOTAL PER SESSION</b>', table_cell_style),
         Paragraph('', table_cell_center),
         Paragraph('<b>$2.17</b>', table_cell_right),
         Paragraph('Most expensive module', table_cell_style)],
    ]
    
    e4_table = Table(e4_data, colWidths=[1.5*inch, 1.1*inch, 1.0*inch, 2.4*inch])
    e4_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), RED),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.white),
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 5), (-1, 5), colors.white),
        ('BACKGROUND', (0, 6), (-1, 6), colors.HexColor('#FFE8E8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(e4_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 7:</b> E4 Full Session Cost Per Session", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 18))
    
    # === MODULE COST COMPARISON ===
    story.append(Paragraph("4. Module Cost Comparison", heading1_style))
    
    comparison_data = [
        [Paragraph('<b>Module</b>', table_header_style),
         Paragraph('<b>Cost Per Session</b>', table_header_style),
         Paragraph('<b>Sessions at $15/mo</b>', table_header_style),
         Paragraph('<b>Sessions at $20/mo</b>', table_header_style)],
        [Paragraph('E1: Deck Analyser', table_cell_style),
         Paragraph('$0.047', table_cell_center),
         Paragraph('319 sessions', table_cell_center),
         Paragraph('425 sessions', table_cell_center)],
        [Paragraph('E2: Script Coach', table_cell_style),
         Paragraph('$0.026', table_cell_center),
         Paragraph('576 sessions', table_cell_center),
         Paragraph('769 sessions', table_cell_center)],
        [Paragraph('E3: Live Pitch', table_cell_style),
         Paragraph('$0.071', table_cell_center),
         Paragraph('211 sessions', table_cell_center),
         Paragraph('281 sessions', table_cell_center)],
        [Paragraph('E4: Full Session', table_cell_style),
         Paragraph('$2.17', table_cell_center),
         Paragraph('6 sessions', table_cell_center),
         Paragraph('9 sessions', table_cell_center)],
    ]
    
    comp_table = Table(comparison_data, colWidths=[1.5*inch, 1.3*inch, 1.5*inch, 1.5*inch])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.white),
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#FFE8E8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(comp_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 8:</b> Breakeven Session Count by Module", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 18))
    
    # === PAYMENT PROCESSING ===
    story.append(Paragraph("5. Payment Processing Costs", heading1_style))
    
    payment_intro = """
    Payment processing fees vary by provider and region. PitchCoach AI supports both Stripe (global markets) 
    and Paystack (African markets) to optimize costs for different customer bases.
    """
    story.append(Paragraph(payment_intro, body_style))
    
    payment_data = [
        [Paragraph('<b>Provider</b>', table_header_style),
         Paragraph('<b>Markets</b>', table_header_style),
         Paragraph('<b>Fee Structure</b>', table_header_style),
         Paragraph('<b>$15 Subscription Cost</b>', table_header_style),
         Paragraph('<b>$20 Subscription Cost</b>', table_header_style)],
        [Paragraph('Stripe', table_cell_style),
         Paragraph('Global (USD/EUR/GBP)', table_cell_center),
         Paragraph('2.9% + $0.30', table_cell_center),
         Paragraph('$0.74 (4.9%)', table_cell_center),
         Paragraph('$0.88 (4.4%)', table_cell_center)],
        [Paragraph('Paystack', table_cell_style),
         Paragraph('Africa (NGN/ZAR/KES/GHS)', table_cell_center),
         Paragraph('1.5% + $0.10', table_cell_center),
         Paragraph('$0.33 (2.2%)', table_cell_center),
         Paragraph('$0.40 (2.0%)', table_cell_center)],
    ]
    
    payment_table = Table(payment_data, colWidths=[1.0*inch, 1.4*inch, 1.2*inch, 1.3*inch, 1.3*inch])
    payment_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(payment_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 9:</b> Payment Processing Fees by Provider", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 18))
    
    # === USER SCENARIO ANALYSIS ===
    story.append(Paragraph("6. User Scenario Analysis", heading1_style))
    
    scenario_intro = """
    This section models cost implications across different user engagement patterns to understand margin 
    distribution and identify optimal pricing tiers.
    """
    story.append(Paragraph(scenario_intro, body_style))
    
    scenario_data = [
        [Paragraph('<b>User Type</b>', table_header_style),
         Paragraph('<b>Monthly Sessions</b>', table_header_style),
         Paragraph('<b>Variable Cost</b>', table_header_style),
         Paragraph('<b>Margin @ $15</b>', table_header_style),
         Paragraph('<b>Margin @ $20</b>', table_header_style)],
        [Paragraph('Light User (E1/E2 only)', table_cell_style),
         Paragraph('5 sessions', table_cell_center),
         Paragraph('$0.37', table_cell_center),
         Paragraph('$13.89 (93%)', table_cell_center),
         Paragraph('$18.63 (93%)', table_cell_center)],
        [Paragraph('Moderate User (Mixed)', table_cell_style),
         Paragraph('10 sessions (mix)', table_cell_center),
         Paragraph('$0.80', table_cell_center),
         Paragraph('$13.46 (90%)', table_cell_center),
         Paragraph('$18.20 (91%)', table_cell_center)],
        [Paragraph('Active User (All modules)', table_cell_style),
         Paragraph('20 sessions (mix)', table_cell_center),
         Paragraph('$2.50', table_cell_center),
         Paragraph('$11.76 (78%)', table_cell_center),
         Paragraph('$16.50 (83%)', table_cell_center)],
        [Paragraph('Power User (E4 heavy)', table_cell_style),
         Paragraph('5 E4 sessions', table_cell_center),
         Paragraph('$10.85', table_cell_center),
         Paragraph('$3.41 (23%)', table_cell_center),
         Paragraph('$8.15 (41%)', table_cell_center)],
    ]
    
    scenario_table = Table(scenario_data, colWidths=[1.5*inch, 1.2*inch, 1.1*inch, 1.2*inch, 1.2*inch])
    scenario_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#E8F4E8')),
        ('BACKGROUND', (0, 2), (-1, 2), colors.white),
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#FFE8E8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(scenario_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 10:</b> User Scenario Cost Analysis", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 18))
    
    # === PRICING RECOMMENDATIONS ===
    story.append(Paragraph("7. Pricing Recommendations", heading1_style))
    
    pricing_intro = """
    Based on the cost analysis, the following pricing structure is recommended to ensure sustainable margins 
    while maintaining competitive positioning in the market.
    """
    story.append(Paragraph(pricing_intro, body_style))
    
    pricing_data = [
        [Paragraph('<b>Plan</b>', table_header_style),
         Paragraph('<b>Price</b>', table_header_style),
         Paragraph('<b>E1 Limit</b>', table_header_style),
         Paragraph('<b>E2 Limit</b>', table_header_style),
         Paragraph('<b>E3 Limit</b>', table_header_style),
         Paragraph('<b>E4 Limit</b>', table_header_style),
         Paragraph('<b>Est. Margin</b>', table_header_style)],
        [Paragraph('Free Trial', table_cell_style),
         Paragraph('$0', table_cell_center),
         Paragraph('1', table_cell_center),
         Paragraph('1', table_cell_center),
         Paragraph('0', table_cell_center),
         Paragraph('0', table_cell_center),
         Paragraph('N/A', table_cell_center)],
        [Paragraph('Starter', table_cell_style),
         Paragraph('$9/mo', table_cell_center),
         Paragraph('5', table_cell_center),
         Paragraph('10', table_cell_center),
         Paragraph('2', table_cell_center),
         Paragraph('0', table_cell_center),
         Paragraph('70-85%', table_cell_center)],
        [Paragraph('Professional', table_cell_style),
         Paragraph('$19/mo', table_cell_center),
         Paragraph('20', table_cell_center),
         Paragraph('50', table_cell_center),
         Paragraph('10', table_cell_center),
         Paragraph('2', table_cell_center),
         Paragraph('75-90%', table_cell_center)],
        [Paragraph('Enterprise', table_cell_style),
         Paragraph('$49/mo', table_cell_center),
         Paragraph('Unlimited', table_cell_center),
         Paragraph('Unlimited', table_cell_center),
         Paragraph('30', table_cell_center),
         Paragraph('10', table_cell_center),
         Paragraph('65-80%', table_cell_center)],
    ]
    
    pricing_table = Table(pricing_data, colWidths=[1.0*inch, 0.8*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch, 1.0*inch])
    pricing_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 2), (-1, 2), colors.white),
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#E8F4E8')),
        ('BACKGROUND', (0, 4), (-1, 4), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(pricing_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 11:</b> Recommended Pricing Tiers", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 18))
    
    # === SCALE PROJECTIONS ===
    story.append(Paragraph("8. Scale Projections (1000 Users)", heading1_style))
    
    scale_intro = """
    Projected monthly costs at 1000 monthly active users with average usage patterns of 8 E1, 10 E2, 3 E3, 
    and 1 E4 session per user per month.
    """
    story.append(Paragraph(scale_intro, body_style))
    
    scale_data = [
        [Paragraph('<b>Cost Category</b>', table_header_style),
         Paragraph('<b>Calculation</b>', table_header_style),
         Paragraph('<b>Monthly Cost</b>', table_header_style)],
        [Paragraph('Fixed Infrastructure', table_cell_style),
         Paragraph('Supabase + Clerk + Vercel + Storage', table_cell_center),
         Paragraph('$74', table_cell_right)],
        [Paragraph('E1: Deck Analyses (8000)', table_cell_style),
         Paragraph('8,000 x $0.047', table_cell_center),
         Paragraph('$376', table_cell_right)],
        [Paragraph('E2: Script Coach (10000)', table_cell_style),
         Paragraph('10,000 x $0.026', table_cell_center),
         Paragraph('$260', table_cell_right)],
        [Paragraph('E3: Live Pitch (3000)', table_cell_style),
         Paragraph('3,000 x $0.071', table_cell_center),
         Paragraph('$213', table_cell_right)],
        [Paragraph('E4: Full Session (1000)', table_cell_style),
         Paragraph('1,000 x $2.17', table_cell_center),
         Paragraph('$2,170', table_cell_right)],
        [Paragraph('Payment Processing', table_cell_style),
         Paragraph('1000 x $15 x 4.5%', table_cell_center),
         Paragraph('$675', table_cell_right)],
        [Paragraph('<b>TOTAL MONTHLY COST</b>', table_cell_style),
         Paragraph('', table_cell_center),
         Paragraph('<b>$3,768</b>', table_cell_right)],
        [Paragraph('<b>REVENUE (1000 users)</b>', table_cell_style),
         Paragraph('1000 x $15', table_cell_center),
         Paragraph('<b>$15,000</b>', table_cell_right)],
        [Paragraph('<b>NET MARGIN</b>', table_cell_style),
         Paragraph('', table_cell_center),
         Paragraph('<b>$11,232 (75%)</b>', table_cell_right)],
    ]
    
    scale_table = Table(scale_data, colWidths=[1.8*inch, 2.2*inch, 1.2*inch])
    scale_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.white),
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 5), (-1, 5), colors.white),
        ('BACKGROUND', (0, 6), (-1, 6), colors.HexColor('#F5F5F5')),
        ('BACKGROUND', (0, 7), (-1, 7), colors.HexColor('#FFE8E8')),
        ('BACKGROUND', (0, 8), (-1, 8), colors.HexColor('#E8F4E8')),
        ('BACKGROUND', (0, 9), (-1, 9), colors.HexColor('#D4EDDA')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(scale_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Table 12:</b> 1000-User Scale Projection", ParagraphStyle(
        'Caption', parent=body_style, alignment=TA_CENTER, fontSize=9, textColor=colors.gray
    )))
    story.append(Spacer(1, 18))
    
    # === KEY FINDINGS ===
    story.append(Paragraph("9. Key Findings & Recommendations", heading1_style))
    
    findings = [
        "<b>E4 is the margin risk:</b> At $2.17 per session, E4 full sessions consume 58% of variable costs. Limit E4 access in lower tiers.",
        "<b>E1/E2 are highly profitable:</b> At ~3-5 cents per session, deck and script analysis offer 90%+ margins.",
        "<b>Payment processing varies by region:</b> Paystack saves 2.7% vs Stripe for African markets. Route users accordingly.",
        "<b>Infrastructure scales well:</b> Fixed costs of $44-74/month become negligible above 500 users ($0.09/user).",
        "<b>Recommended launch price:</b> $19/month for Professional tier maximizes margin while staying competitive.",
        "<b>Freemium strategy:</b> Free trial with 1 E1 + 1 E2 session costs ~$0.07 per acquisition - highly sustainable.",
    ]
    
    for finding in findings:
        story.append(Paragraph("• " + finding, body_style))
        story.append(Spacer(1, 4))
    
    # Build PDF
    doc.build(story)
    print("PDF generated successfully!")

if __name__ == "__main__":
    create_pdf()
