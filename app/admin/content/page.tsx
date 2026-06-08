import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import ContentEngine from "./ContentEngine";

export const dynamic = "force-dynamic";
export const metadata = { title: "Content Engine · Spotlightly Admin" };

export default async function AdminContentPage() {
  if (!(await isAdmin())) notFound();
  return <ContentEngine />;
}
