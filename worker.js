
export default {
  async fetch(request, env) {
    const cors = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    };

    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: cors });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === "/" && request.method === "GET") {
      return respond({
        status: "ok",
        message: "Between the Pages backup service is running."
      });
    }

    // Authenticate reviewer using Supabase
    async function authenticate() {
      const authHeader = request.headers.get("Authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
      }

      const response = await fetch(
        `${env.SUPABASE_URL}/auth/v1/user`,
        {
          headers: {
            "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": authHeader
          }
        }
      );

      if (!response.ok) return null;

      const user = await response.json();
      return user.id ? user : null;
    }

    // Save reviewer backup
    if (path === "/backup" && request.method === "POST") {
      try {
        const user = await authenticate();

        if (!user) {
          return respond({ error: "Unauthorised" }, 401);
        }

        const backup = await request.json();

        if (!backup || typeof backup !== "object" ||
            Array.isArray(backup)) {
          return respond({ error: "Invalid backup data" }, 400);
        }

        const objectKey = `${user.id}/library.json`;
        const backupData = JSON.stringify(backup);

        await env.BACKUP_BUCKET.put(objectKey, backupData, {
          httpMetadata: {
            contentType: "application/json"
          }
        });

        // Update Supabase backup record
        const dbResponse = await fetch(
          `${env.SUPABASE_URL}/rest/v1/user_backups?on_conflict=object_key`,
          {
            method: "POST",
            headers: {
              "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
              "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
              "Prefer": "resolution=merge-duplicates,return=minimal"
            },
            body: JSON.stringify({
              user_id: user.id,
              object_key: objectKey,
              backup_name: "Library backup",
              file_size: new TextEncoder().encode(backupData).length,
              updated_at: new Date().toISOString()
            })
          }
        );

        if (!dbResponse.ok) {
          console.error("Backup metadata update failed:", await dbResponse.text());
          return respond({ error: "Backup saved but metadata update failed" }, 500);
        }

        return respond({
          success: true,
          message: "Library backup saved",
          updated_at: new Date().toISOString()
        });

      } catch (error) {
        console.error("Backup error:", error);
        return respond({ error: "Backup failed" }, 500);
      }
    }

    // Restore reviewer backup
    if (path === "/backup" && request.method === "GET") {
      try {
        const user = await authenticate();

        if (!user) {
          return respond({ error: "Unauthorised" }, 401);
        }

        const objectKey = `${user.id}/library.json`;
        const object = await env.BACKUP_BUCKET.get(objectKey);

        if (!object) {
          return respond({ error: "No backup found" }, 404);
        }

        const backup = await object.json();

        return respond({
          success: true,
          backup
        });

      } catch (error) {
        console.error("Restore error:", error);
        return respond({ error: "Restore failed" }, 500);
      }
    }

    // Preserve existing email receiver
    if (path === "/" && request.method === "POST") {
      try {
        const body = await request.json();

        console.log(
          "Received inbound email:",
          JSON.stringify(body)
        );

        return respond({ received: true });

      } catch (error) {
        return respond({
          received: false,
          error: "Invalid JSON"
        }, 400);
      }
    }

    return respond({ error: "Not found" }, 404);
  }
};
