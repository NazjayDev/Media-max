import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { isDemoEmail } from "@/lib/demoEmail";

declare module "next-auth" {
  interface Session {
    user: { id: string; demo?: boolean } & DefaultSession["user"];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.demo = isDemoEmail(token.email);
      return session;
    },
  },
});
