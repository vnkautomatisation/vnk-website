// Settings · Diagnostics — page client qui appelle /api/admin/diagnostics.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DiagnosticsView } from "./diagnostics-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Diagnostics — VNK" };

export default async function DiagnosticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  return <DiagnosticsView />;
}
