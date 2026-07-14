"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/src/components/Auth/AuthContext";
import TopBar from "@/app/src/components/TopBar/TopBar";
import Sidebar from "@/app/src/components/Nav/Sidebar";
import styles from "./AppShell.module.css";

// Only the welcome page ("/") is reachable while logged out. Everything else
// requires a session; unauthenticated visitors are bounced to the welcome
// page, which offers them a way to log in.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isWelcome = pathname === "/";
  const blocked = !loading && !user && !isWelcome;

  useEffect(() => {
    if (blocked) router.replace("/");
  }, [blocked, router]);

  return (
    <>
      <TopBar showNav={!!user} />
      {user && <Sidebar />}
      <div className={user ? styles.contentOffset : styles.content}>
        {blocked ? null : children}
      </div>
    </>
  );
}
