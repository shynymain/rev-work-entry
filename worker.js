export default {
  async fetch(request) {
    const headers = {
      "content-type": "application/json;charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    };

    if (request.method === "OPTIONS") {
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        ok: true,
        worker: "rev-work-entry",
        version: "v1-eucjp-entry"
      }), { headers });
    }

    if (url.pathname !== "/api/entry") {
      return new Response(JSON.stringify({
        ok: false,
        error: "not found"
      }), { status: 404, headers });
    }

    const raceId = String(url.searchParams.get("raceId") || "").replace(/\D/g, "").slice(0, 12);

    if (!raceId || raceId.length !== 12) {
      return new Response(JSON.stringify({
        ok: false,
        error: "raceId required"
      }), { status: 400, headers });
    }

    const sourceUrl = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`;

    try {
      const res = await fetch(sourceUrl, {
        headers: {
          "user-agent": "Mozilla/5.0"
        }
      });

      const buffer = await res.arrayBuffer();

      // netkeiba は EUC-JP の場合があるため文字化け防止
      let html = "";
      try {
        html = new TextDecoder("euc-jp").decode(buffer);
      } catch {
        html = new TextDecoder("utf-8").decode(buffer);
      }

      const horses = parseEntryHtml(html);

      return new Response(JSON.stringify({
        ok: true,
        raceId,
        count: horses.length,
        horses,
        source: "netkeiba-entry-eucjp",
        sourceUrl
      }), { headers });

    } catch (e) {
      return new Response(JSON.stringify({
        ok: false,
        raceId,
        error: String(e && e.message ? e.message : e),
        sourceUrl
      }), { status: 500, headers });
    }
  }
};

function parseEntryHtml(html) {
  const horses = [];

  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/g) || [];

  for (const row of rowMatches) {
    const no = pick(row, [
      /<td[^>]*class="[^"]*(?:Umaban|W31)[^"]*"[^>]*>\s*(\d+)\s*<\/td>/i,
      /<td[^>]*>\s*(\d{1,2})\s*<\/td>/i
    ]);

    const frame = pick(row, [
      /<td[^>]*class="[^"]*Waku[^"]*"[^>]*>\s*(\d+)\s*<\/td>/i,
      /class="[^"]*Waku(\d+)[^"]*"/i
    ]);

    const name = cleanHtml(pick(row, [
      /<span[^>]*class="[^"]*HorseName[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
      /<td[^>]*class="[^"]*HorseInfo[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
      /horse_name[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
      /horse_name[^>]*>([\s\S]*?)</i
    ]));

    if (!no || !name) continue;

    horses.push({
      frame: frame || "",
      no,
      name,
      last1: "",
      last2: "",
      last3: "",
      odds: "",
      popularity: ""
    });
  }

  // 重複除去・馬番順
  const map = new Map();
  for (const h of horses) {
    if (!map.has(h.no)) map.set(h.no, h);
  }

  return Array.from(map.values()).sort((a, b) => Number(a.no) - Number(b.no));
}

function pick(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return cleanHtml(m[1]);
  }
  return "";
}

function cleanHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
