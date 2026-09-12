import { redirect } from "next/navigation";
import { getCurrentWeekFromDb } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { week, seasonType } = await getCurrentWeekFromDb();
  redirect(`/schedule/${seasonType}/${week}`);
}
