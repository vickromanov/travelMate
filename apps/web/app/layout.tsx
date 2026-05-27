/** Root layout. Skeleton placeholder. */
import type { ReactNode } from "react";

export const metadata = {
  title: "TravelMate",
  description: "The zero-thinking itinerary. See about_travelMate.md.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
