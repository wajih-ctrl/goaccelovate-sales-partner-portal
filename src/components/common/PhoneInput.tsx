import { useEffect, useMemo, useState } from "react";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";

type DialOption = { country: string; code: string };

const countryNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const DIAL_OPTIONS: DialOption[] = getCountries()
  .map((country: CountryCode) => ({
    country: countryNames?.of(country) || country,
    code: `+${getCountryCallingCode(country)}`,
  }))
  .sort((a, b) => a.country.localeCompare(b.country));

function parsePhone(value: string) {
  const match = value.trim().match(/^(\+\d{1,4})\s*(.*)$/);
  return match ? { code: match[1], number: match[2] } : { code: "", number: value };
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry,
  placeholder = "Phone number",
  required,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
}) {
  const parsed = parsePhone(value);
  const [dialCode, setDialCode] = useState(parsed.code || "+1");

  useEffect(() => {
    if (parsed.code && parsed.code !== dialCode) setDialCode(parsed.code);
  }, [dialCode, parsed.code]);

  useEffect(() => {
    if (parsed.code || !defaultCountry) return;
    const matching = DIAL_OPTIONS.find(
      (option) => option.country.toLowerCase() === defaultCountry.toLowerCase(),
    );
    if (matching) setDialCode(matching.code);
  }, [defaultCountry, parsed.code]);

  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    return DIAL_OPTIONS.filter((option) => {
      const key = `${option.country}-${option.code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const update = (code: string, number: string) => {
    const cleanNumber = number.replace(/[^\d\s()-]/g, "");
    onChange(cleanNumber.trim() ? `${code} ${cleanNumber}` : "");
  };

  return (
    <div className="phone-input-container mt-2">
      <div className="phone-input-grid grid gap-2">
        <select
          data-phone-country-code
          aria-label="Country calling code"
          className="h-10 w-full rounded-md border bg-background pl-3 text-sm"
          value={dialCode}
          onChange={(event) => {
            setDialCode(event.target.value);
            update(event.target.value, parsed.number);
          }}
        >
          {!uniqueOptions.some((option) => option.code === dialCode) && (
            <option value={dialCode}>{dialCode}</option>
          )}
          {uniqueOptions.map((option) => (
            <option key={`${option.country}-${option.code}`} value={option.code}>
              {option.code} {option.country}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={parsed.number}
          onChange={(event) => update(dialCode, event.target.value)}
          placeholder={placeholder}
          required={required}
        />
      </div>
    </div>
  );
}
