import { Category } from "@prisma/client"
import { Badge } from "@/components/ui/badge"

const categoryLabels: Record<Category, string> = {
  MAIN: "Main",
  SIDE: "Side",
  SOUP: "Soup",
  SNACK: "Snack",
  ACCOMPANIMENTS: "Accompaniments",
  OTHER: "Other",
}

interface CategoryBadgeProps {
  category: Category
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <Badge variant="outline">
      {categoryLabels[category]}
    </Badge>
  )
}
