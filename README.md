# PitchCoach AI

AI-powered pitch coaching platform for founders and entrepreneurs.

## 🚀 Features

### Four Coaching Modules

1. **E1: Pitch Deck Analyser** - Upload your deck for comprehensive content and visual analysis
2. **E2: Script Coach** - Perfect your elevator pitch with AI-powered script analysis
3. **E3: Live Pitch Coach** - Record a 3-minute pitch for delivery and body language feedback
4. **E4: Full Pitch Session** - Complete 30-minute session with deck and video analysis

## 🛠 Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Supabase)
- **Storage**: Cloudflare R2 (files), Cloudflare Stream (video)
- **AI**: Claude Sonnet (text), Gemini (video)
- **Auth**: Clerk
- **Billing**: Stripe

## 📦 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase account)
- Clerk account for authentication
- API keys for AI providers

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Morpheos22/pitchcoach-ai.git
cd pitchcoach-ai
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your values
```

4. Run database migrations:
```bash
bun run db:push
```

5. Start the development server:
```bash
bun run dev
```

## 🔑 Environment Variables

See `.env.example` for all required environment variables.

### Database Setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Project Settings > Database
3. Copy the connection string (use Transaction pooler for Vercel)
4. Add to `DATABASE_URL` in `.env`

### Clerk Authentication

1. Create an app at [clerk.com](https://clerk.com)
2. Copy the publishable key and secret key
3. Configure OAuth providers (Google, LinkedIn) in Clerk dashboard

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/          # Authentication pages
│   ├── (dashboard)/     # Dashboard and coaching modules
│   └── api/             # API routes
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── layout/          # Layout components
│   └── coach/           # Coaching module components
└── lib/
    ├── ai/              # AI integration utilities
    ├── db.ts            # Prisma client
    └── utils.ts         # Utility functions
prisma/
└── schema.prisma        # Database schema
```

## 🗄️ Database Schema

The application uses the following main models:

- `User` - User accounts and profile
- `Subscription` - Subscription and billing info
- `Usage` - Monthly usage tracking
- `PitchDeck` - E1: Deck analysis records
- `PitchScript` - E2: Script coaching sessions
- `PitchVideo` - E3: Live pitch recordings
- `FullPitchSession` - E4: Complete pitch sessions

## 🚢 Deployment

### Vercel (Recommended)

1. Connect your GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy!

### Important Notes

- Use Supabase Transaction pooler connection string for serverless
- Configure Clerk production keys for production
- Set up Stripe webhooks for billing

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines.

