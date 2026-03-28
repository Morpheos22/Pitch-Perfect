"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Globe, Target, CheckCircle } from "lucide-react";

const COUNTRIES = [
  "South Africa",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Netherlands",
  "Singapore",
  "India",
  "Nigeria",
  "Kenya",
  "Other",
];

const USE_CASES = [
  { id: "startup-founder", label: "Startup Founder", description: "Raising capital from investors" },
  { id: "sales-professional", label: "Sales Professional", description: "Closing deals and presentations" },
  { id: "entrepreneur", label: "Entrepreneur", description: "Building and pitching new ventures" },
  { id: "consultant", label: "Consultant", description: "Client presentations and proposals" },
  { id: "student", label: "Student", description: "Academic presentations and competitions" },
  { id: "executive", label: "Executive", description: "Board presentations and strategic pitches" },
  { id: "other", label: "Other", description: "Personal development and practice" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [country, setCountry] = useState("");
  const [primaryUseCase, setPrimaryUseCase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleComplete = async () => {
    if (!country || !primaryUseCase) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Save to database via API
      const response = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, primaryUseCase }),
      });

      if (!response.ok) {
        throw new Error("Failed to save onboarding data");
      }

      // Update Clerk public metadata
      await user?.update({
        publicMetadata: {
          ...user.publicMetadata,
          country,
          primaryUseCase,
          onboardingCompleted: true,
        },
      });

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Onboarding error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-slate-700 bg-slate-800/50 backdrop-blur">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-3xl">🎤</span>
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Welcome to Pitch Perfect!
          </CardTitle>
          <CardDescription className="text-slate-400">
            Let's personalize your experience
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-10 h-1 rounded-full transition-colors ${
                  s <= step ? "bg-indigo-500" : "bg-slate-600"
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-lg">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Where are you based?</h3>
                  <p className="text-sm text-slate-400">This helps us tailor your experience</p>
                </div>
              </div>

              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => setStep(2)}
                disabled={!country}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">What's your primary goal?</h3>
                  <p className="text-sm text-slate-400">We'll customize your coaching journey</p>
                </div>
              </div>

              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {USE_CASES.map((uc) => (
                  <button
                    key={uc.id}
                    onClick={() => setPrimaryUseCase(uc.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      primaryUseCase === uc.id
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{uc.label}</p>
                        <p className="text-sm text-slate-400">{uc.description}</p>
                      </div>
                      {primaryUseCase === uc.id && (
                        <CheckCircle className="w-5 h-5 text-indigo-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!primaryUseCase}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <div className="py-6">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">You're all set!</h3>
                <p className="text-slate-400">
                  Ready to start your pitch coaching journey
                </p>
              </div>

              <div className="p-4 bg-slate-700/30 rounded-lg text-left space-y-2">
                <p className="text-sm text-slate-400">Your selections:</p>
                <p className="text-white">📍 {country}</p>
                <p className="text-white">🎯 {USE_CASES.find((u) => u.id === primaryUseCase)?.label}</p>
              </div>

              <Button
                onClick={handleComplete}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  "Start Pitching!"
                )}
              </Button>
            </div>
          )}

          {/* Footer branding */}
          <div className="pt-6 border-t border-slate-700 text-center">
            <p className="text-sm text-slate-500">
              Built by{" "}
              <a
                href="https://automagikal.co.za/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                AutomagiKal
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
