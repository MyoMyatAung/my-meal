import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function Page() {
  return (
    <div className="flex min-h-svh p-6">
      <Card>
        <CardHeader>Project Ready!</CardHeader>
        <CardDescription>
          <p>You may now add components and start building.</p>
          <p>We&apos;ve already added the button component for you.</p>
        </CardDescription>
        <CardContent>
          <Input placeholder="Enter something" className="mt-2" />
        </CardContent>
        <CardAction>
          <Button className="mt-2">Button</Button>
        </CardAction>
      </Card>
    </div>
  )
}
