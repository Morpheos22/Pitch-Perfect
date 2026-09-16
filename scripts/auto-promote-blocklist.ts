/**
 * CLI script — trigger auto-promotion of probe IPs to the persistent blocklist.
 *
 * Usage:
 *   # Basic run (uses AUTO_PROMOTE_SECRET from env)
 *   npx tsx scripts/auto-promote-blocklist.ts
 *
 *   # Dry run (log what would be promoted, don't persist)
 *   npx tsx scripts/auto-promote-blocklist.ts --dry-run
 *
 *   # Custom threshold
 *   npx tsx scripts/auto-promote-blocklist.ts --threshold 5 --window 168
 *
 *   # Show only IPs above threshold without promoting
 *   npx tsx scripts/auto-promote-blocklist.ts --report
 *
 * Required env vars:
 *   - AUTO_PROMOTE_SECRET (matches the value set on Vercel)
 *   - PITCHCOACHAI_URL (default: https://pitchcoachai.tech)
 *
 * Or pass via flags:
 *   --secret=xxx --url=https://...
 */

interface Args {
  threshold?: number;
  windowHours?: number;
  dryRun: boolean;
  reportOnly: boolean;
  secret?: string;
  url: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    reportOnly: false,
    url: process.env.PITCHCOACHAI_URL ?? "https://pitchcoachai.tech",
    secret: process.env.AUTO_PROMOTE_SECRET,
  };

  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--report") args.reportOnly = true;
    else if (arg.startsWith("--threshold=")) args.threshold = parseInt(arg.slice(12), 10);
    else if (arg.startsWith("--window=")) args.windowHours = parseInt(arg.slice(9), 10);
    else if (arg.startsWith("--secret=")) args.secret = arg.slice(8);
    else if (arg.startsWith("--url=")) args.url = arg.slice(6);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npx tsx scripts/auto-promote-blocklist.ts [options]

Options:
  --dry-run              Log what would be promoted, don't persist
  --report               Show IPs above threshold without calling the API
  --threshold=N          Min attempts before promotion (default: 3)
  --window=HOURS         Lookback window in hours (default: 96)
  --secret=SECRET        AUTO_PROMOTE_SECRET value
  --url=URL              Base URL (default: https://pitchcoachai.tech)
  --help, -h             Show this help
`);
      process.exit(0);
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.secret && !args.reportOnly) {
    console.error("ERROR: AUTO_PROMOTE_SECRET env var (or --secret flag) is required");
    console.error("Set it via: export AUTO_PROMOTE_SECRET=your_secret_here");
    process.exit(1);
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("PitchCoach Ai — Auto-promote probe IPs to blocklist");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`URL:        ${args.url}`);
  console.log(`Threshold:  ${args.threshold ?? 3} attempts`);
  console.log(`Window:     ${args.windowHours ?? 96} hours`);
  console.log(`Dry run:    ${args.dryRun}`);
  console.log(`Report:     ${args.reportOnly}`);
  console.log("");

  if (args.reportOnly) {
    console.log("ℹ Report mode: querying incidents directly via Supabase REST API...");
    console.log("  (requires SUPABASE_SERVICE_ROLE_KEY env var)");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const projectRef = process.env.SUPABASE_PROJECT_REF;
    if (!serviceKey || !projectRef) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PROJECT_REF env vars");
      process.exit(1);
    }
    const threshold = args.threshold ?? 3;
    const windowHours = args.windowHours ?? 96;
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    const response = await fetch(
      `https://${projectRef}.supabase.co/rest/v1/security_incidents?reason=eq.MAINTENANCE_AUTH_PROBE&createdAt=gte.${windowStart}&select=ip,deviceId,pathname,country,createdAt`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    if (!response.ok) {
      console.error(`Supabase query failed: ${response.status} ${response.statusText}`);
      process.exit(1);
    }
    const incidents = (await response.json()) as Array<{
      ip: string;
      deviceId: string;
      pathname: string;
      country: string | null;
      createdAt: string;
    }>;

    const ipMap = new Map<string, { attempts: number; countries: Set<string>; paths: Set<string>; lastSeen: Date }>();
    for (const inc of incidents) {
      let entry = ipMap.get(inc.ip);
      if (!entry) {
        entry = { attempts: 0, countries: new Set(), paths: new Set(), lastSeen: new Date(0) };
        ipMap.set(inc.ip, entry);
      }
      entry.attempts++;
      if (inc.country) entry.countries.add(inc.country);
      entry.paths.add(inc.pathname);
      const ts = new Date(inc.createdAt);
      if (ts > entry.lastSeen) entry.lastSeen = ts;
    }

    console.log("");
    console.log(`Total incidents in last ${windowHours}h: ${incidents.length}`);
    console.log(`Unique IPs: ${ipMap.size}`);
    console.log("");
    const sortedIps = Array.from(ipMap.entries()).sort((a, b) => b[1].attempts - a[1].attempts);
    for (const [ip, stats] of sortedIps) {
      const flag = stats.attempts >= threshold ? "🚨 PROMOTE" : "  ok     ";
      console.log(`${flag}  ${ip.padEnd(18)} attempts=${String(stats.attempts).padStart(3)}  countries=[${Array.from(stats.countries).join(",")}]  paths=[${Array.from(stats.paths).slice(0, 3).join(",")}${stats.paths.size > 3 ? ",..." : ""}]  lastSeen=${stats.lastSeen.toISOString()}`);
    }
    console.log("");
    console.log(`Threshold: ${threshold}. IPs flagged 🚨 would be promoted to blocked_ips.`);
    process.exit(0);
  }

  // ── Call the API endpoint to actually promote ──
  console.log("Calling /api/security/auto-promote ...");
  const response = await fetch(`${args.url}/api/security/auto-promote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auto-promote-secret": args.secret!,
    },
    body: JSON.stringify({
      threshold: args.threshold,
      windowHours: args.windowHours,
      dryRun: args.dryRun,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error(`ERROR ${response.status}:`, JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log("");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("RESULT");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(JSON.stringify(result.stats ?? result, null, 2));
  console.log("");

  if (result.results && Array.isArray(result.results)) {
    const promoted = result.results.filter((r: { promoted: boolean }) => r.promoted);
    if (promoted.length > 0) {
      console.log(`Promoted IPs (${promoted.length}):`);
      for (const r of promoted) {
        console.log(`  🚨 ${r.ip}`);
        console.log(`     attempts=${r.attempts} countries=[${r.countries.join(",")}] paths=[${r.paths.join(",")}]`);
        console.log(`     firstSeen=${r.firstSeen} lastSeen=${r.lastSeen}`);
        if (r.error) console.log(`     ERROR: ${r.error}`);
      }
    }
    const skipped = result.results.filter((r: { promoted: boolean }) => !r.promoted);
    if (skipped.length > 0) {
      console.log("");
      console.log(`Below threshold (${skipped.length}):`);
      for (const r of skipped.slice(0, 10)) {
        console.log(`  • ${r.ip} — ${r.attempts} attempt(s)`);
      }
      if (skipped.length > 10) console.log(`  ... and ${skipped.length - 10} more`);
    }
  }
  console.log("");
  console.log(args.dryRun ? "✓ Dry run complete — no IPs were persisted" : "✓ Done");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
