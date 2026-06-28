export default function DishesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-5 w-[100px] animate-pulse bg-muted" />
        <div className="h-8 w-[100px] animate-pulse bg-muted" />
      </div>

      <div className="flex gap-2">
        <div className="h-8 w-[130px] animate-pulse bg-muted" />
        <div className="h-8 w-[130px] animate-pulse bg-muted" />
        <div className="h-8 w-[200px] animate-pulse bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[180px] animate-pulse rounded-none border border-border bg-muted/50"
          />
        ))}
      </div>
    </div>
  )
}
