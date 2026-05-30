import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

const PF = "https://api.printful.com";

// Printful product ID → mockup product ID mapping
const PRODUCT_ID_MAP: Record<string, number> = {
  tshirt: 71,
  hoodie: 146,
  mug: 19,
  tote: 200,
  hat: 75,
  poster: 1,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { designUrl, productType, variantIds } = await req.json();
  if (!designUrl || !productType) {
    return NextResponse.json({ error: "Missing designUrl or productType" }, { status: 400 });
  }

  const { PRINTFUL_API_KEY } = await getSecrets(["PRINTFUL_API_KEY"]);
  if (!PRINTFUL_API_KEY) {
    // No API key — return design URL as the mockup
    return NextResponse.json({ mockupUrl: designUrl, status: "no_api_key" });
  }

  const productId = PRODUCT_ID_MAP[productType] ?? 71;

  try {
    // Step 1: Create mockup generation task
    const taskRes = await fetch(`${PF}/mockup-generator/create-tasks/${productId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PRINTFUL_API_KEY}`,
      },
      body: JSON.stringify({
        variant_ids: variantIds ?? [],
        format: "jpg",
        files: [{ placement: "front", url: designUrl }],
      }),
    });

    if (!taskRes.ok) {
      const err = await taskRes.text();
      console.error("Printful mockup task failed:", err);
      return NextResponse.json({ mockupUrl: designUrl, status: "task_failed" });
    }

    const taskData = await taskRes.json();
    const taskKey = taskData?.result?.task_key;
    if (!taskKey) return NextResponse.json({ mockupUrl: designUrl, status: "no_task_key" });

    // Step 2: Poll for result (up to 30 seconds)
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000)); // wait 3s between polls

      const pollRes = await fetch(`${PF}/mockup-generator/task?task_key=${taskKey}`, {
        headers: { Authorization: `Bearer ${PRINTFUL_API_KEY}` },
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      const status = pollData?.result?.status;

      if (status === "completed") {
        const mockups = pollData?.result?.mockups;
        const firstMockup = mockups?.[0]?.mockups?.[0]?.url ?? mockups?.[0]?.url;
        if (firstMockup) {
          return NextResponse.json({ mockupUrl: firstMockup, status: "completed" });
        }
      }

      if (status === "error") {
        return NextResponse.json({ mockupUrl: designUrl, status: "printful_error" });
      }
    }

    // Timed out — return design URL as fallback
    return NextResponse.json({ mockupUrl: designUrl, status: "timeout", taskKey });

  } catch (e: any) {
    console.error("Mockup generation error:", e.message);
    return NextResponse.json({ mockupUrl: designUrl, status: "exception" });
  }
}
