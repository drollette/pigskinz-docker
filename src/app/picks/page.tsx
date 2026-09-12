import { redirect } from "next/navigation";
import { getCurrentWeekFromDb } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PicksPage() {
  const { week, seasonType } = await getCurrentWeekFromDb();
  redirect(`/picks/${seasonType}/${week}`);
}
