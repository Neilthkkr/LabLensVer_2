// netlify/functions/stats.js
// Netlify serverless function to collect anonymous usage stats

import { getStore } from "@netlify/blobs";

export default async (request, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers, status: 200 });
  }

  try {
    const store = getStore("lablens-telemetry");

    if (request.method === "POST") {
      const data = await request.json().catch(() => ({}));
      const event = data.event || "ping";
      const totalUsers = parseInt(data.users) || 0;
      const totalReports = parseInt(data.reports) || 0;

      // Log event to console for standard Netlify function logs
      console.log(`[LabLens Telemetry] Event: ${event} | Users: ${totalUsers} | Reports: ${totalReports}`);

      // Save/Increment stats in Netlify Blobs
      const stats = (await store.get("totals", { type: "json" })) || {
        eventCounts: {},
        lastUpdated: null,
        activeInstalls: 0
      };

      stats.eventCounts[event] = (stats.eventCounts[event] || 0) + 1;
      stats.lastUpdated = new Date().toISOString();
      if (event === "user_created") stats.activeInstalls += 1;

      await store.setJSON("totals", stats);

      return new Response(JSON.stringify({ success: true, stats }), {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 201,
      });
    }

    if (request.method === "GET") {
      const stats = (await store.get("totals", { type: "json" })) || {
        eventCounts: {},
        lastUpdated: null,
        activeInstalls: 0
      };

      return new Response(JSON.stringify(stats), {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response("Method not allowed", { status: 405, headers });
  } catch (error) {
    console.error("[LabLens Telemetry Server Error]:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });
  }
};
