import { handlers } from "@/lib/auth/config";

// NextAuth v5 catch-all route — delegates GET and POST to the Auth.js handlers
export const { GET, POST } = handlers;
