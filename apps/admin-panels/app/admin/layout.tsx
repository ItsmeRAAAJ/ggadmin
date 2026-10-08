import { AuthShell } from "@/components/layout/AuthShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthShell role="ADMIN">{children}</AuthShell>;
}
