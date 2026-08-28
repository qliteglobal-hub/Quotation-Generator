'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Zap,
  FileText,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Download,
  Sparkles,
  Clock,
  Globe,
  Shield
} from 'lucide-react';

export default function HomePage() {
  const [lightCategories, setLightCategories] = useState<string[]>([]);
  const [displayCategories, setDisplayCategories] = useState<string[]>([]);

  useEffect(() => {
    // Fetch LED Lights categories
    const fetchLightCategories = async () => {
      try {
        const res = await fetch('/api/products');
        if (!res.ok) return;
        const data = await res.json();
        const products = Array.isArray(data) ? data : [];

        const categoryFilters = products
          .map((p: any) => {
            if (p.categoryFilter) return p.categoryFilter as string;
            if (!p.category) return null;
            const words = String(p.category).trim().split(/\s+/);
            return words.length === 1 ? words[0] : words.slice(-2).join(' ');
          })
          .filter((v): v is string => Boolean(v));

        setLightCategories(Array.from(new Set(categoryFilters)).sort());
      } catch {
        // Silent fail on homepage
      }
    };

    // Fetch LED Display categories
    const fetchDisplayCategories = async () => {
      try {
        const res = await fetch('/api/led-displays');
        if (!res.ok) return;
        const data = await res.json();
        const displays = Array.isArray(data) ? data : [];

        const categories = displays
          .map((p: any) => (p.category ? String(p.category) : ''))
          .filter((v: string) => v.trim().length > 0);

        setDisplayCategories(Array.from(new Set(categories)).sort());
      } catch {
        // Silent fail on homepage
      }
    };

    fetchLightCategories();
    fetchDisplayCategories();
  }, []);

  return (
    <div className="min-h-screen bg-black overflow-hidden">

      {/* Hero Section with Animated Background */}
      <section className="relative min-h-[90vh] flex items-center px-6 py-20">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          {/*  <div className="absolute top-1/4 -left-48 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl animate-pulse"></div>
         <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>*/}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-400/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 xl:gap-14 items-center">
            {/* Left: Text & CTAs */}
            <div className="text-center lg:text-left space-y-7">
              {/* Main Heading */}
              <div className="inline-block transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02]">
                <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-3 leading-tight tracking-tight">
                  <span className="text-white block">Create quotation</span>
                  <span className="bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                    In Minutes, Not Hours
                  </span>
                </h1>
                <p className="text-base md:text-sm lg:text-sm text-gray-300/90 max-w-xl lg:max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Move from messy spreadsheets to one focused workspace. Search products, add to cart, and export a client-ready quotation in just a few clicks.
                </p>
              </div>

              {/* CTA Button */}
              <div className="flex justify-center lg:justify-start">
                <Link
                  href="/products"
                  className="group relative inline-flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-8 md:px-10 py-4 md:py-5 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-400/60"
                >
                  <span className="text-base md:text-sm">Start Creating</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Social proof / helpers */}
              <div className="max-w-xl lg:max-w-2xl mx-auto lg:mx-0 mt-2">
                <div className="flex flex-col md:flex-row md:items-center gap-2 text-[11px] sm:text-xs text-gray-500/90">
                  <p className="leading-relaxed">
                    To learn more about our products or company, visit{' '}
                    <Link
                      href="https://www.qliteglobal.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-400 hover:text-yellow-300 underline underline-offset-4"
                    >
                      Qlite Global
                    </Link>
                    .
                  </p>

                </div>
              </div>
            </div>

            {/* Right: Quotation Preview Card */}
            <div className="relative md:-translate-y-8 lg:-translate-y-10 xl:-translate-y-12 transition-transform duration-300 hover:-translate-y-10 hover:scale-[1.05] hover:shadow-2xl">
              <div className="absolute -inset-1 bg-gradient-to-tr from-yellow-400/40 via-yellow-500/10 to-transparent rounded-3xl blur-2xl opacity-70" />
              <div className="relative bg-gradient-to-b from-gray-950 to-black/90 border border-yellow-400/30/10 rounded-3xl p-6 md:p-7 shadow-2xl shadow-yellow-400/30 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">Live Preview</p>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-yellow-400" />
                      Sample Quotation
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] px-3 py-1 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/40">
                    <TrendingUp className="w-3 h-3" />
                    Ready in 2 min
                  </span>
                </div>

                <div className="space-y-2.5 mb-5">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Client</span>
                    <span className="text-white/80">Qlite Demo Project</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Items</span>
                    <span className="text-white/80">12 Selected Products</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Currency</span>
                    <span className="text-white/80">USD / INR Export</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40/90 overflow-hidden mb-5">
                  <div className="grid grid-cols-[2fr_1fr] text-[11px] text-gray-400 px-3 py-2 bg-white/5">
                    <span>Product</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="divide-y divide-white/5 text-[11px]">
                    <div className="flex items-center justify-between px-3 py-2 bg-white/0">
                      <span className="text-gray-300 truncate">LED Flood Light 100W</span>
                      <span className="text-yellow-300 font-semibold">$120.00</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-gray-300 truncate">Street Light 60W</span>
                      <span className="text-yellow-300 font-semibold">$85.00</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-gray-300 truncate">Panel Light 36W</span>
                      <span className="text-yellow-300 font-semibold">$45.00</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-3 bg-white/5 border-t border-white/10">
                    <span className="text-xs text-gray-400">Estimated Total</span>
                    <span className="text-base font-semibold text-yellow-300">$1,245.00</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] text-gray-300">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <CheckCircle className="w-3 h-3 text-emerald-300" />
                    Export to PDF & Excel
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <Globe className="w-3 h-3 text-yellow-300" />
                    Multi-currency view
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <Shield className="w-3 h-3 text-sky-300" />
                    Client-ready formatting
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-6 pb-10 px-6 bg-gradient-to-b from-black via-gray-900/50 to-black">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="group relative bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 hover:border-yellow-400/60 transition-all duration-300 hover:-translate-y-3 hover:scale-[1.06] hover:shadow-2xl hover:shadow-yellow-400/40">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="relative">
                <div className="w-12 h-12 bg-yellow-400/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Clock className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Lightning Fast</h3>
                <p className="text-sm text-gray-400">Generate quotations in under 2 minutes</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 hover:border-yellow-400/60 transition-all duration-300 hover:-translate-y-3 hover:scale-[1.06] hover:shadow-2xl hover:shadow-yellow-400/40">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="relative">
                <div className="w-12 h-12 bg-yellow-400/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Globe className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Multi-Currency</h3>
                <p className="text-sm text-gray-400">Support for USD, INR, and more</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 hover:border-yellow-400/50 transition-all duration-300 hover:-translate-y-2 hover:scale-[1.03] hover:shadow-2xl hover:shadow-yellow-400/30">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="relative">
                <div className="w-12 h-12 bg-yellow-400/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Download className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Export Ready</h3>
                <p className="text-sm text-gray-400">PDF & Excel formats available</p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group relative bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 hover:border-yellow-400/50 transition-all duration-300 hover:-translate-y-2 hover:scale-[1.03] hover:shadow-2xl hover:shadow-yellow-400/30">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="relative">
                <div className="w-12 h-12 bg-yellow-400/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Secure & Safe</h3>
                <p className="text-sm text-gray-400">Your data is protected always</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Overview Section (removed for minimal layout) */}


      {/* CTA Section 
      <section className="py-20 px-6 bg-gradient-to-b from-black via-gray-900/50 to-black">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-3xl p-1 shadow-2xl shadow-yellow-400/30">
            <div className="bg-black rounded-3xl p-12 text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to Transform Your Workflow?
              </h2>
              <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                Join businesses worldwide using Qlite Global for faster, smarter quotations
              </p>
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-10 py-5 rounded-xl text-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-400/50"
              >
                <span>Get Started Now</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
*/}
    </div>
  );
}