// Portail client — login page
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PortalLoginForm } from "./login-form";

export default async function PortalLoginPage() {
  const session = await auth();
  if (session?.user?.role === "client") {
    redirect("/portail");
  }

  return (
    <div className="min-h-screen vnk-gradient-subtle flex items-center justify-center p-4">
      <PortalLoginForm />
    </div>
  );
}
