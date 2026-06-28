export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh place-items-center p-6">
      {children}
    </div>
  )
}
