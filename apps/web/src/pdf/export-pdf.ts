/**
 * Browser-side "Download PDF" entry point. Everything heavy — @react-pdf/renderer
 * (~400 KB) and the document component — is imported lazily HERE, so the main
 * bundle pays nothing until the traveler actually clicks the button.
 */
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { TripPlan } from "../lib/plan-types";

export async function downloadItineraryPdf(plan: TripPlan): Promise<void> {
  const [{ pdf }, { ItineraryPdfDocument }, { createElement }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./itinerary-pdf"),
    import("react"),
  ]);

  // pdf() insists on ReactElement<DocumentProps>; our component renders a
  // <Document> but carries its own props type — the cast is the standard bridge.
  const element = createElement(ItineraryPdfDocument, { plan }) as unknown as ReactElement<DocumentProps>;
  const blob = await pdf(element).toBlob();

  const slug = plan.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "itinerary";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `travelmate-${slug}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
