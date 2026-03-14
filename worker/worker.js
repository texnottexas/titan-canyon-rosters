/**
 * Cloudflare Worker — Save Proxy
 *
 * Env secrets (set via `wrangler secret put`):
 *   GITHUB_PAT      — fine-grained PAT with contents:write on the repo
 *
 * Env vars (set in wrangler.toml):
 *   REPO            — e.g. "texnottexas/titan-canyon-rosters"
 *   ALLOWED_ORIGIN  — e.g. "https://titan.2864tw.com"
 */

const ALLOWED_PATHS = ["battle-plan-data.json", "roster-data.json", "changelog-data.json"];
const COMMIT_MSGS = {
  "roster-data.json": "Update roster data",
  "changelog-data.json": "Update changelog",
  "battle-plan-data.json": "Update battle plan data",
};

function ghUrl(env, path) {
  return `https://api.github.com/repos/${env.REPO}/contents/${path}`;
}

function ghHeaders(env) {
  return { Authorization: `token ${env.GITHUB_PAT}`, "User-Agent": "cf-worker" };
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  return btoa(String.fromCharCode(...bytes));
}

function base64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function jsonResponse(obj, status, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function resolvePath(request, body) {
  const url = new URL(request.url);
  const path = (body && body.path) || url.searchParams.get("path") || "battle-plan-data.json";
  return ALLOWED_PATHS.includes(path) ? path : null;
}

export default {
  async fetch(request, env) {
    if (!env.ALLOWED_ORIGIN) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const body = request.method === "POST"
      ? await request.json().catch(() => null)
      : null;

    if (request.method === "POST" && !body) {
      return jsonResponse({ error: "Invalid JSON" }, 400, corsHeaders);
    }

    const path = resolvePath(request, body);
    if (!path) {
      return jsonResponse({ error: "Invalid path" }, 400, corsHeaders);
    }

    // GET = read current data
    if (request.method === "GET") {
      try {
        const res = await fetch(ghUrl(env, path), { headers: ghHeaders(env) });
        if (!res.ok) return jsonResponse({ error: "Failed to fetch data" }, 502, corsHeaders);
        const file = await res.json();
        const content = JSON.parse(base64ToUtf8(file.content));
        return jsonResponse({ data: content, sha: file.sha }, 200, corsHeaders);
      } catch (e) {
        console.error("GET error:", e);
        return jsonResponse({ error: "Internal error" }, 500, corsHeaders);
      }
    }

    // POST = save data
    if (request.method === "POST") {
      const { data } = body;
      if (!data || typeof data !== "object") {
        return jsonResponse({ error: "Missing data" }, 400, corsHeaders);
      }

      try {
        // Get current SHA
        const getRes = await fetch(ghUrl(env, path), { headers: ghHeaders(env) });
        const sha = getRes.ok ? (await getRes.json()).sha : undefined;

        const putBody = {
          message: COMMIT_MSGS[path] || "Update data",
          content: utf8ToBase64(JSON.stringify(data, null, 2)),
        };
        if (sha) putBody.sha = sha;

        const putRes = await fetch(ghUrl(env, path), {
          method: "PUT",
          headers: { ...ghHeaders(env), "Content-Type": "application/json" },
          body: JSON.stringify(putBody),
        });

        if (!putRes.ok) {
          const err = await putRes.json();
          return jsonResponse({ error: err.message || "GitHub save failed" }, 502, corsHeaders);
        }

        const result = await putRes.json();
        return jsonResponse({ ok: true, sha: result.content.sha }, 200, corsHeaders);
      } catch (e) {
        console.error("POST error:", e);
        return jsonResponse({ error: "Internal error" }, 500, corsHeaders);
      }
    }

    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  },
};
