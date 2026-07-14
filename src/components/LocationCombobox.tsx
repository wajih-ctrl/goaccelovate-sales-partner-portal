import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

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
import { cn } from "@/lib/utils";

type LocationComboboxProps = {
  choices: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  ariaLabel: string;
  disabled?: boolean;
};

export function LocationCombobox({
  choices,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  ariaLabel,
  disabled,
}: LocationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleChoices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matches = normalized
      ? choices.filter((choice) => choice.toLocaleLowerCase().includes(normalized))
      : choices;
    return matches.slice(0, 100);
  }, [choices, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled}
          className="mt-1 h-10 w-full justify-between bg-background px-3 font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No matching location found.</CommandEmpty>
            <CommandGroup>
              {visibleChoices.map((choice) => (
                <CommandItem
                  key={choice}
                  value={choice}
                  onSelect={() => {
                    onChange(choice);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn("h-4 w-4", value === choice ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{choice}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
