import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinguaFlash — Vocabulary Flashcards",
  description: "Upload vocabulary notes and practice with AI-generated flashcards",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}