"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Share2 } from "lucide-react";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/button";
import { logoutAction } from "@/app/actions";
import { shareApp } from "@/lib/share";
import { blackOpsOne } from "@/lib/fonts";
import { POOL_NAME } from "@/lib/site-config";
import type { User } from "@/db/schema";

interface NavbarProps {
  user: User | null;
  currentWeek: number;
  currentSeasonType: number;
}

export function Navbar({ user, currentWeek, currentSeasonType }: NavbarProps) {
  const router = useRouter();

  const closeDropdown = () => {
    // Close dropdown by removing focus from the active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleLogout = async () => {
    closeDropdown();
    await logoutAction();
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="bg-base-100 border-b border-base-300 sticky top-0 z-50">
      <div className="navbar max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex-1">
          <Link href="/" className="inline-flex items-center">
            <span className={`${blackOpsOne.className} text-lg text-base-content tracking-wide`}>
              PIGSKINZ
            </span>
          </Link>
        </div>

        <div className="flex-none gap-2">
          {!user ? (
            // size="sm" + a shorter "Rules" label below sm: keep all three
            // buttons plus the wordmark from overflowing a 375px viewport --
            // at btn-md with the full "How to Play" label they didn't fit.
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link href="/rules">
                <Button variant="ghost" size="sm">
                  <span className="hidden sm:inline">How to Play</span>
                  <span className="sm:hidden">Rules</span>
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">Sign up</Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Avatar — just an indicator that the user is logged in */}
              <Avatar name={user.name} avatar={user.avatar} seed={user.username ?? user.id} />

              {/* Hamburger menu */}
              <div className="dropdown dropdown-end">
                <label tabIndex={0} className="btn btn-ghost btn-circle" aria-label="Menu">
                  <Menu className="w-5 h-5" />
                </label>
                <ul
                  tabIndex={0}
                  className="menu dropdown-content mt-3 z-[1] p-2 gap-1 shadow bg-base-100 rounded-box w-56 text-base"
                >
                  <li className="menu-title">
                    <span>{user.name}</span>
                  </li>
                  <li className="lg:hidden">
                    <Link href="/" onClick={closeDropdown}>Pool Standings</Link>
                  </li>
                  <li className="lg:hidden">
                    <Link
                      href={`/picks/${currentSeasonType}/${currentWeek}`}
                      onClick={closeDropdown}
                    >
                      Picks
                    </Link>
                  </li>
                  <li className="lg:hidden">
                    <Link href="/schedule" onClick={closeDropdown}>Schedule</Link>
                  </li>
                  <li className="lg:hidden">
                    <Link href="/nfl-standings" onClick={closeDropdown}>NFL Standings</Link>
                  </li>
                  <li className="lg:hidden">
                    <Link href="/locker-room" onClick={closeDropdown}>Locker Room</Link>
                  </li>
                  <li>
                    <Link href="/rules" onClick={closeDropdown}>How to Play</Link>
                  </li>
                  <li>
                    <Link href="/my/settings" onClick={closeDropdown}>Settings</Link>
                  </li>
                  {user.isAdmin && (
                    <li>
                      <Link href="/admin" onClick={closeDropdown} className="text-warning">
                        Admin
                      </Link>
                    </li>
                  )}
                  <li>
                    <button
                      onClick={() => {
                        closeDropdown();
                        shareApp();
                      }}
                      className="flex items-center gap-2 text-base-content/60"
                    >
                      <Share2 className="w-4 h-4" />
                      Share {POOL_NAME}
                    </button>
                  </li>
                  <li>
                    <button onClick={handleLogout} className="text-error">
                      Logout
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
