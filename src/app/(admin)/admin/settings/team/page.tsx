// Settings · Équipe — déplacée vers /admin/employes (module dédié).
// On garde une redirection permanente pour ne pas casser les anciens liens
// (notifications, raccourcis navigateur, liens dans la doc, etc.).
import { redirect } from "next/navigation";

export default function TeamPageRedirect() {
  redirect("/admin/employes");
}
