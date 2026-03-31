// lib/auth.ts
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions = {
  // ✅ Use JWT sessions (no DB session tables required)
  session: { strategy: "jwt" },

  // ✅ Make sure you have NEXTAUTH_SECRET in .env
  secret: process.env.NEXTAUTH_SECRET,

  pages: { signIn: "/auth/signin" },

  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // ✅ NextAuth expects id as a string in the session token
        return { id: String(user.id), name: user.name, email: user.email };
      },
    }),
  ],

 callbacks: {
  async jwt({ token, user }: any) {
    // When the user signs in, attach their id onto the token
    if (user) token.id = user.id;

    // Always ensure token.role exists by loading from DB
    if (token?.id && !token.role) {
      const dbUser = await prisma.user.findUnique({
        where: { id: Number(token.id) },
        select: { role: true },
      });
      token.role = dbUser?.role ?? "USER";
    }

    return token;
  },

  async session({ session, token }: any) {
    if (session.user) {
      session.user.id = token.id;
      session.user.role = token.role;
    }
    return session;
  },
},

};
