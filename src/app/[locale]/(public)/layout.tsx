// Public layout — navbar only (footer added by sub-groups)
import { Suspense } from "react";
import { PublicNav } from "@/components/public/public-nav";
import { NavigationFeedback } from "@/components/navigation-feedback";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Feedback navigation global VNK (cohérent avec admin + portail) */}
      <Suspense fallback={null}>
        <NavigationFeedback />
      </Suspense>

      <PublicNav />
      <main className="pt-[72px]">{children}</main>
    </>
  );
}
