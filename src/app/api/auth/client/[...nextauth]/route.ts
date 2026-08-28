// Handlers NextAuth du portail client : espace de session separe de l'admin,
// pour rester connecte aux deux dans le meme navigateur.
import { clientHandlers } from "@/lib/auth";

export const { GET, POST } = clientHandlers;
