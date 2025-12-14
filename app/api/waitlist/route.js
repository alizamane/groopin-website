import { NextResponse } from "next/server";
import { getServiceClient } from "../../lib/supabase-server";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body?.name?.toString().trim();
  const email = body?.email?.toString().trim().toLowerCase();

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    const { error } = await supabase
      .from("waitlist_entries")
      .upsert({ name, email }, { onConflict: "email" });

    if (error) {
      // Handle unique constraint violation gracefully
      const conflict =
        error.code === "23505" || (typeof error.message === "string" && error.message.toLowerCase().includes("duplicate"));
      if (conflict) {
        return NextResponse.json({ ok: true, duplicate: true });
      }

      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Failed to save. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Waitlist handler error:", err);
    const message = err?.message?.includes("SUPABASE_SERVICE_ROLE_KEY")
      ? "Server not configured. Set SUPABASE_SERVICE_ROLE_KEY."
      : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
