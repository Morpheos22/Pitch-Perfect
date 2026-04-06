"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, type LucideIcon } from "lucide-react";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  status?: "active" | "coming_soon" | "completed";
  completed?: boolean;
}

export function ModuleCard({
  title,
  description,
  icon: Icon,
  href,
  color,
  badge,
  badgeVariant = "secondary",
  status = "active",
  completed = false,
}: ModuleCardProps) {
  return (
    <Card className={`group hover:shadow-md transition-all duration-200 ${status === "coming_soon" ? "opacity-70" : ""}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-lg ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2">
            {completed && (
              <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-500">
                Completed
              </Badge>
            )}
            {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
          </div>
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {status === "coming_soon" ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Coming soon</span>
            <Badge variant="outline" className="text-xs">Soon</Badge>
          </div>
        ) : (
          <Link href={href}>
            <Button
              size="sm"
              className="gap-1 w-full bg-primary hover:bg-primary/90"
            >
              {completed ? "View Results" : "Get Started"}
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
