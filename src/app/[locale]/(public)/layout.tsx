// Public layout — navbar only (footer added by sub-groups)
import { PublicNav } from "@/components/public/public-nav";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicNav />
      <main className="pt-[72px]">{children}</main>
    </>
  );
}
