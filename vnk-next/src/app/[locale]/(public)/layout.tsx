// Public site layout — navbar + footer
import { PublicNav } from "@/components/public/public-nav";
import { PublicFooter } from "@/components/public/public-footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicNav />
      <main className="pt-[70px]">{children}</main>
      <PublicFooter />
    </>
  );
}
