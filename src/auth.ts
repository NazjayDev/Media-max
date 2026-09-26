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
    jwt({ token, account }) {
      // Without a database adapter Auth.js mints a new random user id at every sign-in. Pin the
      // stable Google account id instead so a person's data follows them across sign-ins and devices.
      if (account?.providerAccountId) token.sub = account.providerAccountId;
      // Sessions issued before that fix carry a random UUID. Ending them forces one fresh sign-in
      // instead of silently saving data under an id the person will never get back.
      if (!/^\d+$/.test(token.sub ?? "")) return null;
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.demo = isDemoEmail(token.email);
      return session;
    },
  },
});
