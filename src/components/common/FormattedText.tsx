import { Fragment, type ReactNode } from "react";

function inlineFormat(value: string): ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function FormattedText({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`list-${blocks.length}`}
        className={`${list.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-6`}
      >
        {list.items.map((item, index) => (
          <li key={`${item}-${index}`}>{inlineFormat(item)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((line, index) => {
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet || numbered)![1]);
      return;
    }

    flushList();
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={index} className="pt-2 text-base font-semibold text-slate-950 sm:text-lg">
          {inlineFormat(line.slice(3))}
        </h2>,
      );
    } else if (line.trim()) {
      blocks.push(<p key={index}>{inlineFormat(line)}</p>);
    } else {
      blocks.push(<div key={index} className="h-2" aria-hidden="true" />);
    }
  });
  flushList();

  return <div className="space-y-3 text-sm leading-7 text-slate-700 sm:text-base">{blocks}</div>;
}
