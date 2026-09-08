import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, ArrowRight } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { marketingLinks, SIGNUP_URL } from "./marketingContent";
import "./marketing.css";

interface HomepageNavProps {
  isLoggedIn: boolean;
  userMode?: "player" | "venue";
}

export const HomepageNav = ({ isLoggedIn }: HomepageNavProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const primaryHref = isLoggedIn ? "/player/dashboard" : SIGNUP_URL;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Join PULSE";

  return (
    <header className="mkt-nav">
      <div className="mkt-container mkt-nav-inner">
        <Link to="/" className="mkt-logo-link" aria-label="PULSE home"><Logo className="mkt-logo" /></Link>
        <nav className="mkt-desktop-nav" aria-label="Main navigation">{marketingLinks.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
        <div className="mkt-nav-actions">
          <div className="mkt-theme-toggle"><ThemeToggle /></div>
          {!isLoggedIn && <Link to="/auth" className="mkt-sign-in">Sign in</Link>}
          <Link className="mkt-button mkt-button-ink mkt-nav-join" to={primaryHref}>{primaryLabel}<ArrowRight aria-hidden="true" /></Link>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild><button type="button" className="mkt-menu-trigger" aria-label="Open navigation menu"><Menu aria-hidden="true" /></button></SheetTrigger>
            <SheetContent className="mkt-mobile-menu">
              <SheetTitle>Explore PULSE</SheetTitle><SheetDescription>Your game. Your people. In one place.</SheetDescription>
              <nav aria-label="Mobile navigation">{marketingLinks.map(link => <SheetClose asChild key={link.href}><a href={link.href}>{link.label}<ArrowRight aria-hidden="true" /></a></SheetClose>)}</nav>
              <SheetClose asChild><Link className="mkt-button mkt-button-gold" to={primaryHref}>{isLoggedIn ? "Open your dashboard" : "Create your free account"}<ArrowRight aria-hidden="true" /></Link></SheetClose>
              {isLoggedIn ? <SheetClose asChild><Link className="mkt-mobile-account" to="/settings/notifications">Account settings</Link></SheetClose> : <SheetClose asChild><Link className="mkt-mobile-account" to="/auth">Already a member? Sign in</Link></SheetClose>}
              <div className="mkt-mobile-theme"><span>Make yourself at home</span><ThemeToggle /></div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
