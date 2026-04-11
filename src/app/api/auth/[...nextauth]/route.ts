// NextAuth v5 catch-all handler — délègue à lib/auth
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
