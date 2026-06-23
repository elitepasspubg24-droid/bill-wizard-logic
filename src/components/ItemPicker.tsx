import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ItemLike = { id: string; name: string; section_id?: string | null };
type SectionLike = { id: string; name: string };

export function ItemPicker({
  items,
  sections,
  value,
  onChange,
  placeholder = "Unmatched",
  className,
  width = "w-64",
}: {
  items: ItemLike[];
  sections?: SectionLike[];
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  placeholder?: string;
  className?: string;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const sectionMap = useMemo(() => {
    const m = new Map<string, string>();
    (sections ?? []).forEach((s) => m.set(s.id, s.name));
    return m;
  }, [sections]);

  const labelFor = (it: ItemLike) => {
    const cat = it.section_id ? sectionMap.get(it.section_id) : null;
    return cat ? `${it.name} (${cat})` : it.name;
  };

  const selected = items.find((i) => i.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(width, "justify-between font-normal", className)}
        >
          <span className="truncate">{selected ? labelFor(selected) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput placeholder="Search item or category…" className="h-9 border-0" />
          </div>
          <CommandList>
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__skip__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                — skip —
              </CommandItem>
              {items.map((it) => {
                const label = labelFor(it);
                return (
                  <CommandItem
                    key={it.id}
                    value={label}
                    onSelect={() => {
                      onChange(it.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === it.id ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
