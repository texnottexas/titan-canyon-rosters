/**
 * Cloudflare Worker — Save Proxy
 *
 * Env secrets (set via `wrangler secret put`):
 *   GITHUB_PAT      — fine-grained PAT with contents:write on the repo
 *
 * Env vars (set in wrangler.toml):
 *   REPO            — e.g. "texnottexas/titan-canyon-rosters"
 *   ALLOWED_ORIGIN  — e.g. "https://test.2864tw.com"
 */

const ALLOWED_PATHS = ["battle-plan-data.json", "roster-data.json", "changelog-data.json"];

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.searchParams.get("path") || "battle-plan-data.json";
    if (!ALLOWED_PATHS.includes(path)) {
      return jsonResponse({ error: "Invalid path" }, 400, corsHeaders);
    }

    // GET = read current data (no auth needed, just proxies to GitHub)
    if (request.method === "GET") {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${env.REPO}/contents/${path}`,
          { headers: { Authorization: `token ${env.GITHUB_PAT}`, "User-Agent": "cf-worker" } }
        );
        if (!res.ok) return jsonResponse({ error: "Failed to fetch data" }, 502, corsHeaders);
        const file = await res.json();
        const content = JSON.parse(atob(file.content));
        return jsonResponse({ data: content, sha: file.sha }, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: "Internal error" }, 500, corsHeaders);
      }
    }

    // POST = save data
    if (request.method === "POST") {
      let body;
      try { body = await request.json(); } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400, corsHeaders);
      }

      const { data } = body;
      const filePath = body.path || "battle-plan-data.json";
      if (!ALLOWED_PATHS.includes(filePath)) {
        return jsonResponse({ error: "Invalid path" }, 400, corsHeaders);
      }

      if (!data || typeof data !== "object") {
        return jsonResponse({ error: "Missing data" }, 400, corsHeaders);
      }

      try {
        // Get current SHA
        const getRes = await fetch(
          `https://api.github.com/repos/${env.REPO}/contents/${filePath}`,
          { headers: { Authorization: `token ${env.GITHUB_PAT}`, "User-Agent": "cf-worker" } }
        );
        let sha;
        if (getRes.ok) {
          const file = await getRes.json();
          sha = file.sha;
        }

        const commitMsgs = { "roster-data.json": "Update roster data", "changelog-data.json": "Update changelog", "battle-plan-data.json": "Update battle plan data" };
        const commitMsg = commitMsgs[filePath] || "Update data";
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
        const putBody = { message: commitMsg, content };
        if (sha) putBody.sha = sha;

        const putRes = await fetch(
          `https://api.github.com/repos/${env.REPO}/contents/${filePath}`,
          {
            method: "PUT",
            headers: {
              Authorization: `token ${env.GITHUB_PAT}`,
              "Content-Type": "application/json",
              "User-Agent": "cf-worker",
            },
            body: JSON.stringify(putBody),
          }
        );

        if (!putRes.ok) {
          const err = await putRes.json();
          return jsonResponse({ error: err.message || "GitHub save failed" }, 502, corsHeaders);
        }

        const result = await putRes.json();
        return jsonResponse({ ok: true, sha: result.content.sha }, 200, corsHeaders);
      } catch (e) {
        return jsonResponse({ error: "Internal error" }, 500, corsHeaders);
      }
    }

    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  },
};

function jsonResponse(obj, status, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
