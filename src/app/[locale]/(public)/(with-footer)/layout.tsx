// Marketing pages layout — adds footer
import { PublicFooter } from "@/components/public/public-footer";

export default function WithFooterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <PublicFooter />
    </>
  );
}
