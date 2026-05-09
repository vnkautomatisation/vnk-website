// Helper centralise pour invalider le cache Next apres une mutation
import { revalidatePath } from "next/cache";

// Invalide les sections admin et portail client (toutes les pages qui consomment les memes donnees)
export function revalidateAdminViews() {
  revalidatePath("/admin", "layout");
  revalidatePath("/portail", "layout");
}
