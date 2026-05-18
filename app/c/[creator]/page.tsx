import { redirect } from "next/navigation";

export default async function LegacyCreatorRoute({
  params,
}: {
  params: Promise<{ creator: string }>;
}) {
  const { creator } = await params;
  redirect(`/${creator}`);
}
