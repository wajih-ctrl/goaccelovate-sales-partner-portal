import { Bold, Heading2, Italic, List, ListOrdered } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
};

type Format = "bold" | "italic" | "heading" | "bullets" | "numbered";

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter formatted agreement text...",
  minHeight = "14rem",
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (format: Format) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = value.slice(start, end);
    let replacement = selected;

    if (format === "bold") replacement = `**${selected || "bold text"}**`;
    if (format === "italic") replacement = `_${selected || "italic text"}_`;
    if (format === "heading") replacement = `## ${selected || "Section heading"}`;
    if (format === "bullets") {
      replacement = (selected || "List item")
        .split("\n")
        .map((line) => `- ${line.replace(/^[-*]\s*/, "")}`)
        .join("\n");
    }
    if (format === "numbered") {
      replacement = (selected || "List item")
        .split("\n")
        .map((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s*/, "")}`)
        .join("\n");
    }

    const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start, start + replacement.length);
    });
  };

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/50 p-1.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => applyFormat("bold")}
          title="Bold"
        >
          <Bold />
          <span className="sr-only">Bold</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => applyFormat("italic")}
          title="Italic"
        >
          <Italic />
          <span className="sr-only">Italic</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => applyFormat("heading")}
          title="Section heading"
        >
          <Heading2 />
          <span className="sr-only">Section heading</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => applyFormat("bullets")}
          title="Bulleted list"
        >
          <List />
          <span className="sr-only">Bulleted list</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => applyFormat("numbered")}
          title="Numbered list"
        >
          <ListOrdered />
          <span className="sr-only">Numbered list</span>
        </Button>
        <span className="ml-auto px-2 text-[11px] text-muted-foreground">
          Select text, then apply formatting
        </span>
      </div>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="scrollbar-hidden block w-full resize-y border-0 bg-transparent p-4 font-sans text-sm leading-6 outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}
