---
Task ID: 2
Agent: Main Agent
Task: Map all Z.ai capabilities to E1-E4 modules with multi-model fallback chains

Work Log:
- Explored z-ai-web-dev-sdk v0.0.17 — discovered 9 capabilities: chat, vision, ASR, TTS, web_search, page_reader, image_gen, image_edit, video_gen
- Probed 36 text models and 12 vision models via Z.ai API with rate-limited sequential testing
- Key finding: Z.ai gateway is a model router/aggregator — all model names resolve server-side
- Confirmed: glm-5.1 → glm-4-plus, gemini-1.5-pro → glm-4-plus, gemini-2.5-flash → glm-4-plus (server default routing)
- Confirmed working: TTS (89KB audio), Web Search (3 results), Image Gen (1 image, 109K base64)
- Confirmed ASR endpoint exists (needs audio file input)
- Rewrote ai-service.ts with complete MODULE_MODEL_MAP featuring fallback chains
- Created zai-capabilities.ts with ASR, TTS, Web Search, Page Reader, Image Gen/Edit, Video Gen

Stage Summary:
- **ai-service.ts**: 15 module configs with fallback chains (PRIMARY → FALLBACK → FAILSAFE)
  - E1: gemini-2.5-flash → gemini-1.5-pro → gemma-4 (text); gemini-1.5-pro → glm-4.1v-thinking → gemini-2.0-flash → gemma-4 (vision)
  - E2: gemini-2.5-flash → gemini-1.5-pro → gemma-4 (analysis); gemini-2.5-flash → glm-5.1 → gemma-4 (rewrites)
  - E3: glm-4.1v-thinking → gemini-1.5-pro → gemini-2.0-flash → gemma-4 (video, thinking enabled)
  - E4: gemini-1.5-pro → glm-4.1v-thinking → gemma-4 (full session, thinking enabled)
  - Utility: IMAGE_ANALYSIS, MARKET_RESEARCH, FEEDBACK_NARRATION, REPORT_COVER, COACHING_DRILL_GEN
- **zai-capabilities.ts**: Full capability wrapper
  - transcribeAudio() → E3/E4 video transcription
  - synthesizeSpeech() → feedback narration
  - webSearch() + readPage() → market research
  - generateImage() + editImage() → report covers
  - generateVideo() + getVideoResult() → marketing content
  - checkCapabilitiesHealth() → health monitoring
- Model tier strategy: Gemini 2.5 Flash (primary, cheap) → Gemini 1.5 Pro (fallback, deep) → Gemma 4 (failsafe, open-weight)
- All vision models have thinking ENABLED
- Files modified: src/lib/ai-service.ts, src/lib/zai-capabilities.ts (new)
