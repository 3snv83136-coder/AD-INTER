import { ApportForm } from "@/components/apport/ApportForm"

export const dynamic = "force-dynamic"

type Params = { params: { token: string } }

export default function ApportPage({ params }: Params) {
  return <ApportForm token={params.token} />
}
