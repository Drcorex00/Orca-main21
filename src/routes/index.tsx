import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// The app shell renders a MapLibre map and reads window/layout sizes on mount,
// so it must only ever run in the browser.
const AppLayout = lazy(() => import("../components/Layout/AppLayout"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ORCA Console — Live Marine Conditions & Fishing Zones" },
      {
        name: "description",
        content:
          "Ask ORCA about any coastal location and get live wave, wind, tide, sea-surface temperature and potential fishing zone guidance on an interactive map.",
      },
      { property: "og:title", content: "ORCA Console — Live Marine Conditions & Fishing Zones" },
      {
        property: "og:description",
        content:
          "Live marine forecasts, sea-state safety advisories and fishing zone insight, mapped and explained in chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConsoleRoute,
});

function Shell() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--orca-bg-primary, #000000)",
        color: "var(--orca-text-muted, #767676)",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        letterSpacing: "0.08em",
      }}
    >
      LOADING ORCA…
    </div>
  );
}

function ConsoleRoute() {
  return (
    <ClientOnly fallback={<Shell />}>
      <Suspense fallback={<Shell />}>
        <AppLayout />
      </Suspense>
    </ClientOnly>
  );
}
