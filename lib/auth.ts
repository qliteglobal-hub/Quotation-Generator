// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        await dbConnect();

        const user = await User.findOne({ email: credentials.email });
        if (!user) throw new Error("Invalid email or password");

        if (!user.emailVerified) {
          throw new Error('Please verify your email before logging in.');
        }

        if (user.status === 'pending' || user.status === 'rejected') {
          throw new Error('Your account is pending admin approval.');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) throw new Error("Invalid email or password");

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      
      if (token.id) {
        try {
          await dbConnect();
          const dbUser = await User.findById(token.id).select('role status');
          
          if (!dbUser || dbUser.status !== 'approved') {
            token.error = "AccessRevoked";
          } else if (token.role === 'admin' && dbUser.role !== 'admin') {
            token.error = "AdminRevoked";
            token.role = dbUser.role;
          } else {
            token.role = dbUser.role;
            delete token.error;
          }
        } catch (error) {
          console.error("Error verifying user in jwt callback", error);
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      if (token.error) {
        (session as any).error = token.error;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
