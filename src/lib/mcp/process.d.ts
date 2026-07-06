// Ambient declaration for Deno's `process.env` in edge function runtime.
// These tool files are bundled by @lovable.dev/mcp-js into a Supabase Edge Function.
declare const process: { env: Record<string, string | undefined> };
