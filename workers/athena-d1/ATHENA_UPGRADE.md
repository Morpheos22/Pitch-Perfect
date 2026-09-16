# Athena D1 upgrade

The worker now exposes POST /v1/athena for the four-pass reasoning flow: comprehension/extraction, forensic contradiction audit, seven-axis rubric scoring/remediation, and final response formulation. It injects recent turns and D1 memory facts and performs bounded live web verification when search queries are identified.

POST /v1/athena accepts `{session_id, message, turns, voice}`. Set voice to true to include `audio_base64` using ElevenLabs. POST /v1/tts returns audio/mpeg directly and accepts `text`, `voice_id`, `model_id`, `stability`, and `similarity_boost`.

POST /v1/tool accepts `{name, arguments}` for search_web, record_drill_turn, flag_discrepancy, extract_memory_facts, and generate_readiness_memo.

Configure ELEVENLABS_API_KEY and WEB_SEARCH_API_KEY as Wrangler secrets. The implementation does not deploy or migrate D1 automatically; ensure the existing tables expose the columns used by the persistence helpers before enabling writes. Web search defaults to Brave and supports Serper or Tavily through WEB_SEARCH_PROVIDER and WEB_SEARCH_URL.
