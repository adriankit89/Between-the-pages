
export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/json"
    };

    if (request.method !== "POST") {
      return new Response(JSON.stringify({
        status: "ok",
        message: "Between the Pages email receiver is running."
      }), { status: 200, headers });
    }

    try {
      const body = await request.json();
      console.log("Received inbound email:", JSON.stringify(body));

      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ received: false, error: "Invalid JSON" }),
        { status: 400, headers }
      );
    }
  }
};
