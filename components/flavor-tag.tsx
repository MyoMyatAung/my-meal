import { Badge } from "@/components/ui/badge"

interface FlavorTagProps {
  flavor: string
}

export function FlavorTag({ flavor }: FlavorTagProps) {
  return (
    <Badge variant="secondary">
      {flavor}
    </Badge>
  )
}
