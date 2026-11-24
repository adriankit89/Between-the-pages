

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "ok", message: "Between the Pages email receiver is running." }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const body = await req.json();

  console.log("Received inbound email:", JSON.stringify(body));

  return new Response(
    JSON.stringify({ received: true }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
};
