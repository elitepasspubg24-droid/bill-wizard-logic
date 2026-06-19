import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, Fragment } from "react";
import { fetchSaudas, fetchBills, fetchFactories } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/saudas")({
  component: SaudasPage,
  head: () => ({ meta: [{ title: "Saudas" }] }),
});

function totalQtyOf(s: any): number {
  const t = Number(s.total_qty || 0);
  if (t > 0) return t;
  return (s.sauda_items ?? []).reduce((a: number, i: any) => a + Number(i.qty || 0), 0);
}

function SaudasPage() {
  const qc = useQueryClient();
  const saudas = useQuery({ queryKey: ["saudas"], queryFn: fetchSaudas });
  const bills = useQuery({ queryKey: ["bills"], queryFn: fetchBills });
  const factories = useQuery({ queryKey: ["factories"], queryFn: fetchFactories });

  const [party, setParty] = useState("");
  const [factoryId, setFactoryId] = useState<string>("");
  const [basic, setBasic] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [linkedBill, setLinkedBill] = useState<string>("");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!party) throw new Error("Party name required");
      if (!factoryId) throw new Error("Factory required");
      if (!basic || Number(basic) <= 0) throw new Error("Sauda basic rate required");
      if (!qty || Number(qty) <= 0) throw new Error("Quantity required");
      const { error } = await supabase.from("saudas").insert({
        party_name: party,
        factory_id: factoryId,
        sauda_basic: Number(basic),
        total_qty: Number(qty),
        sauda_date: date,
        linked_bill_id: linkedBill || null,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sauda saved");
      setParty(""); setBasic(""); setQty(""); setLinkedBill(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["saudas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Saudas</h2>
        <p className="text-sm text-muted-foreground">Record a purchase sauda. Lifts happen automatically when you link a purchase bill, or adjust manually below.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New Sauda</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><Label>Party Name</Label><Input value={party} onChange={(e) => setParty(e.target.value)} /></div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div>
              <Label>Factory</Label>
              <Select value={factoryId} onValueChange={setFactoryId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {factories.data?.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Sauda Basic</Label><Input type="number" value={basic} onChange={(e) => setBasic(e.target.value)} /></div>
            <div><Label>Quantity</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div>
              <Label>Link Purchase Bill (optional)</Label>
              <Select value={linkedBill || "none"} onValueChange={(v) => setLinkedBill(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— none —</SelectItem>
                  {bills.data?.filter((b: any) => b.type === "purchase").map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bill_no ?? "(no #)"} — {b.vendor ?? "?"} — {b.bill_date ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save Sauda"}
          </Button>
        </CardContent>
      </Card>

      <SaudasByCategory data={saudas.data ?? []} onChanged={() => qc.invalidateQueries({ queryKey: ["saudas"] })} />
    </div>
  );
}

function SaudasByCategory({ data, onChanged }: { data: any[]; onChanged: () => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<any | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<Record<string, string>>({});
  const [adjustNote, setAdjustNote] = useState<Record<string, string>>({});
  const [pendingAdjust, setPendingAdjust] = useState<{ sauda: any; delta: number; note: string } | null>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("sauda_uplifts").delete().eq("sauda_id", id);
      await supabase.from("sauda_items").delete().eq("sauda_id", id);
      const { error } = await supabase.from("saudas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sauda deleted"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const uplift = useMutation({
    mutationFn: async (p: { sauda: any; delta: number; note?: string; kind?: string }) => {
      if (!p.delta) throw new Error("Enter a non-zero quantity");
      const totalQty = totalQtyOf(p.sauda);
      const curLifted = Number(p.sauda.lifted_qty || 0);
      const newLifted = curLifted + p.delta;
      if (newLifted < 0) throw new Error("Cannot reduce below zero");
      const capped = totalQty > 0 ? Math.min(totalQty, newLifted) : newLifted;
      const { error: e1 } = await supabase.from("sauda_uplifts").insert({
        sauda_id: p.sauda.id,
        qty: p.delta,
        kind: p.kind ?? "manual",
        note: p.note || null,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("saudas")
        .update({
          lifted_qty: capped,
          status: totalQty > 0 && capped >= totalQty ? "done" : p.sauda.status === "done" ? "open" : p.sauda.status,
        })
        .eq("id", p.sauda.id);
      if (e2) throw e2;
    },
    onSuccess: (_d, p) => {
      toast.success(p.delta > 0 ? "Lifted" : "Reversed");
      setAdjustDelta((m) => ({ ...m, [p.sauda.id]: "" }));
      setAdjustNote((m) => ({ ...m, [p.sauda.id]: "" }));
      setPendingAdjust(null);
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleDone = useMutation({
    mutationFn: async (s: any) => {
      const next = s.status === "done" ? "open" : "done";
      const { error } = await supabase.from("saudas").update({ status: next }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = new Map<string, any[]>();
  for (const s of data) {
    const key = s.factories?.name ?? "Uncategorised";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  const groups = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  if (!data.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Recent Saudas</CardTitle></CardHeader>
        <CardContent className="p-6 text-center text-muted-foreground">No saudas yet.</CardContent>
      </Card>
    );
  }

  function requestAdjust(s: any, signMultiplier: 1 | -1) {
    const raw = Number(adjustDelta[s.id]);
    if (!raw || isNaN(raw)) { toast.error("Enter a quantity"); return; }
    const delta = Math.abs(raw) * signMultiplier;
    setPendingAdjust({ sauda: s, delta, note: adjustNote[s.id] ?? "" });
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map(([cat, rows]) => {
          const catTotal = rows.reduce((a, s) => a + totalQtyOf(s), 0);
          const catLifted = rows.reduce((a, s) => a + Number(s.lifted_qty || 0), 0);
          const catPending = Math.max(0, catTotal - catLifted);
          const openCount = rows.filter((r) => r.status !== "done").length;
          return (
            <Card key={cat}>
              <CardHeader>
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  <span>{cat}</span>
                  <Badge variant="secondary">{rows.length} saudas</Badge>
                  <Badge variant="outline">{openCount} open</Badge>
                  <span className="text-xs font-normal text-muted-foreground ml-auto">
                    Total {catTotal} · Lifted {catLifted} · <span className="text-foreground font-semibold">Pending {catPending}</span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="p-2 w-6"></th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Party</th>
                      <th className="p-2">Status</th>
                      <th className="p-2 text-right">Basic</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Lifted</th>
                      <th className="p-2 text-right">Pending</th>
                      <th className="p-2">Linked Bill</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s: any) => {
                      const totalQty = totalQtyOf(s);
                      const lifted = Number(s.lifted_qty || 0);
                      const pending = Math.max(0, totalQty - lifted);
                      const isOpen = expanded[s.id];
                      const ups = (s.sauda_uplifts ?? []).slice().sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));
                      const done = s.status === "done";
                      return (
                        <Fragment key={s.id}>
                          <tr className={`border-b ${done ? "opacity-60" : ""}`}>
                            <td className="p-2">
                              <button onClick={() => setExpanded({ ...expanded, [s.id]: !isOpen })} className="text-muted-foreground">
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            </td>
                            <td className="p-2 whitespace-nowrap">{s.sauda_date}</td>
                            <td className="p-2 font-medium">
                              {s.party_name}
                              {s.notes && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{s.notes}</div>}
                            </td>
                            <td className="p-2">
                              <Badge variant={done ? "secondary" : pending === 0 ? "default" : "outline"}>
                                {done ? "Done" : pending === 0 ? "Fulfilled" : "Open"}
                              </Badge>
                            </td>
                            <td className="p-2 text-right font-mono">{s.sauda_basic}</td>
                            <td className="p-2 text-right font-mono">{totalQty}</td>
                            <td className="p-2 text-right font-mono">{lifted}</td>
                            <td className="p-2 text-right font-mono font-semibold">{pending}</td>
                            <td className="p-2">
                              {s.bills ? <Badge variant="outline">{s.bills.bill_no ?? s.bills.vendor}</Badge> : "—"}
                            </td>
                            <td className="p-2 text-right">
                              <div className="flex justify-end gap-1 flex-wrap">
                                <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Modify</Button>
                                <Button size="sm" variant={done ? "outline" : "default"} onClick={() => toggleDone.mutate(s)}>
                                  {done ? "Reopen" : "Done"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={del.isPending}
                                  onClick={() => { if (confirm(`Delete sauda for ${s.party_name}?`)) del.mutate(s.id); }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-muted/30">
                              <td></td>
                              <td colSpan={9} className="p-3 space-y-3">
                                <div>
                                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Uplift History</div>
                                  <table className="w-full text-xs border">
                                    <thead className="bg-background border-b">
                                      <tr>
                                        <th className="p-1 text-left">When</th>
                                        <th className="p-1">Kind</th>
                                        <th className="p-1 text-right">Qty</th>
                                        <th className="p-1 text-left">Note</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ups.map((u: any) => (
                                        <tr key={u.id} className="border-b last:border-0">
                                          <td className="p-1 whitespace-nowrap">{new Date(u.created_at).toLocaleString()}</td>
                                          <td className="p-1"><Badge variant={u.kind === "bill" ? "default" : "secondary"}>{u.kind}</Badge></td>
                                          <td className={`p-1 text-right font-mono ${Number(u.qty) < 0 ? "text-destructive" : ""}`}>
                                            {Number(u.qty) > 0 ? "+" : ""}{u.qty}
                                          </td>
                                          <td className="p-1">{u.note ?? "—"}</td>
                                        </tr>
                                      ))}
                                      {!ups.length && (
                                        <tr><td colSpan={4} className="p-2 text-center text-muted-foreground">No uplifts yet.</td></tr>
                                      )}
                                    </tbody>
                                  </table>
                                  <div className="flex gap-2 mt-2 items-end flex-wrap">
                                    <div className="flex-1 min-w-[120px]">
                                      <Label className="text-xs">Quantity</Label>
                                      <Input
                                        className="h-8"
                                        type="number"
                                        placeholder="e.g. 5"
                                        value={adjustDelta[s.id] ?? ""}
                                        onChange={(e) => setAdjustDelta({ ...adjustDelta, [s.id]: e.target.value })}
                                      />
                                    </div>
                                    <div className="flex-[2] min-w-[140px]">
                                      <Label className="text-xs">Note</Label>
                                      <Input
                                        className="h-8"
                                        placeholder="optional"
                                        value={adjustNote[s.id] ?? ""}
                                        onChange={(e) => setAdjustNote({ ...adjustNote, [s.id]: e.target.value })}
                                      />
                                    </div>
                                    <Button size="sm" onClick={() => requestAdjust(s, 1)}>Lift +</Button>
                                    <Button size="sm" variant="outline" onClick={() => requestAdjust(s, -1)}>Unlift −</Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!pendingAdjust} onOpenChange={(o) => { if (!o) setPendingAdjust(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm adjustment</DialogTitle></DialogHeader>
          {pendingAdjust && (
            <div className="space-y-2 text-sm">
              <div><b>{pendingAdjust.sauda.party_name}</b> — {pendingAdjust.sauda.sauda_date}</div>
              <div>
                {pendingAdjust.delta > 0 ? "Lift" : "Unlift"}{" "}
                <span className="font-mono font-semibold">{Math.abs(pendingAdjust.delta)}</span>{" "}
                {pendingAdjust.delta > 0 ? "onto" : "from"} this sauda?
              </div>
              <div className="text-muted-foreground">
                Current lifted: {Number(pendingAdjust.sauda.lifted_qty || 0)} / {totalQtyOf(pendingAdjust.sauda)}
              </div>
              {pendingAdjust.note && <div className="text-muted-foreground">Note: {pendingAdjust.note}</div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAdjust(null)}>Cancel</Button>
            <Button
              disabled={uplift.isPending}
              onClick={() => pendingAdjust && uplift.mutate(pendingAdjust)}
            >
              {uplift.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModifySaudaDialog
        sauda={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); onChanged(); }}
      />
    </>
  );
}

function ModifySaudaDialog({ sauda, onClose, onSaved }: { sauda: any | null; onClose: () => void; onSaved: () => void }) {
  const [party, setParty] = useState("");
  const [basic, setBasic] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (sauda) {
      setParty(sauda.party_name ?? "");
      setBasic(String(sauda.sauda_basic ?? ""));
      setQty(String(totalQtyOf(sauda) || ""));
      setDate(sauda.sauda_date ?? "");
      setNotes(sauda.notes ?? "");
    }
  }, [sauda?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!sauda) return;
      const { error } = await supabase
        .from("saudas")
        .update({
          party_name: party,
          sauda_basic: Number(basic),
          total_qty: Number(qty) || 0,
          sauda_date: date,
          notes: notes || null,
        })
        .eq("id", sauda.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); reset(); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  function reset() {
    setParty(""); setBasic(""); setQty(""); setDate(""); setNotes("");
  }

  return (
    <Dialog open={!!sauda} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Modify Sauda</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Party</Label><Input value={party} onChange={(e) => setParty(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Basic</Label><Input type="number" value={basic} onChange={(e) => setBasic(e.target.value)} /></div>
            <div><Label>Qty</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
