import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginPage() {
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Enter your credentials to access your workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" placeholder="name@example.com" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Password</label>
              <Link href="/forgot" className="text-sm text-primary hover:underline">Forgot password?</Link>
            </div>
            <Input type="password" />
          </div>
          <Button className="w-full bg-primary hover:bg-primary/90">Sign In</Button>
          <div className="text-center text-sm text-muted-foreground mt-4">
            Don't have an account? <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SignupPage() {
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] ">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Join Natives</CardTitle>
          <CardDescription>Create an account to start collaborating</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" placeholder="name@example.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input type="password" />
          </div>
          <Link href="/signup/role">
            <Button className="w-full mt-4 bg-primary hover:bg-primary/90">Continue</Button>
          </Link>
          <div className="text-center text-sm text-muted-foreground mt-4">
            Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SignupRolePage() {
  const roles = [
    { title: "NGO", desc: "Access funding and report impact" },
    { title: "Corporate", desc: "Manage ESG and find partners" },
    { title: "Donor / DFI", desc: "Deploy capital and track outcomes" },
    { title: "Founder", desc: "Validate models and find investment" },
    { title: "Government", desc: "Coordinate regional initiatives" },
    { title: "Ecosystem Expert", desc: "Provide verification and consulting" }
  ];

  return (
    <div className="container max-w-4xl py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">How do you participate in the ecosystem?</h1>
        <p className="text-muted-foreground">Select your primary role to customize your experience.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {roles.map((role) => (
          <Card key={role.title} className="cursor-pointer hover:border-primary transition-colors">
            <CardHeader>
              <CardTitle className="text-lg">{role.title}</CardTitle>
              <CardDescription>{role.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button size="lg" className="px-12 bg-primary hover:bg-primary/90">Complete Setup</Button>
      </div>
    </div>
  );
}
