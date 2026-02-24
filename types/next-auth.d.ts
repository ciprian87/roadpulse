// Augment NextAuth session and JWT types to include user id and role.
// These fields are set in the jwt + session callbacks in lib/auth/config.ts.
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      role: string;
    };
  }

  // User returned from the Credentials authorize() callback
  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
