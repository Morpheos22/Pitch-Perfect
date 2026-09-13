"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight } from "lucide-react";

const blogPosts = [
  {
    title: "10 Tips for a Perfect Investor Pitch Deck",
    excerpt:
      "Learn the essential elements that make a pitch deck stand out to investors. From storytelling to data visualization, we cover everything you need to know.",
    date: "January 15, 2025",
    readTime: "8 min read",
    category: "Pitch Decks",
    slug: "10-tips-perfect-investor-pitch-deck",
  },
  {
    title: "How AI is Transforming Pitch Coaching",
    excerpt:
      "Discover how artificial intelligence is revolutionizing the way entrepreneurs prepare for investor meetings and pitch competitions.",
    date: "January 8, 2025",
    readTime: "6 min read",
    category: "AI & Technology",
    slug: "how-ai-transforming-pitch-coaching",
  },
  {
    title: "The Psychology of a Winning Elevator Pitch",
    excerpt:
      "Understanding the cognitive principles that make short pitches memorable and persuasive. Science-backed strategies for founders.",
    date: "December 20, 2024",
    readTime: "5 min read",
    category: "Communication",
    slug: "psychology-winning-elevator-pitch",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
          <div className="container mx-auto px-4 py-20 md:py-32 relative">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                PitchCoach Ai{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                  Blog
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Insights, tips, and strategies to help you master your pitch and
                secure funding for your startup.
              </p>
            </div>
          </div>
        </section>

        {/* Blog Posts */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="space-y-8">
                {blogPosts.map((post) => (
                  <Card
                    key={post.slug}
                    className="border-border hover:border-primary/50 transition-colors"
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">
                          {post.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {post.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.readTime}
                        </span>
                      </div>
                      <h2 className="text-xl font-semibold mb-2">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="hover:text-primary transition-colors"
                        >
                          {post.title}
                        </Link>
                      </h2>
                      <p className="text-muted-foreground mb-4">{post.excerpt}</p>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="text-primary hover:underline inline-flex items-center gap-1 text-sm font-medium"
                      >
                        Read more
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Coming Soon Notice */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-2xl font-bold mb-4">More Coming Soon</h2>
              <p className="text-muted-foreground mb-6">
                We're working on bringing you more valuable content about pitch
                techniques, investor insights, and startup success stories. Stay
                tuned!
              </p>
              <Link
                href="/contact"
                className="text-primary hover:underline font-medium"
              >
                Have a topic suggestion? Let us know →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
