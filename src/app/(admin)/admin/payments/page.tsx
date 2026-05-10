// Alias historique — la page principale est sous /admin/transactions
import { redirect } from "next/navigation";

export default function PaymentsRedirect() {
  redirect("/admin/transactions");
}
