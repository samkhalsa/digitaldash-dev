import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentPropsWithoutRef } from "react";

function Anchor({ href = "", children, ...rest }: ComponentPropsWithoutRef<"a">) {
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      {...rest}
    >
      {children}
    </a>
  );
}

type Props = { children: string };

/** renders a markdown string with the site's typography. */
export function Markdown({ children }: Props) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: Anchor }}>
      {children}
    </ReactMarkdown>
  );
}
