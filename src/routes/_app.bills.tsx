import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { fetchBills, fetchItems } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { extractBillFromImage, type ExtractedBill } from "@/lib/ai.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/bills")({
  component: BillsPage,
  head: () => ({ meta: [{ title: "Bills" }] }),
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function BillsPage() {
  const qc = useQueryClient();
  const bills = useQuery({ queryKey: ["bills"], queryFn: fetchBills });
  const items = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const extract = useServerFn(extractBillFromImage);

  const [type, setType] = useState<"purchase" | "sale">("purchase");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ExtractedBill | null>(null);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<(string | null)[]>([]);

  function autoMatch(raw: string): string | null {
    if (!items.data) return null;
    const r = raw.toLowerCase();
    let best: { id: string; score: number } | null = null;
    for (const it of items.data) {
      const n = it.name.toLowerCase();
      let score = 0;
      const tokens = n.split(/[\s/x*-]+/).filter(Boolean);
      for (const t of tokens) if (t.length > 1 && r.includes(t)) score += t.length;
      if (score > (best?.score ?? 0)) best = { id: it.id, score };
    }
    return best && best.score >= 3 ? best.id : null;
  }

  async function onExtract() {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await extract({ data: { dataUrl, type } });
      setDraft(result);
      setMatches(result.items.map((i) => autoMatch(i.raw_name)));
      toast.success(`Extracted ${result.items.length} items`);
    } catch (e: any) {
      toast.error(e.message ?? "Extract failed");
    } finally {
      setBusy(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!draft || !file) throw new Error("nothing to save");
      const path = `${Date.now()}_${file.name}`;
      const up = await supabase.storage.from("bills").upload(path, file);
      if (up.error) throw up.error;

      const { data: bill, error: be } = await supabase
        .from("bills")
        .insert({
          type,
          vendor: draft.vendor,
          bill_no: draft.bill_no,
          bill_date: draft.bill_date,
          file_path: path,
        })
        .select()
        .single();
      if (be) throw be;

      const rows = draft.items.map((it, i) => ({
        bill_id: bill.id,
        item_id: matches[i],
        raw_name: it.raw_name,
        qty: Number(it.qty) || 0,
        rate: Number(it.rate) || 0,
      }));
      if (rows.length) {
        const { error } = await supabase.from("bill_items").insert(rows);
        if (error) throw error;
      }

      // Update item qty (purchase adds, sale subtracts) and last_purchase_rate
      for (let i = 0; i < draft.items.length; i++) {
        const id = matches[i];
        if (!id) continue;
        const it = items.data!.find((x) => x.id === id)!;
        const qty = Number(draft.items[i].qty) || 0;
        const rate = Number(draft.items[i].rate) || 0;
        const newQty = Number(it.available_qty) + (type === "purchase" ? qty : -qty);
        await supabase
          .from("items")
          .update({
            available_qty: newQty,
            ...(type === "purchase" && rate > 0 ? { last_purchase_rate: rate } : {}),
          })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      toast.success("Bill saved");
      setDraft(null); setFile(null); setMatches([]);
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Bills</h2>
        <p className="text-sm text-muted-foreground">
          Upload a purchase or sale bill (PDF / image). AI extracts items, you confirm, qty &amp; rate auto-update.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Upload Bill</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label>File (PDF / image)</Label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button onClick={onExtract} disabled={!file || busy}>
              {busy ? "Extracting…" : "Extract with AI"}
            </Button>
          </div>

          {draft && (
            <div className="space-y-3 pt-3 border-t">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Vendor</Label><Input value={draft.vendor ?? ""} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} /></div>
                <div><Label>Bill No</Label><Input value={draft.bill_no ?? ""} onChange={(e) => setDraft({ ...draft, bill_no: e.target.value })} /></div>
                <div><Label>Bill Date</Label><Input type="date" value={draft.bill_date ?? ""} onChange={(e) => setDraft({ ...draft, bill_date: e.target.value })} /></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left">
                    <tr>
                      <th className="p-2">Raw Name (from bill)</th>
                      <th className="p-2">Match Item</th>
                      <th className="p-2 w-24">Qty</th>
                      <th className="p-2 w-28">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((it, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{it.raw_name}</td>
                        <td className="p-2">
                          <Select
                            value={matches[i] ?? "none"}
                            onValueChange={(v) => {
                              const n = [...matches]; n[i] = v === "none" ? null : v; setMatches(n);
                            }}
                          >
                            <SelectTrigger className="w-64"><SelectValue placeholder="Unmatched" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— skip —</SelectItem>
                              {items.data?.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input type="number" value={it.qty} onChange={(e) => {
                            const d = { ...draft }; d.items[i].qty = Number(e.target.value); setDraft(d);
                          }} />
                        </td>
                        <td className="p-2">
                          <Input type="number" value={it.rate} onChange={(e) => {
                            const d = { ...draft }; d.items[i].rate = Number(e.target.value); setDraft(d);
                          }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save Bill & Update Stock"}
                </Button>
                <Button variant="outline" onClick={() => { setDraft(null); setMatches([]); }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Bills</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left">
              <tr>
                <th className="p-2">Date</th>
                <th className="p-2">Type</th>
                <th className="p-2">Vendor</th>
                <th className="p-2">Bill #</th>
                <th className="p-2">Items</th>
              </tr>
            </thead>
            <tbody>
              {bills.data?.map((b: any) => (
                <tr key={b.id} className="border-b">
                  <td className="p-2">{b.bill_date ?? new Date(b.created_at).toLocaleDateString()}</td>
                  <td className="p-2">
                    <Badge variant={b.type === "purchase" ? "default" : "secondary"}>{b.type}</Badge>
                  </td>
                  <td className="p-2">{b.vendor ?? "—"}</td>
                  <td className="p-2">{b.bill_no ?? "—"}</td>
                  <td className="p-2">{b.bill_items?.length ?? 0}</td>
                </tr>
              ))}
              {!bills.data?.length && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No bills yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
