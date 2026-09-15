---
name: vercel-react-best-practices
description: Apply Vercel performance guidance when changing React or Next.js code.
license: MIT
---

Use this skill for React and Next.js changes. Prioritize eliminating request waterfalls, minimizing client bundles, direct imports, server-side caching/deduplication, parallel independent fetches, and avoiding unnecessary re-renders. For API routes, start independent work early and await late, preserve authentication and error boundaries, and validate with the repository build and lint commands.

Source: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices