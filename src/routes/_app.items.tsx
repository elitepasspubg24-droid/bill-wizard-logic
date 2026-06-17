import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchFactories, fetchSections, fetchItems } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/items")({
  component: ItemsPage,
  head: () => ({ meta: [{ title: "Items" }] }),
});

function ItemsPage() {
  const factories = useQuery({ queryKey: ["factories"], queryFn: fetchFactories });
  const sections = useQuery({ queryKey: ["sections"], queryFn: fetchSections });
  const items = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    if (!sections.data || !items.data || !factories.data) return [];
    const fmap = new Map(factories.data.map((f) => [f.id, f]));
    return sections.data.map((s) => {
      const f = fmap.get(s.factory_id);
      const baseToday = (f?.basic_rate ?? 0) + Number(s.adder);
      const baseSauda = Number(s.sauda_basic) + Number(s.adder);
      const baseParty = Number(s.party_basic) + Number(s.adder);
      const rows = items
        .data!.filter((i) => i.section_id === s.id)
        .filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()))
        .map((i) => ({
          ...i,
          today: baseToday + Number(i.gauge_diff),
          sauda: baseSauda + Number(i.gauge_diff),
          party: baseParty + Number(i.gauge_diff),
        }));
      return { section: s, factory: f, rows };
    }).filter((g) => g.rows.length > 0);
  }, [factories.data, sections.data, items.data, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Items</h2>
          <p className="text-sm text-muted-foreground">Live rates: factory basic + section adder + item gauge diff.</p>
        </div>
        <Input placeholder="Search item…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      {grouped.map(({ section, factory, rows }) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {section.name}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({factory?.name} {factory?.basic_rate} + {section.adder} adder)
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
                    <td className="p-2 text-right font-mono">{r.sauda.toFixed(0)}</td>
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
    </div>
  );
}
