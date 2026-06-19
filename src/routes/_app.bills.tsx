import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { fetchBills, fetchItems, fetchSaudas } from "@/lib/queries";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";
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
 
// ─── Edit Dialog ────────────────────────────────────────────────────────────
 
function EditBillDialog({
  bill,
  items,
  open,
  onClose,
}: {
  bill: any;
  items: any[];
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [vendor, setVendor] = useState(bill.vendor ?? "");
  const [billNo, setBillNo] = useState(bill.bill_no ?? "");
  const [billDate, setBillDate] = useState(bill.bill_date ?? "");
  const [billItems, setBillItems] = useState<any[]>(
    (bill.bill_items ?? []).map((bi: any) => ({ ...bi }))
  );
 
  const mut = useMutation({
    mutationFn: async () => {
      // Update bill header
      const { error: be } = await supabase
        .from("bills")
        .update({ vendor, bill_no: billNo, bill_date: billDate })
        .eq("id", bill.id);
      if (be) throw be;
 
      // Update each bill_item row (qty and rate)
      for (const bi of billItems) {
        const { error } = await supabase
          .from("bill_items")
          .update({ qty: Number(bi.qty), rate: Number(bi.rate), item_id: bi.item_id })
          .eq("id", bi.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Bill updated");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });
 
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Bill</DialogTitle>
        </DialogHeader>
 
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Vendor</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div>
              <Label>Bill No</Label>
              <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} />
            </div>
            <div>
              <Label>Bill Date</Label>
              <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </div>
          </div>
 
          {billItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left">
                  <tr>
                    <th className="p-2">Raw Name</th>
                    <th className="p-2">Match Item</th>
                    <th className="p-2 w-24">Qty</th>
                    <th className="p-2 w-28">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {billItems.map((bi, i) => (
                    <tr key={bi.id} className="border-b">
                      <td className="p-2 text-muted-foreground">{bi.raw_name}</td>
                      <td className="p-2">
                        <Select
                          value={bi.item_id ?? "none"}
                          onValueChange={(v) => {
                            const updated = [...billItems];
                            updated[i] = { ...updated[i], item_id: v === "none" ? null : v };
                            setBillItems(updated);
                          }}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Unmatched" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— skip —</SelectItem>
                            {items.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={bi.qty}
                          onChange={(e) => {
                            const updated = [...billItems];
                            updated[i] = { ...updated[i], qty: e.target.value };
                            setBillItems(updated);
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={bi.rate}
                          onChange={(e) => {
                            const updated = [...billItems];
                            updated[i] = { ...updated[i], rate: e.target.value };
                            setBillItems(updated);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
 
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
 
// ─── Delete Confirm Dialog ───────────────────────────────────────────────────
 
function DeleteBillDialog({
  bill,
  open,
  onClose,
}: {
  bill: any;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
 
  const mut = useMutation({
    mutationFn: async () => {
      // Reverse stock changes
      const { data: billItems } = await supabase
        .from("bill_items")
        .select("*")
        .eq("bill_id", bill.id);
 
      if (billItems?.length) {
        for (const bi of billItems) {
          if (!bi.item_id) continue;
          const { data: item } = await supabase
            .from("items")
            .select("available_qty")
            .eq("id", bi.item_id)
            .single();
          if (!item) continue;
          const qty = Number(bi.qty) || 0;
          const newQty =
            bill.type === "purchase"
              ? Number(item.available_qty) - qty
              : Number(item.available_qty) + qty;
          await supabase
            .from("items")
            .update({ available_qty: newQty })
            .eq("id", bi.item_id);
        }
      }
 
      // Delete bill_items first, then bill
      await supabase.from("bill_items").delete().eq("bill_id", bill.id);
      const { error } = await supabase.from("bills").delete().eq("id", bill.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bill deleted and stock reversed");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });
 
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Bill?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete bill{" "}
            <strong>{bill.bill_no ?? bill.id.slice(0, 8)}</strong>
            {bill.vendor ? ` from ${bill.vendor}` : ""} and <strong>reverse</strong> its
            stock changes. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mut.isPending ? "Deleting…" : "Yes, Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
 
// ─── Main Bills Page ─────────────────────────────────────────────────────────
 
function BillsPage() {
  const qc = useQueryClient();
  const bills = useQuery({ queryKey: ["bills"], queryFn: fetchBills });
  const items = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const saudas = useQuery({ queryKey: ["saudas"], queryFn: fetchSaudas });
  const extract = useServerFn(extractBillFromImage);
 
  const [type, setType] = useState<"purchase" | "sale">("purchase");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ExtractedBill | null>(null);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<(string | null)[]>([]);
  const [linkSaudaId, setLinkSaudaId] = useState<string>("none");
 
  const [editBill, setEditBill] = useState<any | null>(null);
  const [deleteBill, setDeleteBill] = useState<any | null>(null);
 
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
 
      if (linkSaudaId && linkSaudaId !== "none") {
        const sauda = (saudas.data as any[] | undefined)?.find((s) => s.id === linkSaudaId);
        const billQty = rows.reduce((a, r) => a + Number(r.qty || 0), 0);
 
        const { error: linkErr } = await supabase
          .from("saudas")
          .update({ linked_bill_id: bill.id })
          .eq("id", linkSaudaId);
        if (linkErr) throw linkErr;
 
        if (billQty > 0) {
          const { error: upErr } = await supabase.from("sauda_uplifts").insert({
            sauda_id: linkSaudaId,
            qty: billQty,
            kind: "bill",
            bill_id: bill.id,
            note: `Bill ${draft.bill_no ?? bill.id.slice(0, 6)}`,
          });
          if (upErr) throw upErr;
 
          const itemsTotal = (sauda?.sauda_items ?? []).reduce(
            (a: number, r: any) => a + Number(r.qty || 0),
            0,
          );
          const totalQty = Number(sauda?.total_qty || 0) || itemsTotal;
          const newLifted = Number(sauda?.lifted_qty ?? 0) + billQty;
          const cappedLifted = totalQty > 0 ? Math.min(totalQty, newLifted) : newLifted;
          const newStatus = totalQty > 0 && cappedLifted >= totalQty ? "done" : sauda?.status ?? "open";
          const { error: sErr } = await supabase
            .from("saudas")
            .update({ lifted_qty: cappedLifted, status: newStatus })
            .eq("id", linkSaudaId);
          if (sErr) throw sErr;
        }
      }
    },
    onSuccess: () => {
      toast.success("Bill saved");
      setDraft(null); setFile(null); setMatches([]); setLinkSaudaId("none");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["saudas"] });
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
              <div className="space-y-1">
                <Label>Link to Sauda (optional)</Label>
                <Select value={linkSaudaId} onValueChange={setLinkSaudaId}>
                  <SelectTrigger className="w-full max-w-md"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {saudas.data?.filter((s: any) => s.status !== "done").map((s: any) => {
                      const itemsTotal = (s.sauda_items ?? []).reduce((a: number, r: any) => a + Number(r.qty || 0), 0);
                      const totalQty = Number(s.total_qty || 0) || itemsTotal;
                      const pending = Math.max(0, totalQty - Number(s.lifted_qty || 0));
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {s.party_name} — {s.sauda_date} — basic {s.sauda_basic} — pending {pending}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save Bill & Update Stock"}
                </Button>
                <Button variant="outline" onClick={() => { setDraft(null); setMatches([]); setLinkSaudaId("none"); }}>Cancel</Button>
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
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.data?.map((b: any) => (
                <tr key={b.id} className="border-b hover:bg-muted/40">
                  <td className="p-2">{b.bill_date ?? new Date(b.created_at).toLocaleDateString()}</td>
                  <td className="p-2">
                    <Badge variant={b.type === "purchase" ? "default" : "secondary"}>{b.type}</Badge>
                  </td>
                  <td className="p-2">{b.vendor ?? "—"}</td>
                  <td className="p-2">{b.bill_no ?? "—"}</td>
                  <td className="p-2">{b.bill_items?.length ?? 0}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Edit bill"
                        onClick={() => setEditBill(b)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Delete bill"
                        onClick={() => setDeleteBill(b)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!bills.data?.length && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No bills yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
 
      {editBill && (
        <EditBillDialog
          bill={editBill}
          items={items.data ?? []}
          open={!!editBill}
          onClose={() => setEditBill(null)}
        />
      )}
 
      {deleteBill && (
        <DeleteBillDialog
          bill={deleteBill}
          open={!!deleteBill}
          onClose={() => setDeleteBill(null)}
        />
      )}
    </div>
  );
}
 
