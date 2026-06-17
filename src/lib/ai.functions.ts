import { createServerFn } from "@tanstack/react-start";

export type ExtractedBillItem = {
  raw_name: string;
  qty: number;
  rate: number;
};

export type ExtractedBill = {
  vendor: string | null;
  bill_no: string | null;
  bill_date: string | null;
  items: ExtractedBillItem[];
};

export const extractBillFromImage = createServerFn({ method: "POST" })
  .inputValidator((data: { dataUrl: string; type: "purchase" | "sale" }) => data)
  .handler(async ({ data }): Promise<ExtractedBill> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const isPdf = data.dataUrl.startsWith("data:application/pdf");
    const userContent: any[] = [
      {
        type: "text",
        text: `Extract this ${data.type} bill. Return JSON with keys: vendor (string|null), bill_no (string|null), bill_date (YYYY-MM-DD|null), items: array of {raw_name, qty, rate}. raw_name is the full item description as written. qty in MT or pieces (number). rate is per-unit purchase/sale rate (number). Numbers only, no units in qty/rate.`,
      },
    ];
    if (isPdf) {
      userContent.push({
        type: "file",
        file: { filename: "bill.pdf", file_data: data.dataUrl },
      });
    } else {
      userContent.push({ type: "image_url", image_url: { url: data.dataUrl } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract structured data from steel/iron trading bills. Always reply with a single JSON object matching the requested schema. No markdown.",
          },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI extract failed: ${res.status} ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: ExtractedBill;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned non-JSON: " + raw.slice(0, 200));
    }
    return {
      vendor: parsed.vendor ?? null,
      bill_no: parsed.bill_no ?? null,
      bill_date: parsed.bill_date ?? null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  });
