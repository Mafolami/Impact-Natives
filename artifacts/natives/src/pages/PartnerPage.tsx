import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function PartnerPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24">
      <div className="mb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Partner With Natives</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Join the network building the institutional-grade infrastructure for Africa's social impact economy.
        </p>
      </div>

      <div className="grid gap-12">
        {/* Role Selection CTAs */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Create your profile</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle>Join the Network</CardTitle>
                <CardDescription>Register as an NGO, Corporate, Funder, or Founder</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/signup/role">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white">Create Account</Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle>Book a Demo</CardTitle>
                <CardDescription>See how the platform works for your organisation</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full bg-background">Schedule Call</Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Commission a Lab */}
        <section className="bg-muted/30 border rounded-xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Commission an Innovation Lab</h2>
            <p className="text-muted-foreground">Sponsor a structured environment to solve systemic challenges in your sector.</p>
          </div>
          <Button variant="default" className="bg-foreground text-background hover:bg-foreground/90">
            Request Lab Proposal
          </Button>
        </section>

        {/* Contact Form */}
        <section className="p-8 border rounded-xl bg-card shadow-sm">
          <h2 className="text-2xl font-bold mb-6">Contact the Team</h2>
          <form className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Name</label>
                <Input placeholder="Jane Doe" className="bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Organization</label>
                <Input placeholder="Acme Foundation" className="bg-background" />
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Email</label>
                <Input type="email" placeholder="jane@example.com" className="bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Organization Type</label>
                <Select>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ngo">NGO / Non-profit</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="donor">Donor / DFI</SelectItem>
                    <SelectItem value="founder">Founder / Startup</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Message</label>
              <Textarea placeholder="How would you like to partner?" rows={6} className="bg-background resize-none" />
            </div>
            <Button size="lg" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white font-medium px-10">
              Submit Request
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
