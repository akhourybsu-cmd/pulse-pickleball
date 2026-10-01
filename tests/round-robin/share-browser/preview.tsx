import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import RoundRobinEntry from "@/pages/RoundRobinEntry";
import { Button } from "@/components/ui/button";
import { signInPreview } from "./stub";
import "../../../src/index.css";
function SignInPreview() { const [params]=useSearchParams(); const navigate=useNavigate(); return <main className="mx-auto max-w-xl space-y-5 p-12"><h1 className="text-2xl font-bold">Local sign-in simulation</h1><p>Your invitation is preserved:</p><p className="break-all">{params.get("redirect")}</p><Button onClick={() => { signInPreview(); navigate(params.get("redirect")!); }}>Complete test sign-in</Button></main>; }
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><ThemeProvider attribute="class" defaultTheme="light"><MemoryRouter initialEntries={["/round-robin/10000000-0000-4000-8000-000000000001?invite=ABC-1234"]}><Routes><Route path="/round-robin/:id" element={<RoundRobinEntry />} /><Route path="/auth" element={<SignInPreview />} /></Routes></MemoryRouter><Toaster /></ThemeProvider></QueryClientProvider>);
