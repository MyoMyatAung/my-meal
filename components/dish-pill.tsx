import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"

interface DishPillProps {
  name: string
  isSpecial?: boolean
}

export function DishPill({ name, isSpecial }: DishPillProps) {
  if (isSpecial) {
    return (
      <Badge className="bg-accent text-accent-foreground gap-1">
        <Star className="size-3 fill-current" />
        {name}
      </Badge>
    )
  }
  return <Badge variant="secondary">{name}</Badge>
}
