"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  CheckCircle,
  Linkedin,
  Twitter,
  AlertCircle,
} from "lucide-react";
import { safeJson } from "@/lib/safe-fetch";

const contactMethods = [
  {
    icon: Mail,
    title: "Email Us",
    description: "For general inquiries and support",
    value: "hello@automagikal.co.za",
    href: "mailto:hello@automagikal.co.za",
  },
  {
    icon: Phone,
    title: "Call Us",
    description: "Mon-Fri, 9am-5pm SAST",
    value: "+27 77 440 4475",
    href: "tel:+27774404475",
  },
  {
    icon: MapPin,
    title: "Location",
    description: "Headquarters",
    value: "South Africa",
    href: null,
  },
  {
    icon: Clock,
    title: "Business Hours",
    description: "We respond within 24 hours",
    value: "Mon - Fri: 9:00 AM - 5:00 PM SAST",
    href: null,
  },
];

const socialLinks = [
  {
    icon: Linkedin,
    label: "LinkedIn",
    href: "https://linkedin.com/company/automagikal",
  },
  {
    icon: Twitter,
    label: "Twitter",
    href: "https://twitter.com/automagikal",
  },
];

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    company: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });

      const data = await safeJson(response);

      setIsSubmitted(true);
    } catch (error) {
      console.error("Contact form submission error:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to send message. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormState((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    // Clear error when user starts editing again
    if (submitError) setSubmitError(null);
  };

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
                Get in{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                  Touch
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Have a question about our services or want to discuss how we can
                help your business? We&apos;d love to hear from you.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Contact Methods */}
              <div className="lg:col-span-1">
                <h2 className="text-2xl font-bold mb-6">Contact Information</h2>
                <div className="space-y-6">
                  {contactMethods.map((method) => (
                    <div key={method.title} className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <method.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{method.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {method.description}
                        </p>
                        {method.href ? (
                          <a
                            href={method.href}
                            className="text-primary hover:underline"
                          >
                            {method.value}
                          </a>
                        ) : (
                          <p className="text-foreground">{method.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Social Links */}
                <div className="mt-8 pt-8 border-t border-border">
                  <h3 className="font-semibold mb-4">Follow Us</h3>
                  <div className="flex gap-4">
                    {socialLinks.map((social) => (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/10 transition-colors"
                        aria-label={social.label}
                      >
                        <social.icon className="h-5 w-5 text-muted-foreground hover:text-primary" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2">
                <Card className="border-border">
                  <CardContent className="pt-6">
                    {isSubmitted ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">
                          Message Sent!
                        </h3>
                        <p className="text-muted-foreground mb-6">
                          Thank you for reaching out. We&apos;ll get back to you within
                          24 hours.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsSubmitted(false);
                            setSubmitError(null);
                            setFormState({
                              name: "",
                              email: "",
                              company: "",
                              subject: "",
                              message: "",
                            });
                          }}
                        >
                          Send Another Message
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Banner */}
                        {submitError && (
                          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <p className="text-sm">{submitError}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="name">Full Name *</Label>
                            <Input
                              id="name"
                              name="name"
                              placeholder="John Smith"
                              value={formState.name}
                              onChange={handleChange}
                              required
                              disabled={isSubmitting}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address *</Label>
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              placeholder="john@example.com"
                              value={formState.email}
                              onChange={handleChange}
                              required
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="company">Company</Label>
                            <Input
                              id="company"
                              name="company"
                              placeholder="Your Company"
                              value={formState.company}
                              onChange={handleChange}
                              disabled={isSubmitting}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="subject">Subject *</Label>
                            <Input
                              id="subject"
                              name="subject"
                              placeholder="How can we help?"
                              value={formState.subject}
                              onChange={handleChange}
                              required
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="message">Message *</Label>
                          <Textarea
                            id="message"
                            name="message"
                            placeholder="Tell us more about your project or inquiry..."
                            rows={6}
                            value={formState.message}
                            onChange={handleChange}
                            required
                            minLength={10}
                            maxLength={5000}
                            disabled={isSubmitting}
                          />
                          <p className="text-xs text-muted-foreground text-right">
                            {formState.message.length}/5000 characters
                          </p>
                        </div>

                        <Button
                          type="submit"
                          size="lg"
                          disabled={isSubmitting}
                          className="w-full md:w-auto"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Message
                            </>
                          )}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Global Reach Section */}
        <section className="py-20 md:py-32 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Global Reach, Local Expertise
              </h2>
              <p className="text-lg text-muted-foreground mb-12">
                While we&apos;re headquartered in South Africa, we serve clients across
                Africa, the United Kingdom, and beyond.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card className="border-border bg-background">
                  <CardContent className="pt-6 text-center">
                    <MapPin className="h-8 w-8 text-primary mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">South Africa</h3>
                    <p className="text-sm text-muted-foreground">
                      Headquarters &amp; primary operations
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-background">
                  <CardContent className="pt-6 text-center">
                    <MapPin className="h-8 w-8 text-primary mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">African Markets</h3>
                    <p className="text-sm text-muted-foreground">
                      Active across the African continent
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-background">
                  <CardContent className="pt-6 text-center">
                    <MapPin className="h-8 w-8 text-primary mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">United Kingdom</h3>
                    <p className="text-sm text-muted-foreground">
                      Serving UK-based businesses
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
