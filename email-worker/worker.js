/**
 * Between the Pages — inbound NetGalley email worker.
 *
 * Required Worker secrets/variables:
 *   RESEND_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Resend sends metadata only; this worker retrieves the full message,
 * extracts conservative book metadata, and stores a pending import.
 */
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8" }
});

function plainText(email) {
  if (email.text) return String(email.text);
  return String(email.html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(?:p|div|tr|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractEmail(value) {
  const match = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function parseApproval(email) {
  const subject = String(email.subject || "").trim();
  if (!/netgalley/i.test(subject) && !/approved request to view/i.test(subject)) return null;
  const titleMatch = subject.match(/approved request to view\s+(.+?)(?:\s+from\s+.+)?$/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/[.!]+$/, "") : "";
  const text = plainText(email);
  const authorMatch = text.match(/(?:^|\n)\s*(?:by|author\s*:)\s*([^\n]{2,100})/im);
  const publisherMatch = text.match(/(?:publisher|published by)\s*:?\s*([^\n]{2,100})/i)
    || subject.match(/\bfrom\s+(.+)$/i);
  const dateMatch = text.match(/(?:publication date|pub date|publication|on sale)\s*:?\s*([^\n]{4,50})/i);
  const linkMatch = (text + " " + String(email.html || "")).match(/https?:\/\/www\.netgalley\.com\/catalog\/book\/\d+[^\s"'<>]*/i);
  const author = authorMatch ? authorMatch[1].replace(/\s*[|•].*$/, "").trim() : "";
  const publisher = publisherMatch ? publisherMatch[1].replace(/<[^>]*>/g, "").trim().slice(0, 120) : "";
  return {
    title: title.slice(0, 240),
    author: author.slice(0, 120),
    publisher,
    publication_date: dateMatch ? dateMatch[1].trim().slice(0, 60) : null,
    netgalley_url: linkMatch ? linkMatch[0].replace(/[),.]+$/, "") : null
  };
}

async function fetchReceivedEmail(emailId, apiKey) {
  const response = await fetch("https://api.resend.com/emails/receiving/" + encodeURIComponent(emailId), {
    headers: { authorization: "Bearer " + apiKey, accept: "application/json" }
  });
  if (!response.ok) throw new Error("Resend receiving API returned " + response.status);
  return response.json();
}

async function storePending(env, row) {
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const response = await fetch(base + "/rest/v1/pending_arc_imports", {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "content-type": "application/json",
      prefer: "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify(row)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error("Supabase insert failed (" + response.status + "): " + detail.slice(0, 500));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return json({ status: "ok", service: "Between the Pages email importer" });
    }
    if (request.method !== "POST" || url.pathname !== "/") return json({ error: "Not found" }, 404);
    try {
      if (!env.RESEND_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return json({ error: "Email worker is missing a required secret or variable." }, 503);
      }
      const event = await request.json();
      if (event.type !== "email.received" || !event.data?.email_id) {
        return json({ received: true, ignored: true });
      }
      const email = await fetchReceivedEmail(event.data.email_id, env.RESEND_API_KEY);
      const details = parseApproval(email);
      if (!details || !details.title) return json({ received: true, imported: false, reason: "Not a recognised NetGalley approval email" });

      const sourceEmail = extractEmail(email.from);
      if (!sourceEmail) return json({ error: "Could not identify the forwarding account email." }, 422);

      await storePending(env, {
        resend_email_id: email.id,
        source_email: sourceEmail,
        subject: String(email.subject || "").slice(0, 500),
        title: details.title,
        author: details.author || null,
        publisher: details.publisher || null,
        publication_date: details.publication_date,
        netgalley_url: details.netgalley_url,
        received_at: email.created_at || new Date().toISOString(),
        status: "pending"
      });
      return json({ received: true, imported: true });
    } catch (error) {
      console.error("Inbound ARC import failed:", error?.message || error);
      return json({ received: false, error: "Could not process the inbound email." }, 500);
    }
  }
};
