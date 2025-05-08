"use client";

import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider, useAuth } from "./auth/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function NavBar() {
  const { isAuthenticated, isAdmin, logout } = useAuth();

  return (
    <nav>
      <Link href="/">Home</Link>
      {isAuthenticated && isAdmin && (
        <Link href="/deployments">Deployments</Link>
      )}
      {isAuthenticated && (
        <button onClick={logout} style={{ marginLeft: 16 }}>
          Logout
        </button>
      )}
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <header>
            <div className="app-title">Infrastructure</div>
          </header>
          <NavBar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
