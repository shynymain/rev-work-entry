export default {
  async fetch(request) {

    const headers = {
      "content-type": "application/json;charset=utf-8",
      "access-control-allow-origin": "*"
    };

    const url = new URL(request.url);

    if (url.pathname !== "/api/entry") {
      return new Response(JSON.stringify({ ok:false }), { status:404, headers });
    }

    const raceId = url.searchParams.get("raceId");

    if (!raceId) {
      return new Response(JSON.stringify({ ok:false }), { headers });
    }

    const target = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`;

    const res = await fetch(target);

    // ★ここが修正ポイント
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("euc-jp");
    const html = decoder.decode(buffer);

    const horses = [];

    const rows = html.split("<tr");

    rows.forEach(r => {

      const nameMatch = r.match(/horse_name.*?>(.*?)</);
      const noMatch = r.match(/<td class="W31">(\d+)</);

      if (nameMatch && noMatch) {
        horses.push({
          no: noMatch[1],
          name: nameMatch[1].trim()
        });
      }

    });

    return new Response(JSON.stringify({
      ok:true,
      raceId,
      horses
    }), { headers });
  }
};
