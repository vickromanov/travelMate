import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "TravelMate — Zero-thinking itineraries",
  description: "Describe any trip, get a complete itinerary.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
