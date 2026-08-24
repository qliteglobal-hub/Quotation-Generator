"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { LogOut, User, ShieldCheck, KeyRound, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useEffect } from "react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const { cart } = useCart();

  useEffect(() => {
    if (session && (session as any).error) {
      signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <nav className="bg-black border-b border-white/10">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center">
              <Image 
                src="/logoqliteweb.png" 
                alt="Qlite Global Logo" 
                width={120} 
                height={40}
                className="h-18 w-auto mt-3"
                priority
              />
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/products"
              className="text-white hover:text-yellow-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Products
            </Link>

            <Link href="/cart" aria-label="View Cart">
              <div className="relative flex items-center justify-center text-white hover:text-yellow-400 px-2 py-2 rounded-md transition-colors">
                <ShoppingCart size={20} />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-2 bg-yellow-400 text-black text-[10px] font-bold rounded-full min-w-[18px] h-4 px-1 flex items-center justify-center leading-none">
                    {totalItems}
                  </span>
                )}
              </div>
            </Link>

            {status === "loading" ? (
              <div className="text-sm text-gray-400">Loading...</div>
            ) : session ? (
              <>
                {session.user.role === "admin" && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 text-white hover:text-yellow-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <ShieldCheck size={18} />
                    Admin
                  </Link>
                )}

                {/*<Link
                  href="/change-password"
                  className="flex items-center gap-2 text-white hover:text-yellow-400 px-1 py-1 rounded-sm text-xs font-small transition-colors"
                >
                  <KeyRound size={10} />
                  Change Password
                </Link>  */}

                <div className="flex items-center gap-3 border-l border-white/10 pl-4">
                  <div className="flex items-center gap-2 text-sm">
                    <User size={18} className="text-gray-400" />
                    <span className="text-white">{session.user.name}</span>
                    {session.user.role === "admin" && (
                      <span className="bg-yellow-400/10 text-yellow-400 text-xs px-2 py-1 rounded border border-yellow-400/20">
                        Admin
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <LogOut size={18} />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-white hover:text-yellow-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="bg-yellow-400 text-black hover:bg-yellow-500 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}