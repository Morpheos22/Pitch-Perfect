"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Video,
  ArrowRight,
  Plus,
  History,
  BarChart3,
  CheckCircle,
  Mic,
} from "lucide-react";
import Link from "next/link";

interface RecentVideo {
  id: string;
  duration: number;
  overallDeliveryScore: number | null;
  overallBodyLanguageScore: number | null;
  status: string;
  createdAt: string;
}

export default function ElevatorPitchLivePage() {
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/history?limit=5&type=video");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.videos) {
          setRecentVideos(json.data.videos);
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  function getScoreColor(score: number | null) {
    if (score == null) return "text-muted-foreground";
    if (score >= 70) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    return "text-destructive";
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Video className="w-6 h-6 text-orange-500" />
          </div>
          Live Pitch
        </h1>
        <p className="text-muted-foreground mt-1">
          Script coaching plus live recording with delivery feedback
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/elevator-pitch-live/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group border-orange-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                  <Plus className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-base">New Live Session</CardTitle>
                  <CardDescription>Record your pitch live</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Start a new session — submit your script, then record your 3-minute
                pitch for delivery and body language analysis.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/elevator-pitch-live/live/review">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted group-hover:bg-muted/80 transition-colors">
                  <History className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Review</CardTitle>
                  <CardDescription>Review past recordings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Watch your previous recordings and review the AI coaching feedback
                on delivery, body language, and pacing.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/elevator-pitch-live/upgrade">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group border-orange-500/10">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                  <BarChart3 className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Upgrade</CardTitle>
                  <CardDescription>Unlock live sessions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Live pitch recording is available on Starter plan and above. Upgrade
                to access this feature.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Info Card */}
      <Card className="border-orange-500/10 bg-gradient-to-r from-orange-500/5 to-transparent">
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Mic className="w-5 h-5 text-orange-500" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">What you get</h3>
              <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Script coaching (element analysis)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>3-minute live recording</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Delivery &amp; body language scoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Before/after comparison</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Recordings</h2>
          {recentVideos.length > 0 && (
            <Link href="/history" className="text-sm text-orange-500 hover:underline">
              View all
            </Link>
          )}
        </div>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Video className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No live recordings yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Record your first elevator pitch to get delivery feedback
                </p>
                <Link href="/elevator-pitch-live/new">
                  <Button size="sm" className="gap-2 bg-orange-500 hover:bg-orange-600 text-white">
                    <Plus className="w-4 h-4" />
                    New Live Session
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {recentVideos.map((video) => (
                  <Link
                    key={video.id}
                    href={`/elevator-pitch-live/live/session/${video.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <Video className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {video.duration ? `${Math.round(video.duration / 60)}s recording` : "Live Recording"}
                        </p>
                        <p className="text-sm text-muted-foreground">{formatDate(video.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-bold ${getScoreColor(video.overallDeliveryScore)}`}>
                          {video.overallDeliveryScore != null ? (
                            <><span>{video.overallDeliveryScore}</span><span className="text-muted-foreground text-sm">/100</span></>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">Delivery</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
