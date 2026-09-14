import { auth } from "@/lib/auth"
import { isFullAdmin } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { ConnexionsLive } from "@/components/ConnexionsLive"

export const dynamic = "force-dynamic"

export default async function ConnexionsPage() {
  if (process.env.AUTH_USER_1 || process.env.AUTH_TECH_1) {
    const session = await auth()
    if (!isFullAdmin(session?.user?.role)) {
      redirect("/")
    }
  }
  return <ConnexionsLive />
}
