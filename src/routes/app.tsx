import { createFileRoute, redirect } from "@tanstack/react-router";

// The console now lives at "/". Keep the old /app URL working.
export const Route = createFileRoute("/app")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
