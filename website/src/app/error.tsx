"use client";
import { buttonClass } from "@/components/ui/Button";

// Shown instead of a stack trace when a page fails to render.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 max-w-md text-ink-mute">The page couldn&apos;t load right now. Please try again in a moment.</p>
      <button type="button" onClick={reset} className={buttonClass("secondary", "md", "mt-6")}>Try again</button>
    </main>
  );
}
