import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check Route",
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
