import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Field } from "@/components/Fields";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY,
  digitsOnly,
  flagEmoji,
  getPhoneMaxLength,
} from "@/lib/phone";

export default function PhoneField({
  label = "Phone / contact",
  country,
  national,
  onCountryChange,
  onNationalChange,
  testid = "patient-phone",
  placeholder = "Phone number",
  hint,
}) {
  const [open, setOpen] = useState(false);
  const selected = country?.ISO ? country : DEFAULT_COUNTRY;
  const maxLen = getPhoneMaxLength(selected.Code);
  const countries = useMemo(() => COUNTRY_CODES, []);

  return (
    <Field label={label} hint={hint}>
      <div className="flex h-12 min-w-0 overflow-hidden rounded-md border border-input bg-white shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid={`${testid}-country`}
              className="flex h-12 shrink-0 items-center gap-1.5 border-r border-input bg-white px-2.5 text-sm font-semibold outline-none hover:bg-muted/50"
              aria-label="Country code"
            >
              <span className="text-base leading-none" aria-hidden="true">{flagEmoji(selected.ISO)}</span>
              <span data-testid={`${testid}-country-code`}>+{selected.Code}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="z-[80] w-80 bg-white p-0" data-testid={`${testid}-country-menu`}>
            <Command>
              <CommandInput placeholder="Search country" data-testid={`${testid}-country-search`} />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {countries.map((c) => (
                    <CommandItem
                      key={`${c.ISO}-${c.Code}`}
                      value={`${c.Country} ${c.Code} ${c.ISO}`}
                      data-testid={`${testid}-country-opt-${c.ISO}`}
                      onSelect={() => {
                        onCountryChange?.(c);
                        setOpen(false);
                      }}
                    >
                      <span className="mr-2 text-base leading-none" aria-hidden="true">{flagEmoji(c.ISO)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.Country}</span>
                      <span className="ml-2 shrink-0 text-muted-foreground">+{c.Code}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          data-testid={`${testid}-input`}
          className="h-12 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          placeholder={placeholder}
          maxLength={maxLen}
          value={national || ""}
          onChange={(e) => onNationalChange?.(digitsOnly(e.target.value, maxLen))}
        />
      </div>
    </Field>
  );
}
