import { createFileRoute } from "@tanstack/react-router";
import { Fragment as FragmentWith } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchFactories, fetchSections } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/history")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "Rate History" }] }),
});

function dayKey(ts: string) {
  return new Date(ts).toISOString().slice(0, 10);
}

function HistoryPage() {
  const factories = useQuery({ queryKey: ["factories"], queryFn: fetchFactories });
  const sections = useQuery({ queryKey: ["sections"], queryFn: fetchSections });

  const fHistory = useQuery({
    queryKey: ["factory_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factory_rate_history")
        .select("*")
        .order("changed_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });

  const sHistory = useQuery({
    queryKey: ["section_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_rate_history")
        .select("*")
        .order("changed_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });

  // Pivot: rows = date (desc), cols = factory => last rate on that day
  const factoryPivot = useMemo(() => {
    const byDay = new Map<string, Map<string, number>>();
    for (const r of fHistory.data ?? []) {
      const d = dayKey(r.changed_at);
      if (!byDay.has(d)) byDay.set(d, new Map());
      byDay.get(d)!.set(r.factory_id, Number(r.basic_rate));
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [fHistory.data]);

  const sectionPivot = useMemo(() => {
    const byDay = new Map<string, Map<string, { adder: number; sauda: number; party: number }>>();
    for (const r of sHistory.data ?? []) {
      const d = dayKey(r.changed_at);
      if (!byDay.has(d)) byDay.set(d, new Map());
      byDay.get(d)!.set(r.section_id, {
        adder: Number(r.adder),
        sauda: Number(r.sauda_basic),
        party: Number(r.party_basic),
      });
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [sHistory.data]);

  const factoryCols = factories.data ?? [];
  const sectionCols = sections.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Rate History</h2>
        <p className="text-sm text-muted-foreground">
          Daily snapshot of factory and section rates. Each row is one date, columns are factories/sections.
        </p>
      </div>

      <Tabs defaultValue="factories">
        <TabsList>
          <TabsTrigger value="factories">Factory Rates</TabsTrigger>
          <TabsTrigger value="sections">Section Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="factories">
          <Card>
            <CardHeader><CardTitle className="text-base">Daily Factory Basic Rates</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-2 text-left">Date</th>
                    {factoryCols.map((f) => (
                      <th key={f.id} className="p-2 text-right whitespace-nowrap">{f.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {factoryPivot.map(([d, row]) => (
                    <tr key={d} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2 font-medium whitespace-nowrap">{d}</td>
                      {factoryCols.map((f) => (
                        <td key={f.id} className="p-2 text-right font-mono">
                          {row.has(f.id) ? row.get(f.id) : <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!factoryPivot.length && (
                    <tr><td colSpan={factoryCols.length + 1} className="p-6 text-center text-muted-foreground">No history yet.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections">
          <Card>
            <CardHeader><CardTitle className="text-base">Daily Section Rates (Adder / Sauda / Party)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-2 text-left" rowSpan={2}>Date</th>
                    {sectionCols.map((s) => (
                      <th key={s.id} className="p-2 text-center border-l" colSpan={3}>{s.name}</th>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/20 text-muted-foreground">
                    {sectionCols.map((s) => (
                      <FragmentWith key={s.id}>
                        <th className="p-1 text-right border-l">Adder</th>
                        <th className="p-1 text-right">Sauda</th>
                        <th className="p-1 text-right">Party</th>
                      </FragmentWith>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectionPivot.map(([d, row]) => (
                    <tr key={d} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2 font-medium whitespace-nowrap">{d}</td>
                      {sectionCols.map((s) => {
                        const v = row.get(s.id);
                        return (
                          <>
                            <td key={s.id + "a"} className="p-1 text-right font-mono border-l">{v ? v.adder : "—"}</td>
                            <td key={s.id + "s"} className="p-1 text-right font-mono">{v ? v.sauda : "—"}</td>
                            <td key={s.id + "p"} className="p-1 text-right font-mono">{v ? v.party : "—"}</td>
                          </>
                        );
                      })}
                    </tr>
                  ))}
                  {!sectionPivot.length && (
                    <tr><td colSpan={sectionCols.length * 3 + 1} className="p-6 text-center text-muted-foreground">No history yet.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
