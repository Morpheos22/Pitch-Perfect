from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Register fonts
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# Create document
doc = SimpleDocTemplate(
    "/home/z/my-project/download/PitchCoach_Vercel_Env_Vars.pdf",
    pagesize=letter,
    title="PitchCoach Vercel Environment Variables",
    author="Z.ai",
    creator="Z.ai",
    subject="Environment variables for Vercel deployment"
)

story = []

# Title style
title_style = ParagraphStyle(
    name='TitleStyle',
    fontName='Times New Roman',
    fontSize=18,
    textColor=colors.HexColor('#334B79'),
    alignment=TA_CENTER,
    spaceAfter=12
)

# Subtitle style
subtitle_style = ParagraphStyle(
    name='SubtitleStyle',
    fontName='Times New Roman',
    fontSize=12,
    textColor=colors.HexColor('#666666'),
    alignment=TA_CENTER,
    spaceAfter=24
)

# Key style
key_style = ParagraphStyle(
    name='KeyStyle',
    fontName='DejaVuSans',
    fontSize=9,
    textColor=colors.HexColor('#334B79'),
    alignment=TA_LEFT
)

# Value style
value_style = ParagraphStyle(
    name='ValueStyle',
    fontName='DejaVuSans',
    fontSize=8,
    textColor=colors.black,
    alignment=TA_LEFT
)

# Add title
story.append(Paragraph("<b>PitchCoach AI</b>", title_style))
story.append(Paragraph("Vercel Environment Variables", subtitle_style))
story.append(Spacer(1, 12))

# Environment variables
env_vars = [
    ("DATABASE_URL", "postgresql://pitchcoach_app:***REDACTED_DB_PASSWORD_URL***@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"),
    ("DIRECT_URL", "postgresql://postgres.iwbshmshegewmctfucaz:***REDACTED_SUPABASE_PASSWORD_URL***%21%21@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"),
    ("SUPABASE_URL", "https://iwbshmshegewmctfucaz.supabase.co"),
    ("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3YnNobXNoZWdld21jdGZ1Y2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDQ3MzUsImV4cCI6MjA4OTQ4MDczNX0.v-DnhoehZ9TA_osGhN83vaL0JAJIbMbEHrDsOyvY0Sw"),
    ("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3YnNobXNoZWdld21jdGZ1Y2F6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkwNDczNSwiZXhwIjoyMDg5NDgwNzM1fQ.907xFfFoIjooI7gCzhKcpQCvF_mY4TgBjFe_cmmjn8s"),
    ("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_Y29udGVudC1ib2EtNDYuY2xlcmsuYWNjb3VudHMuZGV2JA"),
    ("CLERK_SECRET_KEY", "***REDACTED_CLERK_TEST_SECRET***"),
    ("NEXT_PUBLIC_CLERK_SIGN_IN_URL", "/sign-in"),
    ("NEXT_PUBLIC_CLERK_SIGN_UP_URL", "/sign-up"),
    ("NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL", "/dashboard"),
    ("NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL", "/dashboard"),
    ("NEXT_PUBLIC_APP_URL", "https://your-app.vercel.app"),
]

# Table header style
header_style = ParagraphStyle(
    name='HeaderStyle',
    fontName='Times New Roman',
    fontSize=10,
    textColor=colors.white,
    alignment=TA_CENTER
)

# Build table data
table_data = [
    [Paragraph("<b>Key</b>", header_style), Paragraph("<b>Value</b>", header_style)]
]

for key, value in env_vars:
    table_data.append([
        Paragraph(key, key_style),
        Paragraph(value, value_style)
    ])

# Create table
col_widths = [2.5*inch, 4.5*inch]
table = Table(table_data, colWidths=col_widths)

table.setStyle(TableStyle([
    # Header
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334B79')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    # Alternating rows
    ('BACKGROUND', (0, 1), (-1, 1), colors.white),
    ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
    ('BACKGROUND', (0, 3), (-1, 3), colors.white),
    ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#F5F5F5')),
    ('BACKGROUND', (0, 5), (-1, 5), colors.white),
    ('BACKGROUND', (0, 6), (-1, 6), colors.HexColor('#F5F5F5')),
    ('BACKGROUND', (0, 7), (-1, 7), colors.white),
    ('BACKGROUND', (0, 8), (-1, 8), colors.HexColor('#F5F5F5')),
    ('BACKGROUND', (0, 9), (-1, 9), colors.white),
    ('BACKGROUND', (0, 10), (-1, 10), colors.HexColor('#F5F5F5')),
    ('BACKGROUND', (0, 11), (-1, 11), colors.white),
    ('BACKGROUND', (0, 12), (-1, 12), colors.HexColor('#F5F5F5')),
    # Grid
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))

story.append(table)
story.append(Spacer(1, 24))

# Instructions
instruction_style = ParagraphStyle(
    name='InstructionStyle',
    fontName='Times New Roman',
    fontSize=10,
    textColor=colors.HexColor('#333333'),
    alignment=TA_LEFT
)

story.append(Paragraph("<b>Instructions:</b>", instruction_style))
story.append(Spacer(1, 6))
story.append(Paragraph("1. In Vercel, go to your project Settings - Environment Variables", instruction_style))
story.append(Paragraph("2. Click 'Import .env File' and paste the variables above", instruction_style))
story.append(Paragraph("3. Update NEXT_PUBLIC_APP_URL with your actual Vercel URL after deployment", instruction_style))
story.append(Spacer(1, 12))
story.append(Paragraph("<b>Build Command:</b> prisma generate && next build", instruction_style))

# Build PDF
doc.build(story)
print("PDF created successfully")
