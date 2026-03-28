"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Users, Lightbulb, Heart, Globe, Award } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Simplicity First",
    description:
      "We believe the best solutions are elegantly simple. We strip away complexity to deliver systems that actually work in the real world, not just on paper. Our approach focuses on making complex business challenges manageable and actionable for teams of all sizes.",
  },
  {
    icon: Lightbulb,
    title: "Innovation with Purpose",
    description:
      "We leverage cutting-edge technology and methodologies, but never for their own sake. Every solution we implement serves a clear business purpose and delivers measurable results. We combine design thinking with robust analysis to create solutions that stick.",
  },
  {
    icon: Users,
    title: "People-Centered Approach",
    description:
      "Technology and processes are only as good as the people using them. We design systems that your team will actually adopt and love. Our focus on team enablement ensures that changes last long after our engagement ends.",
  },
  {
    icon: Heart,
    title: "Partnership Mindset",
    description:
      "We're not just consultants - we're partners in your success. We invest deeply in understanding your unique challenges and work alongside you to build solutions that drive real growth. Your wins are our wins.",
  },
  {
    icon: Globe,
    title: "Global Perspective, Local Insight",
    description:
      "Based in South Africa with reach across Africa, the UK, and beyond, we bring a unique blend of global best practices and deep local market understanding to every engagement.",
  },
  {
    icon: Award,
    title: "Excellence in Execution",
    description:
      "We don't just advise - we help you implement. Our hands-on approach ensures that strategies translate into action, and action delivers results. We measure our success by the tangible improvements we create for your business.",
  },
];

const milestones = [
  {
    year: "Founded",
    title: "AutomagiKal is Born",
    description:
      "Established with a mission to help growing businesses build scalable systems without losing the entrepreneurial spark that got them started.",
  },
  {
    year: "Expansion",
    title: "African & UK Markets",
    description:
      "Extended operations across South Africa, other African countries, and the United Kingdom, serving ambitious businesses globally.",
  },
  {
    year: "Innovation",
    title: "AI-Powered Solutions",
    description:
      "Launched Pitch Perfect, an AI-powered pitch coaching platform helping founders and entrepreneurs master their pitch with confidence.",
  },
  {
    year: "Today",
    title: "Continued Growth",
    description:
      "Coaching leaders, training managers, shifting cultures, and consulting on systems and process development for businesses ready to scale.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#4ECDC4]/10 via-white to-[#FF6B6B]/5" />
          <div className="container mx-auto px-4 py-20 md:py-32 relative">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 font-heading text-[#2D3748]">
                About{" "}
                <span className="text-[#4ECDC4]">
                  AutomagiKal
                </span>
              </h1>
              <p className="text-lg md:text-xl text-[#718096] max-w-3xl mx-auto">
                We help ambitious businesses build scalable systems—without losing
                the spark that got them started. We work with founders and teams
                moving from grit to growth, helping them create sustainable success
                through smarter processes and enabled teams.
              </p>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-20 md:py-32 bg-[#F7FAFA]">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading text-[#2D3748]">Our Mission</h2>
                <div className="w-20 h-1 bg-[#4ECDC4] mx-auto rounded-full" />
              </div>
              <div className="prose prose-lg max-w-none text-center">
                <p className="text-lg text-[#718096] leading-relaxed">
                  At AutomagiKal, we coach leaders, train managers, shift cultures,
                  and consult on systems and process development. We streamline
                  sales, marketing, customer, and culture systems for ambitious
                  businesses in South Africa, other African countries, the United
                  Kingdom, and beyond—using design thinking, robust analysis, great
                  software, and team enablement that sticks.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading text-[#2D3748]">Our Values</h2>
              <p className="text-[#718096] max-w-2xl mx-auto">
                The principles that guide everything we do
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((value) => (
                <Card
                  key={value.title}
                  className="border-[#E2E8F0] hover:border-[#4ECDC4] transition-colors"
                >
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-xl bg-[#4ECDC4]/10 flex items-center justify-center mb-4">
                      <value.icon className="h-6 w-6 text-[#4ECDC4]" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 font-heading text-[#2D3748]">{value.title}</h3>
                    <p className="text-[#718096]">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Journey Section */}
        <section className="py-20 md:py-32 bg-[#F7FAFA]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading text-[#2D3748]">Our Journey</h2>
              <p className="text-[#718096] max-w-2xl mx-auto">
                Building systems that help businesses win
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              {milestones.map((milestone, index) => (
                <div key={milestone.title} className="relative pl-8 pb-12 last:pb-0">
                  {/* Timeline line */}
                  {index !== milestones.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-[#E2E8F0]" />
                  )}
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-[#4ECDC4]/10 border-2 border-[#4ECDC4] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#4ECDC4]" />
                  </div>
                  <div className="ml-4">
                    <span className="text-sm font-medium text-[#FF6B6B]">
                      {milestone.year}
                    </span>
                    <h3 className="text-xl font-semibold mt-1 mb-2 font-heading text-[#2D3748]">
                      {milestone.title}
                    </h3>
                    <p className="text-[#718096]">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pitch Perfect Section */}
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading text-[#2D3748]">
                Pitch Perfect: Our AI Innovation
              </h2>
              <p className="text-lg text-[#718096] mb-8">
                Pitch Perfect represents our commitment to leveraging AI for
                practical business solutions. This platform helps founders and
                entrepreneurs master their pitch through intelligent coaching,
                providing expert-level feedback on pitch decks, scripts, and
                delivery.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <Card className="border-[#E2E8F0]">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2 font-heading text-[#2D3748]">Deck Analysis</h3>
                    <p className="text-sm text-[#718096]">
                      AI-powered pitch deck scoring against proven frameworks with
                      actionable improvement recommendations.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-[#E2E8F0]">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2 font-heading text-[#2D3748]">Script Coaching</h3>
                    <p className="text-sm text-[#718096]">
                      Element-by-element feedback on elevator pitches and
                      presentations with rewrite suggestions.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-[#E2E8F0]">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2 font-heading text-[#2D3748]">Live Practice</h3>
                    <p className="text-sm text-[#718096]">
                      Record your pitch and receive AI coaching on delivery,
                      body language, and presentation skills.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-32 bg-[#F7FAFA]">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading text-[#2D3748]">
                Ready to Transform Your Business?
              </h2>
              <p className="text-lg text-[#718096] mb-8">
                Let&apos;s discuss how we can help you build scalable systems that
                preserve what makes your business special.
              </p>
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-md bg-[#FF6B6B] px-6 py-3 text-sm font-medium text-white hover:bg-[#E85555] transition-colors"
              >
                Get in Touch
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
