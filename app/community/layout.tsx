import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Driver Reports",
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
