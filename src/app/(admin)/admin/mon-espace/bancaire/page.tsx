import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BankInfoView } from "./bank-view";
import { getBankInfoMaskedAction } from "@/app/actions/hr-employee-file";

export default async function BankPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const r = await getBankInfoMaskedAction({ adminId });
  const current = r.success ? r.data : null;
  return <BankInfoView adminId={adminId} current={current} />;
}
