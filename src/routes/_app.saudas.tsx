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
            <Card key={cat} className="overflow-hidden">
              <CardHeader className="bg-muted/40 border-b py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-base">{cat}</CardTitle>
                  <Badge variant="secondary">{rows.length} saudas</Badge>
                  <Badge variant="outline">{openCount} open</Badge>
                  <div className="ml-auto flex items-center gap-4 text-xs">
                    <div className="text-muted-foreground">Total <span className="font-mono font-semibold text-foreground">{catTotal}</span></div>
                    <div className="text-muted-foreground">Lifted <span className="font-mono font-semibold text-foreground">{catLifted}</span></div>
                    <div className="text-muted-foreground">Pending <span className="font-mono font-semibold text-primary">{catPending}</span></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y">
                {rows.map((s: any) => {
                  const totalQty = totalQtyOf(s);
                  const lifted = Number(s.lifted_qty || 0);
                  const pending = Math.max(0, totalQty - lifted);
                  const isOpen = expanded[s.id];
                  const ups = (s.sauda_uplifts ?? []).slice().sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));
                  const done = s.status === "done";
                  const progress = totalQty > 0 ? Math.min(100, (lifted / totalQty) * 100) : 0;
                  return (
                    <div key={s.id} className={done ? "opacity-60" : ""}>
                      <div className="p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => setExpanded({ ...expanded, [s.id]: !isOpen })}
                            className="mt-1 text-muted-foreground hover:text-foreground"
                            aria-label="Toggle details"
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>

                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-base">{s.party_name}</span>
                              <Badge variant={done ? "secondary" : pending === 0 ? "default" : "outline"}>
                                {done ? "Done" : pending === 0 ? "Fulfilled" : "Open"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{s.sauda_date}</span>
                              {s.bills && (
                                <Badge variant="outline" className="text-xs">
                                  Bill: {s.bills.bill_no ?? s.bills.vendor}
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Basic</div>
                                <div className="font-mono font-medium">{s.sauda_basic}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sauda Qty</div>
                                <div className="font-mono font-medium">{totalQty}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Lifted</div>
                                <div className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{lifted}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending</div>
                                <div className="font-mono font-semibold text-primary">{pending}</div>
                              </div>
                            </div>

                            {totalQty > 0 && (
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                              </div>
                            )}

                            {s.notes && (
                              <div className="text-xs text-muted-foreground italic">"{s.notes}"</div>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-1 shrink-0">
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
                        </div>
                      </div>

                      {isOpen && (
                        <div className="bg-muted/20 border-t px-4 py-3 space-y-3">
                          <div className="flex items-end gap-2 flex-wrap">
                            <div className="flex-1 min-w-[100px]">
                              <Label className="text-xs">Adjust Qty</Label>
                              <Input
                                className="h-9"
                                type="number"
                                placeholder="e.g. 5"
                                value={adjustDelta[s.id] ?? ""}
                                onChange={(e) => setAdjustDelta({ ...adjustDelta, [s.id]: e.target.value })}
                              />
                            </div>
                            <div className="flex-[2] min-w-[160px]">
                              <Label className="text-xs">Note</Label>
                              <Input
                                className="h-9"
                                placeholder="optional"
                                value={adjustNote[s.id] ?? ""}
                                onChange={(e) => setAdjustNote({ ...adjustNote, [s.id]: e.target.value })}
                              />
                            </div>
                            <Button size="sm" onClick={() => requestAdjust(s, 1)}>Lift +</Button>
                            <Button size="sm" variant="outline" onClick={() => requestAdjust(s, -1)}>Unlift −</Button>
                          </div>

                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Uplift History</div>
                            {ups.length ? (
                              <div className="rounded-md border bg-background divide-y">
                                {ups.map((u: any) => (
                                  <div key={u.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                                    <span className="text-muted-foreground whitespace-nowrap w-36">{new Date(u.created_at).toLocaleString()}</span>
                                    <Badge variant={u.kind === "bill" ? "default" : "secondary"} className="text-[10px]">{u.kind}</Badge>
                                    <span className={`font-mono font-semibold ml-auto ${Number(u.qty) < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                                      {Number(u.qty) > 0 ? "+" : ""}{u.qty}
                                    </span>
                                    {u.note && <span className="text-muted-foreground truncate max-w-[180px]">{u.note}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground italic">No uplifts yet.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
