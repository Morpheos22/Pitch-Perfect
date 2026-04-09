---
Task ID: 3
Agent: Main Developer
Task: Implement client-side Blob upload for all modules (E1, E2, E4)

Work Log:
- Read worklog and all existing files that needed modification
- Investigated @vercel/blob v2.3.3 API — confirmed `createUploadUrl` does NOT exist in v2.x; adapted to use `generateClientTokenFromReadWriteToken` from `@vercel/blob/client`
- Created `/src/app/api/blob/upload/route.ts` — POST endpoint that generates signed client tokens for client-side Blob uploads
- Created `/src/lib/blob-upload.ts` — Client-side upload utility using native fetch (avoids bundling issues with @vercel/blob/client in browser)
- Modified `/src/lib/file-parser.ts` — Added `extractTextFromUrl()` function that fetches file from URL via `getFileContent()`, constructs File object, delegates to `extractFileText()`
- Modified `/src/app/api/coach/deck/route.ts` (E1) — Added `fileUrl` + `fileName` FormData support with priority: pasted content > Blob URL > legacy file
- Modified `/src/app/api/coach/script/route.ts` (E2) — Added `fileUrl` + `fileName` FormData support alongside existing file upload
- Modified `/src/app/api/coach/full/route.ts` (E4) — Added `deckFileUrl` + `deckFileName` FormData support for deck; video URL already handled
- Modified E1 frontend (`pitch-deck-analyser/new/page.tsx`) — Blob upload as primary with legacy fallback; removed 4.5MB client limit; updated upload label to "no size limit"
- Modified E2 frontend (`elevator-script/new/page.tsx`) — Same Blob upload pattern; removed 4MB client limit; updated upload label
- Modified E4 frontend (`coach/full/new/page.tsx`) — Replaced server-side video upload (via /api/video) with client-side Blob upload for both video and deck
- Cleaned up unused `VERCEL_BODY_LIMIT` and `MAX_CLIENT_FILE_SIZE` constants from frontend files
- Lint passes (0 errors, 1 pre-existing warning unrelated to our changes)

Stage Summary:
- 2 new files created (blob upload API + client utility)
- 5 existing files modified (file-parser + 3 API routes + file-parser)
- 3 frontend files modified (E1, E2, E4 new pages)
- Architecture: Client uploads directly to Vercel Blob → sends URL to API → server fetches from URL → extracts text → AI analysis
- Backward compatibility preserved: legacy file upload still works as fallback
- No AI service or storage changes needed
