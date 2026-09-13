"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";

const blogContent: Record<string, {
  title: string;
  date: string;
  readTime: string;
  category: string;
  excerpt: string;
  content: string[];
}> = {
  "10-tips-perfect-investor-pitch-deck": {
    title: "10 Tips for a Perfect Investor Pitch Deck",
    date: "January 15, 2025",
    readTime: "8 min read",
    category: "Pitch Decks",
    excerpt:
      "Learn the essential elements that make a pitch deck stand out to investors.",
    content: [
      "A great pitch deck is your gateway to funding, partnerships, and growth. Whether you're a first-time founder or a seasoned entrepreneur, the quality of your pitch deck can make or break your fundraising efforts. In this article, we walk through the ten most critical tips that separate mediocre decks from those that capture investor attention and drive meaningful conversations.",
      "Tip 1: Start with a compelling problem statement. Investors want to understand the pain point you're solving before they care about your solution. Frame the problem in terms of market size, frequency, and urgency. Use data to demonstrate that this isn't a niche issue but something affecting a large, addressable market segment.",
      "Tip 2: Keep it to 10-12 slides maximum. Attention spans are short, and investors review hundreds of decks. Every slide must earn its place. The standard framework includes: Problem, Solution, Market Size, Business Model, Go-to-Market Strategy, Competitive Landscape, Team, Traction, and Ask. Anything beyond this risks diluting your core message.",
      "Tip 3: Show, don't tell. Replace bullet points with visuals wherever possible. Use charts for market data, diagrams for business models, and timelines for your roadmap. A well-designed slide communicates more in 3 seconds than a paragraph of text can in 30 seconds of reading.",
      "Tip 4: Quantify your market opportunity. Investors want to see TAM, SAM, and SOM figures that are backed by credible sources. Generic claims like 'a billion-dollar market' aren't enough. Break down your market with bottom-up analysis that demonstrates realistic penetration rates and revenue potential.",
      "Tip 5: Highlight your team's unfair advantage. Why is your team the right one to solve this problem? Highlight relevant experience, domain expertise, and previous successes. Investors invest in people first and ideas second. Show track records, not just job titles.",
      "Tip 6: Include a clear ask on the final slide. State exactly how much you're raising, what you'll use it for, and what milestones it will help you achieve. Vague asks like 'we're looking for strategic partners' signal that you haven't thought through your capital needs.",
      "Tip 7: Use consistent, professional design. Your deck is a reflection of your brand. Use a consistent color palette, typography, and layout throughout. Avoid cluttered slides with too much text. If design isn't your strength, use templates or hire a designer — it's a worthwhile investment.",
      "Tip 8: Tell a story, not just facts. Structure your deck as a narrative arc. Start with the problem (the villain), introduce your solution (the hero), show the market opportunity (the kingdom), and end with your ask (the call to action). Stories are memorable; bullet points are forgettable.",
      "Tip 9: Anticipate questions and address them proactively. Include a competitive analysis slide, address potential objections in your market sizing, and acknowledge risks with mitigation strategies. Investors will probe weaknesses — better to address them upfront than appear unprepared.",
      "Tip 10: Practice your delivery relentlessly. A great deck delivered poorly will lose to a good deck delivered confidently. Rehearse your timing, anticipate questions, and get feedback from mentors and advisors before presenting to investors. The PitchCoach Ai Deck Analyser can help you identify weaknesses before you step into the room.",
    ],
  },
  "how-ai-transforming-pitch-coaching": {
    title: "How AI is Transforming Pitch Coaching",
    date: "January 8, 2025",
    readTime: "6 min read",
    category: "AI & Technology",
    excerpt:
      "Discover how artificial intelligence is revolutionizing pitch preparation.",
    content: [
      "The landscape of startup fundraising has changed dramatically over the past decade, and one of the most significant shifts has been the introduction of artificial intelligence into the pitch coaching process. What was once the exclusive domain of expensive consultants and accelerator programs is now accessible to any founder with an internet connection.",
      "Traditional pitch coaching suffers from several limitations: it's expensive (often $500-2000 per session), it's subjective (different coaches give conflicting advice), and it's difficult to scale (a coach can only review so many decks per week). AI-powered coaching addresses all three of these pain points simultaneously.",
      "Modern AI pitch coaching platforms like PitchCoach Ai analyze your deck against proven frameworks, scoring each slide on content quality, visual design, and narrative flow. The AI has been trained on thousands of successful pitch decks, giving it a pattern recognition capability that no single human coach can match. It can identify missing elements, weak value propositions, and unclear market positioning in seconds.",
      "Beyond deck analysis, AI is now being used for script coaching. By analyzing your elevator pitch text against communication science principles, AI can evaluate your hook strength, problem-solution alignment, target audience fit, and overall persuasiveness. This kind of granular, element-by-element feedback was previously impossible at scale.",
      "The most exciting frontier is live delivery coaching. Using computer vision and NLP, AI can analyze recorded pitch videos for body language, vocal pacing, filler word usage, and emotional expressiveness. This real-time feedback loop allows founders to iterate rapidly, recording multiple takes and seeing their scores improve with each attempt.",
      "Looking ahead, AI pitch coaching will become increasingly personalized. By analyzing your industry, stage, and target investor profile, AI will tailor its feedback to the specific expectations of your audience. A seed-stage healthtech founder pitching to a specialized fund will receive fundamentally different feedback than a Series B SaaS founder pitching to a generalist VC.",
      "The bottom line for founders is clear: AI is not replacing human judgment in fundraising, but it is dramatically raising the floor. Founders who leverage AI coaching tools are entering investor meetings better prepared, more confident, and with stronger materials than those who don't. In a competitive funding environment, that edge can be the difference between getting funded and coming up empty.",
    ],
  },
  "psychology-winning-elevator-pitch": {
    title: "The Psychology of a Winning Elevator Pitch",
    date: "December 20, 2024",
    readTime: "5 min read",
    category: "Communication",
    excerpt:
      "Understanding cognitive principles that make short pitches memorable.",
    content: [
      "The human brain processes approximately 11 million bits of sensory information per second, but our conscious minds can only handle about 50 bits per second. When you have 60 seconds to deliver an elevator pitch, you're competing for a tiny fraction of someone's cognitive bandwidth. Understanding the psychology behind what makes pitches stick is your greatest competitive advantage.",
      "The primacy effect tells us that people remember what they hear first. Your opening line — the hook — is the single most important element of your pitch. Research shows you have roughly 7 seconds to capture someone's attention before their mind starts wandering. Effective hooks create a knowledge gap (triggering curiosity), use concrete numbers (making the problem tangible), or tell a brief story (activating the listener's narrative processing center).",
      "Cognitive load theory explains why simpler pitches win. When an investor has to work hard to understand your business model, they experience cognitive strain, which they attribute to your idea being complicated or unclear — even if it's actually brilliant. The best pitches use familiar analogies ('We're the Airbnb for warehouse space') to reduce cognitive load and create instant understanding.",
      "The peak-end rule, discovered by psychologist Daniel Kahneman, states that people judge an experience based on how they felt at the peak moment and at the end, rather than the average of every moment. In pitch terms, this means your strongest argument (the peak) should come in the middle, and your closing (the end) should be your most memorable line. Many founders front-load their best material and fade at the end — a psychological mistake.",
      "Social proof is one of the most powerful persuasion triggers identified by Robert Cialdini. Including credible statistics, named customers, investor logos, or reputable advisors in your pitch activates the listener's herd instinct. When you say 'Three Fortune 500 companies are already using our platform,' the listener's brain automatically thinks 'if these successful organizations chose this, it must be good.'",
      "Finally, the concept of loss aversion suggests that people are roughly twice as motivated by avoiding loss as by acquiring gain. Instead of framing your pitch purely as an opportunity ('investors could make 10x returns'), frame it as a risk of missing out ('three major competitors are already moving into this space, and early movers will capture the majority of market share'). This subtle reframing can dramatically increase conversion rates.",
      "Understanding these psychological principles isn't about manipulation — it's about clear communication. Your idea deserves to be understood. By aligning your pitch with how the human brain naturally processes information, you ensure that your message lands with maximum impact in the minimal time available.",
    ],
  },
};

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const post = blogContent[slug];

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Post Not Found</h1>
            <p className="text-muted-foreground">
              This blog post doesn&apos;t exist yet.
            </p>
            <Link href="/blog">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Blog
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 py-12 md:py-20">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Blog
          </Link>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">
              {post.category}
            </span>
            <span>{post.date}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readTime}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
            {post.title}
          </h1>

          {/* Excerpt */}
          <p className="text-lg text-muted-foreground mb-8 border-l-4 border-primary/30 pl-4">
            {post.excerpt}
          </p>

          {/* Content */}
          <div className="prose prose-neutral max-w-none">
            {post.content.map((paragraph, index) => (
              <p key={index} className="text-muted-foreground leading-relaxed mb-6">
                {paragraph}
              </p>
            ))}
          </div>

          {/* CTA */}
          <Card className="mt-12 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
            <CardContent className="py-8 text-center">
              <h3 className="text-xl font-bold mb-2">
                Ready to put these tips into practice?
              </h3>
              <p className="text-muted-foreground mb-4">
                Upload your pitch deck or script and get AI-powered feedback in minutes.
              </p>
              <Link href="/sign-up">
                <Button className="bg-primary hover:bg-primary/90">
                  Get Started Free
                </Button>
              </Link>
            </CardContent>
          </Card>
        </article>
      </main>

      <Footer />
    </div>
  );
}
