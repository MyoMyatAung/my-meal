import Link from "next/link"
import { getCurrentShoppingList } from "@/app/actions/shopping-list"
import { ShoppingListView } from "@/components/shopping-list-view"

export default async function ShoppingListPage() {
  const plan = await getCurrentShoppingList()

  if (!plan) {
    return (
      <div>
        <h1 className="mb-2 text-lg font-semibold">Shopping list</h1>
        <p className="text-sm text-muted-foreground">
          No shopping list yet -{" "}
          <Link href="/plan" className="underline underline-offset-4">
            generate a plan
          </Link>{" "}
          to get one.
        </p>
      </div>
    )
  }

  return <ShoppingListView planId={plan.id} items={plan.shoppingItems} />
}
