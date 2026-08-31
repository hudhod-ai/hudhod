"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function RouteError({ error, reset }: RouteErrorProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
      <Alert variant="destructive">
        <AlertTitle>We could not load this page.</AlertTitle>
        <AlertDescription className="mt-2 flex flex-wrap items-center gap-3">
          <span>{error.message || "Please try again."}</span>
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  );
}
