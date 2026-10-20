import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "./cn";

// Owner-written Markdown, rendered safely: raw HTML is dropped (skipHtml), react-markdown's URL filter removes
// javascript:/data: links, images are not rendered (they'd load arbitrary hosts), and external links open with noopener.
export function Markdown({ children, className }: { children: string; className?: string }) {
  if (!children.trim()) return null;
  return (
    <div className={cn("prose-aur", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={["img", "iframe", "script", "style"]}
        components={{
          a: ({ href, children }) => {
            const ext = !!href && /^https?:\/\//.test(href);
            return <a href={href} {...(ext ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>{children}</a>;
          },
          h1: ({ children }) => <h2>{children}</h2>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
