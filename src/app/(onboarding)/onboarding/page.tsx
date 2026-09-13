"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, User, MapPin, Briefcase, Target, Rocket, Globe } from "lucide-react";

const COUNTRIES = [
  "Nigeria", "Ghana", "Kenya", "South Africa", "Egypt", "Morocco", "Tunisia",
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
  "Spain", "Italy", "Netherlands", "Belgium", "Switzerland", "Sweden", "Norway",
  "Denmark", "Finland", "Ireland", "Portugal", "Austria", "Poland", "Brazil",
  "Argentina", "Mexico", "Chile", "Colombia", "Peru", "India", "China", "Japan",
  "South Korea", "Singapore", "Malaysia", "Indonesia", "Thailand", "Vietnam",
  "Philippines", "UAE", "Saudi Arabia", "Qatar", "Israel", "Turkey", "Other",
];

const ROLES = [
  "Founder / CEO",
  "Co-founder",
  "CTO / Technical Lead",
  "CMO / Marketing Lead",
  "CFO / Finance Lead",
  "Product Manager",
  "Software Engineer",
  "Designer",
  "Sales / Business Development",
  "Investor",
  "Mentor / Advisor",
  "Student",
  "Researcher",
  "Other",
];

const STAGES = [
  "Idea stage — no product yet",
  "Pre-seed — building MVP",
  "Seed — launched, early users",
  "Series A — scaling",
  "Series B+ — growth stage",
  "Bootstrapped — self-funded",
  "Student / Learning",
  "Researching / Exploring",
];

const USE_CASES = [
  "Raising pre-seed funding",
  "Raising seed funding",
  "Raising Series A+",
  "Demo day preparation",
  "Accelerator application (YC, Techstars, 500)",
  "Investor pitch practice",
  "Sales pitch improvement",
  "Learning / skill building",
  "Competition / hackathon",
];

const TEAM_SIZES = [
  "Solo founder",
  "2-3 people",
  "4-10 people",
  "11-25 people",
  "26-50 people",
  "51-100 people",
  "100+ people",
];

const INDUSTRIES = [
  "Fintech", "Healthtech", "Edtech", "Agtech", "Cleantech / Climate",
  "AI / ML", "SaaS / B2B", "E-commerce / Retail", "Marketplace",
  "Gaming / Entertainment", "Media / Content", "Social / Community",
  "Logistics / Supply Chain", "Real Estate / PropTech",
  "Legal / RegTech", "Cybersecurity", "Web3 / Crypto",
  "Hardware / IoT", "Biotech / Life Sciences",
  "Government / Civic Tech", "Non-profit / Social Impact",
  "Other",
];

export default function OnboardingPage() {
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    bio: "",
    country: "",
    role: "",
    organisation: "",
    stage: "",
    useCase: "",
    teamSize: "",
    industry: "",
    linkedinUrl: "",
    websiteUrl: "",
  });

  const totalSteps = 4;

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Update Clerk user metadata
        await user?.update({
          firstName: formData.firstName,
          lastName: formData.lastName,
          unsafeMetadata: {
            bio: formData.bio,
            country: formData.country,
            role: formData.role,
            organisation: formData.organisation,
            stage: formData.stage,
            useCase: formData.useCase,
            teamSize: formData.teamSize,
            industry: formData.industry,
            linkedinUrl: formData.linkedinUrl,
            websiteUrl: formData.websiteUrl,
            onboardingCompleted: true,
          },
        });

        window.location.href = "/dashboard";
      } else {
        console.error("Onboarding failed");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return formData.firstName && formData.lastName && formData.bio;
    if (step === 2) return formData.country && formData.role;
    if (step === 3) return formData.stage && formData.useCase;
    if (step === 4) return formData.industry && formData.teamSize;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="p-4 flex items-center justify-between">
        <span className="font-bold text-xl text-primary">
          Pitch<span className="text-secondary">Coach</span> Ai
        </span>
        <div className="text-sm text-muted-foreground">
          Step {step} of {totalSteps}
        </div>
      </header>

      {/* Progress bar */}
      <div className="px-4 mb-8">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === 1 && <><User className="w-5 h-5 text-primary" /> Tell us about yourself</>}
              {step === 2 && <><Briefcase className="w-5 h-5 text-primary" /> Your role & location</>}
              {step === 3 && <><Target className="w-5 h-5 text-primary" /> What are you building?</>}
              {step === 4 && <><Rocket className="w-5 h-5 text-primary" /> Almost there</>}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Help us personalize your coaching experience."}
              {step === 2 && "Where are you based and what do you do?"}
              {step === 3 && "Tell us about your startup journey."}
              {step === 4 && "Last few details to set up your profile."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Personal info + bio */}
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                      placeholder="David"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                      placeholder="Akanimoh"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="bio">Bio * — Tell us about yourself</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => updateField("bio", e.target.value)}
                    placeholder="I'm a builder passionate about solving problems in African markets. Currently working on..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This helps our AI tailor feedback to your background and experience.
                  </p>
                </div>
              </>
            )}

            {/* Step 2: Country + Role */}
            {step === 2 && (
              <>
                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Select value={formData.country} onValueChange={(v) => updateField("country", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="role">Your Role *</Label>
                  <Select value={formData.role} onValueChange={(v) => updateField("role", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="What best describes your role?" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="organisation">Organisation / Institution</Label>
                  <Input
                    id="organisation"
                    value={formData.organisation}
                    onChange={(e) => updateField("organisation", e.target.value)}
                    placeholder="e.g., Athena Agentic, Y Combinator, University of Lagos"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Your company, startup, accelerator, or learning institution.
                  </p>
                </div>
              </>
            )}

            {/* Step 3: Stage + Use case */}
            {step === 3 && (
              <>
                <div>
                  <Label htmlFor="stage">What stage are you at? *</Label>
                  <Select value={formData.stage} onValueChange={(v) => updateField("stage", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your current stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="useCase">What do you need PitchCoach for? *</Label>
                  <Select value={formData.useCase} onValueChange={(v) => updateField("useCase", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your primary goal" />
                    </SelectTrigger>
                    <SelectContent>
                      {USE_CASES.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Step 4: Industry + team + social */}
            {step === 4 && (
              <>
                <div>
                  <Label htmlFor="industry">Industry / Sector *</Label>
                  <Select value={formData.industry} onValueChange={(v) => updateField("industry", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="teamSize">Team Size *</Label>
                  <Select value={formData.teamSize} onValueChange={(v) => updateField("teamSize", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="How many people are on your team?" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_SIZES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="linkedinUrl">LinkedIn Profile</Label>
                    <Input
                      id="linkedinUrl"
                      value={formData.linkedinUrl}
                      onChange={(e) => updateField("linkedinUrl", e.target.value)}
                      placeholder="linkedin.com/in/username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="websiteUrl">Website / Portfolio</Label>
                    <Input
                      id="websiteUrl"
                      value={formData.websiteUrl}
                      onChange={(e) => updateField("websiteUrl", e.target.value)}
                      placeholder="yourcompany.com"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  disabled={loading}
                >
                  Back
                </Button>
              )}
              {step < totalSteps ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="ml-auto"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || loading}
                  className="ml-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Complete Setup
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
