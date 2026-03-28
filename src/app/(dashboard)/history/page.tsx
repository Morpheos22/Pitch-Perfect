"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Presentation, 
  MessageSquare, 
  Video, 
  TrendingUp,
  Search,
  Filter,
  ChevronRight,
  Download,
  Trash2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const sessions = [
  {
    id: "1",
    name: "Investor Deck v2",
    module: "pitch-deck",
    type: "Pitch Deck Analyser",
    date: "2026-03-24",
    score: 82,
    cycle: 2,
    icon: Presentation,
  },
  {
    id: "2",
    name: "Investor Deck v1",
    module: "pitch-deck",
    type: "Pitch Deck Analyser",
    date: "2026-03-23",
    score: 72,
    cycle: 1,
    icon: Presentation,
  },
  {
    id: "3",
    name: "Elevator Pitch v1",
    module: "script",
    type: "Script Check",
    date: "2026-03-22",
    score: 74,
    cycle: 1,
    icon: MessageSquare,
  },
  {
    id: "4",
    name: "Live Pitch Practice 1",
    module: "live",
    type: "Live Recording",
    date: "2026-03-21",
    score: 68,
    cycle: 1,
    icon: Video,
  },
  {
    id: "5",
    name: "Demo Day Full Pitch",
    module: "full",
    type: "Full Session",
    date: "2026-03-20",
    score: 65,
    cycle: 1,
    icon: TrendingUp,
  },
];

function getScoreColor(score: number) {
  if (score >= 70) return "text-secondary";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
}

function getModuleColor(module: string) {
  switch (module) {
    case "pitch-deck":
      return "bg-primary/10 text-primary";
    case "script":
      return "bg-secondary/10 text-secondary";
    case "live":
      return "bg-orange-500/10 text-orange-500";
    case "full":
      return "bg-emerald-500/10 text-emerald-500";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.name.toLowerCase().includes(search.toLowerCase());
    const matchesModule = moduleFilter === "all" || session.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Session History</h1>
        <p className="text-muted-foreground">All your coaching sessions in one place</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="pitch-deck">Pitch Deck Analyser</SelectItem>
                <SelectItem value="script">Script Check</SelectItem>
                <SelectItem value="live">Live Recording</SelectItem>
                <SelectItem value="full">Full Session</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Score Progression Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Score Progression</CardTitle>
          <CardDescription>Your improvement over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between h-32 gap-2">
            {[...filteredSessions].reverse().map((session, index) => (
              <div key={session.id} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-full rounded-t ${
                    session.score >= 70
                      ? "bg-secondary"
                      : session.score >= 40
                      ? "bg-yellow-500"
                      : "bg-destructive"
                  }`}
                  style={{ height: `${session.score}%` }}
                />
                <span className="text-xs text-muted-foreground">{session.score}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-xs text-muted-foreground">
            <span>Oldest</span>
            <span>Most Recent</span>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No sessions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      const routes: Record<string, string> = {
                        "pitch-deck": "/pitch-deck-analyser/session",
                        "script": "/elevator-script/session",
                        "live": "/elevator-pitch-live/live/session",
                        "full": "/full-session/session",
                      };
                      router.push(`${routes[session.module]}/${session.id}`);
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getModuleColor(session.module)}`}>
                          <session.icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{session.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{session.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(session.date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${getScoreColor(session.score)}`}>
                        {session.score}
                      </span>
                      <span className="text-muted-foreground">/100</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{session.cycle} of 2</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Compare Sessions */}
      {filteredSessions.length >= 2 && (
        <Card className="border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Compare Sessions</p>
                <p className="text-sm text-muted-foreground">See your improvement between two sessions</p>
              </div>
              <Button variant="outline">
                Select Sessions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
