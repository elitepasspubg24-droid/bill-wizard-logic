import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchFactories, fetchSections, fetchItems, fetchSaudas } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { List } from "lucide-react";

export const Route = createFileRoute("/_app/items")({
  component: ItemsPage,
  head: () => ({ meta: [{ title: "Items" }] }),
});

function ItemsPage() {
  const factories = useQuery({ queryKey: ["factories"], queryFn: fetchFactories });
  const sections = useQuery({ queryKey: ["sections"], queryFn: fetchSections });
  const items = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const saudas = useQuery({ queryKey: ["saudas"], queryFn: fetchSaudas });
  const [q, setQ] = useState("");

  // For each factory, find the open sauda with the highest pending qty.
  const topPendingByFactory = useMemo(() => {
    const map = new Map<string, { basic: number; party: string; qty: number }>();
    if (!saudas.data) return map;
    for (const s of saudas.data as any[]) {
      if (!s.factory_id) continue;
      if (s.status === "done") continue;
      const itemsTotal = (s.sauda_items ?? []).reduce((a: number, r: any) => a + Number(r.qty || 0), 0);
      const total = Number(s.total_qty || 0) || itemsTotal;
      const qty = Math.max(0, total - Number(s.lifted_qty || 0));
      if (qty <= 0) continue;
      const cur = map.get(s.factory_id);
      if (!cur || qty > cur.qty) {
        map.set(s.factory_id, { basic: Number(s.sauda_basic), party: s.party_name, qty });
      }
    }
    return map;
  }, [saudas.data]);

  const grouped = useMemo(() => {
    if (!sections.data || !items.data || !factories.data) return [];
    const fmap = new Map(factories.data.map((f) => [f.id, f]));
    return sections.data.map((s) => {
      const f = fmap.get(s.factory_id);
      const baseToday = (f?.basic_rate ?? 0) + Number(s.adder);
      const top = topPendingByFactory.get(s.factory_id);
      const baseSauda = top ? top.basic + Number(s.adder) : null;
      const baseParty = Number(s.party_basic) + Number(s.adder);
      const rows = items
        .data!.filter((i) => i.section_id === s.id)
        .filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()))
        .map((i) => ({
          ...i,
          today: baseToday + Number(i.gauge_diff),
          sauda: baseSauda === null ? null : baseSauda + Number(i.gauge_diff),
          party: baseParty + Number(i.gauge_diff),
        }));
      return { section: s, factory: f, top, rows };
    }).filter((g) => g.rows.length > 0);
  }, [factories.data, sections.data, items.data, topPendingByFactory, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Items</h2>
          <p className="text-sm text-muted-foreground">
            Sauda Rate = top-pending sauda basic (per factory) + section adder + gauge diff.
          </p>
        </div>
        <Input placeholder="Search item…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      {grouped.map(({ section, factory, top, rows }) => (
        <Card key={section.id} id={`section-${section.id}`} className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base">
              {section.name}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({factory?.name} {factory?.basic_rate} + {section.adder} adder
                {top ? ` · sauda ${top.basic} from ${top.party} (${top.qty} pending)` : " · no pending sauda"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Gauge Diff</th>
                  <th className="p-2 text-right">Today's Rate</th>
                  <th className="p-2 text-right">Sauda Rate</th>
                  <th className="p-2 text-right">Party Rate</th>
                  <th className="p-2 text-right">Available Qty</th>
                  <th className="p-2 text-right">Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="p-2 text-right text-muted-foreground">{r.gauge_diff}</td>
                    <td className="p-2 text-right font-mono">{r.today.toFixed(0)}</td>
                    <td className="p-2 text-right font-mono">{r.sauda === null ? "—" : r.sauda.toFixed(0)}</td>
                    <td className="p-2 text-right font-mono">{r.party.toFixed(0)}</td>
                    <td className="p-2 text-right">{Number(r.available_qty).toFixed(2)}</td>
                    <td className="p-2 text-right">{r.last_purchase_rate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
            aria-label="Jump to category"
          >
            <List className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="max-h-96 overflow-y-auto w-64">
          <DropdownMenuLabel>Jump to category</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {grouped.map(({ section, factory }) => (
            <DropdownMenuItem
              key={section.id}
              onSelect={() => {
                document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <div className="flex flex-col">
                <span className="font-medium">{section.name}</span>
                <span className="text-xs text-muted-foreground">{factory?.name}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
