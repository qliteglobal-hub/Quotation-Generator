'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, Database, Users, FileText } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const [isDarkMode] = useState(true);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all mb-6 ${
              isDarkMode 
                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' 
                : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 shadow-sm'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-10 h-10 text-yellow-400" />
            <h1 className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Privacy Policy
            </h1>
          </div>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Last Updated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div className={`rounded-xl p-8 ${
          isDarkMode ? 'bg-gray-900/50 border border-white/10' : 'bg-white border border-gray-200 shadow-sm'
        }`}>
          <div className="space-y-8">
            {/* Introduction */}
            <section>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                At Qlite Global, we are committed to protecting your privacy and ensuring the security of your business information. 
                This Privacy Policy explains how we collect, use, and safeguard your data when you use our quotation platform.
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-yellow-400" />
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  1. Information We Collect
                </h2>
              </div>
              <div className={`space-y-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div>
                  <h3 className="font-semibold mb-2">Business Contact Information:</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Email address</li>
                    <li>Phone number</li>
                    <li>Company name and project details</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Account Information:</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Login credentials (encrypted)</li>
                    <li>User preferences and settings</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Usage Data:</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Product selections and quotation history</li>
                    <li>Platform usage analytics</li>
                    <li>Browser type and IP address</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* How We Use Information */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-yellow-400" />
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  2. How We Use Your Information
                </h2>
              </div>
              <ul className={`list-disc list-inside space-y-2 text-sm ml-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Generate and deliver quotations</li>
                <li>Process orders and communicate about products</li>
                <li>Improve our platform and services</li>
                <li>Send order confirmations and updates</li>
                <li>Provide customer support</li>
                <li>Analyze usage patterns to enhance user experience</li>
              </ul>
            </section>

            {/* Data Security */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-yellow-400" />
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  3. Data Security
                </h2>
              </div>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                We implement industry-standard security measures to protect your business information, including:
              </p>
              <ul className={`list-disc list-inside space-y-2 text-sm ml-4 mt-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Encrypted data transmission (SSL/TLS)</li>
                <li>Secure password storage with encryption</li>
                <li>Regular security audits and updates</li>
                <li>Restricted access to personal data</li>
                <li>Secure cloud storage infrastructure</li>
              </ul>
            </section>

            {/* Information Sharing */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-yellow-400" />
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  4. Information Sharing
                </h2>
              </div>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                We do not sell, trade, or rent your business information to third parties. We may share data only with:
              </p>
              <ul className={`list-disc list-inside space-y-2 text-sm ml-4 mt-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Service providers who assist in platform operations (hosting, analytics)</li>
                <li>Legal authorities when required by law</li>
                <li>Business partners with your explicit consent</li>
              </ul>
            </section>

            {/* Your Rights */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-yellow-400" />
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  5. Your Rights
                </h2>
              </div>
              <p className={`text-sm leading-relaxed mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                You have the right to:
              </p>
              <ul className={`list-disc list-inside space-y-2 text-sm ml-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Access your personal and business data</li>
                <li>Update or correct your information</li>
                <li>Request deletion of your account and data</li>
                <li>Export your quotation history</li>
                <li>Opt-out of marketing communications</li>
                <li>Withdraw consent for data processing</li>
              </ul>
            </section>

            {/* Cookies */}
            <section>
              <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                6. Cookies & Tracking
              </h2>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                We use cookies and similar technologies to enhance your experience, including session cookies for 
                functionality and analytics cookies to improve our services. We do not use third-party advertising cookies.
              </p>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                7. Data Retention
              </h2>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                We retain your information for as long as your account is active or as needed to provide services. 
                You may request deletion of your data at any time, subject to legal retention requirements.
              </p>
            </section>

            {/* Changes to Policy */}
            <section>
              <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                8. Changes to This Policy
              </h2>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
                the new policy on this page and updating the "Last Updated" date.
              </p>
            </section>

            {/* Contact */}
            <section className={`p-6 rounded-lg ${
              isDarkMode ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <h2 className={`text-xl font-bold mb-3 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                Contact Us
              </h2>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us:
              </p>
              <div className={`mt-4 space-y-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <p><span className="font-semibold">Email:</span> sales@qliteglobal.com</p>
                <p><span className="font-semibold">Phone:</span> +973 3330 8969</p>
                <p><span className="font-semibold">Address:</span> QLITE CO. WLL, P.O. Box: 1858, Manama, Kingdom of Bahrain</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
