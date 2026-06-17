import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fetchFactories, fetchSections } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/")({
  component: RatesPage,
  head: () => ({ meta: [{ title: "Daily Rates" }] }),
});

function RatesPage() {
  const qc = useQueryClient();
  const factories = useQuery({ queryKey: ["factories"], queryFn: fetchFactories });
  const sections = useQuery({ queryKey: ["sections"], queryFn: fetchSections });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Daily Factory Rates</h2>
        <p className="text-sm text-muted-foreground">
          Update each factory's basic rate. All Today/Sauda/Party rates auto-recompute.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Factory Basic Rates</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {factories.data?.map((f) => (
            <FactoryRow key={f.id} factory={f} onSaved={() => qc.invalidateQueries({ queryKey: ["factories"] })} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Section Adders & Basics</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="p-2">Section</th>
                <th className="p-2">Factory</th>
                <th className="p-2">Adder (+)</th>
                <th className="p-2">Sauda Basic</th>
                <th className="p-2">Party Basic</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {sections.data?.map((s) => (
                <SectionRow
                  key={s.id}
                  section={s}
                  factories={factories.data ?? []}
                  onSaved={() => qc.invalidateQueries({ queryKey: ["sections"] })}
                />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function FactoryRow({ factory, onSaved }: { factory: any; onSaved: () => void }) {
  const [v, setV] = useState(String(factory.basic_rate));
  useEffect(() => setV(String(factory.basic_rate)), [factory.basic_rate]);
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("factories")
        .update({ basic_rate: Number(v), updated_at: new Date().toISOString() })
        .eq("id", factory.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`${factory.name} updated`); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="border rounded-md p-3">
      <Label className="text-xs">{factory.name}</Label>
      <div className="flex gap-2 mt-1">
        <Input type="number" value={v} onChange={(e) => setV(e.target.value)} />
        <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
      </div>
    </div>
  );
}

function SectionRow({ section, factories, onSaved }: any) {
  const [adder, setAdder] = useState(String(section.adder));
  const [sb, setSb] = useState(String(section.sauda_basic));
  const [pb, setPb] = useState(String(section.party_basic));
  const factory = factories.find((f: any) => f.id === section.factory_id);
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("sections")
        .update({ adder: Number(adder), sauda_basic: Number(sb), party_basic: Number(pb) })
        .eq("id", section.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <tr className="border-b">
      <td className="p-2 font-medium">{section.name}</td>
      <td className="p-2 text-muted-foreground">{factory?.name ?? "—"}</td>
      <td className="p-2"><Input className="w-24" type="number" value={adder} onChange={(e) => setAdder(e.target.value)} /></td>
      <td className="p-2"><Input className="w-24" type="number" value={sb} onChange={(e) => setSb(e.target.value)} /></td>
      <td className="p-2"><Input className="w-24" type="number" value={pb} onChange={(e) => setPb(e.target.value)} /></td>
      <td className="p-2"><Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button></td>
    </tr>
  );
}
