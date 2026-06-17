import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchSaudas, fetchBills, fetchFactories, fetchItems } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/saudas")({
  component: SaudasPage,
  head: () => ({ meta: [{ title: "Saudas" }] }),
});

type Row = { item_id: string | null; raw_name: string; qty: string; rate: string };

function SaudasPage() {
  const qc = useQueryClient();
  const saudas = useQuery({ queryKey: ["saudas"], queryFn: fetchSaudas });
  const bills = useQuery({ queryKey: ["bills"], queryFn: fetchBills });
  const factories = useQuery({ queryKey: ["factories"], queryFn: fetchFactories });
  const items = useQuery({ queryKey: ["items"], queryFn: fetchItems });

  const [party, setParty] = useState("");
  const [factoryId, setFactoryId] = useState<string>("");
  const [basic, setBasic] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [linkedBill, setLinkedBill] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([{ item_id: null, raw_name: "", qty: "", rate: "" }]);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!party) throw new Error("Party name required");
      if (!basic || Number(basic) <= 0) throw new Error("Sauda basic rate required");
      const validRows = rows.filter((r) => Number(r.qty) > 0 && Number(r.rate) > 0);
      if (!validRows.length) throw new Error("At least one row with qty and rate required");
      const { data: s, error } = await supabase.from("saudas").insert({
        party_name: party,
        factory_id: factoryId || null,
        sauda_basic: Number(basic),
        sauda_date: date,
        linked_bill_id: linkedBill || null,
        notes: notes || null,
      }).select().single();
      if (error) throw error;
      const sItems = validRows.map((r) => ({
        sauda_id: s.id,
        item_id: r.item_id,
        raw_name: r.raw_name || items.data?.find((i) => i.id === r.item_id)?.name || "",
        qty: Number(r.qty),
        rate: Number(r.rate),
      }));
      const { error: e2 } = await supabase.from("sauda_items").insert(sItems);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Sauda saved");
      setParty(""); setBasic(""); setLinkedBill(""); setNotes("");
      setRows([{ item_id: null, raw_name: "", qty: "", rate: "" }]);
      qc.invalidateQueries({ queryKey: ["saudas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Saudas</h2>
        <p className="text-sm text-muted-foreground">Manually enter party saudas and optionally link a purchase bill.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New Sauda</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div><Label>Notes</Label><Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Select value={r.item_id ?? "none"} onValueChange={(v) => updateRow(i, { item_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Item…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— custom name —</SelectItem>
                      {items.data?.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input className="col-span-3" placeholder="Custom name" value={r.raw_name} onChange={(e) => updateRow(i, { raw_name: e.target.value })} />
                <Input className="col-span-2" type="number" placeholder="Qty" value={r.qty} onChange={(e) => updateRow(i, { qty: e.target.value })} />
                <Input className="col-span-2" type="number" placeholder="Rate" value={r.rate} onChange={(e) => updateRow(i, { rate: e.target.value })} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, { item_id: null, raw_name: "", qty: "", rate: "" }])}>
              + Add Row
            </Button>
          </div>

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
  const del = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("sauda_items").delete().eq("sauda_id", id);
      const { error } = await supabase.from("saudas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sauda deleted"); onChanged(); },
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

  return (
    <div className="space-y-4">
      {groups.map(([cat, rows]) => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span>{cat}</span>
              <Badge variant="secondary">{rows.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="p-2">Date</th>
                  <th className="p-2">Party</th>
                  <th className="p-2 text-right">Basic</th>
                  <th className="p-2">Items</th>
                  <th className="p-2">Linked Bill</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s: any) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="p-2 whitespace-nowrap">{s.sauda_date}</td>
                    <td className="p-2 font-medium">{s.party_name}</td>
                    <td className="p-2 text-right font-mono">{s.sauda_basic}</td>
                    <td className="p-2">{s.sauda_items?.length ?? 0}</td>
                    <td className="p-2">
                      {s.bills ? <Badge variant="outline">{s.bills.bill_no ?? s.bills.vendor}</Badge> : "—"}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={del.isPending}
                        onClick={() => {
                          if (confirm(`Delete sauda for ${s.party_name}?`)) del.mutate(s.id);
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
