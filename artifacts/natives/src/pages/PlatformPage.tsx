import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Network, Database, Zap, LayoutDashboard, FileText, Search, AlignJustify, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PlatformPage() {
  const params = useParams();
  const tab = params.tab || "overview";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Platform Infrastructure</h1>
        <p className="text-xl text-muted-foreground">The digital foundation for coordinated impact.</p>
      </div>

      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <Network className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Partnership OS</CardTitle>
              <CardDescription>Organisation discovery and collaboration workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Match with verified partners and manage joint initiatives in a structured environment.</p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <Database className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Impact Verification</CardTitle>
              <CardDescription>SDG mapping and metrics dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Standardized reporting templates and verifiable outcome tracking.</p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <Zap className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Funding Infrastructure</CardTitle>
              <CardDescription>Grant alignment and co-funding tools.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coordinate capital deployment across multiple stakeholders efficiently.</p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <ShieldCheck className="w-8 h-8 text-[#2D6A4F] mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Trust & Verification</CardTitle>
              <CardDescription>Institutional-grade transparency signals.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Verification badges and compliance indicators for confident partnership.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "partnership-os" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h2 className="text-3xl font-bold mb-2">Partnership OS</h2>
            <p className="text-muted-foreground">Discover verified organisations and coordinate shared initiatives.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center"><Search className="w-4 h-4 mr-2"/> Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">SDG Focus</label>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="cursor-pointer">Zero Hunger</Badge>
                      <Badge variant="outline" className="cursor-pointer">Good Health</Badge>
                      <Badge variant="outline" className="cursor-pointer">Climate Action</Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Verification Level</label>
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-[#2D6A4F]" />
                      <span className="text-sm">Institutional Grade</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="md:col-span-2 space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-6 flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-bold text-lg">Organisation {i} Placeholder</h3>
                        <ShieldCheck className="w-4 h-4 text-[#2D6A4F]" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">Implementing scalable agricultural solutions in East Africa. Focus on smallholder farmer yield improvement.</p>
                      <div className="flex space-x-2">
                        <Badge variant="secondary">SDG 2</Badge>
                        <Badge variant="secondary">SDG 13</Badge>
                      </div>
                    </div>
                    <Button variant="outline" className="shrink-0 text-primary border-primary hover:bg-primary hover:text-white">View Profile</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "impact-verification" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h2 className="text-3xl font-bold mb-2">Impact Verification</h2>
            <p className="text-muted-foreground">Standardized SDG mapping and donor-ready reporting.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><LayoutDashboard className="w-5 h-5 mr-2" /> Metrics Dashboard</CardTitle>
                <CardDescription>Real-time outcome tracking against standardized indicators.</CardDescription>
              </CardHeader>
              <CardContent className="h-[200px] flex items-center justify-center border-t bg-muted/20">
                <span className="text-sm text-muted-foreground font-mono">[Metrics Visualization Placeholder]</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><FileText className="w-5 h-5 mr-2" /> Reporting Templates</CardTitle>
                <CardDescription>Generate compliance-ready impact reports instantly.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <span className="text-sm font-medium">Q3 Impact Summary</span>
                  <Button size="sm" variant="secondary">Export PDF</Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <span className="text-sm font-medium">Annual ESG Alignment</span>
                  <Button size="sm" variant="secondary">Export PDF</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "funding-infrastructure" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h2 className="text-3xl font-bold mb-2">Funding Infrastructure</h2>
            <p className="text-muted-foreground">Coordinate capital deployment and access blended finance pathways.</p>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Active Funding Opportunities</h3>
              <Button size="sm" className="bg-primary text-white">Create Opportunity</Button>
            </div>
            <div className="divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-6 hover:bg-muted/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-[#2D6A4F]">Active</Badge>
                      <h4 className="font-bold">Climate Innovation Grant {i}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">Co-funding opportunity for early-stage climate tech models.</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-mono shrink-0">
                    <div className="text-right">
                      <div className="text-muted-foreground">Pool Size</div>
                      <div className="font-bold">$2.5M</div>
                    </div>
                    <Button variant="outline">View Details</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "trust-verification" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h2 className="text-3xl font-bold mb-2">Trust & Verification</h2>
            <p className="text-muted-foreground">Institutional-grade transparency signals for confident partnerships.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-[#2D6A4F]/20 shadow-sm">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-[#2D6A4F]" />
                </div>
                <CardTitle>Verified Entity</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-sm text-muted-foreground">
                <p>Legal registration, beneficial ownership, and compliance checks completed.</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <AlignJustify className="w-8 h-8 text-primary" />
                </div>
                <CardTitle>Track Record</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-sm text-muted-foreground">
                <p>Demonstrated history of successful project execution and fund management.</p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/20 shadow-sm">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle>Data Integrity</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-sm text-muted-foreground">
                <p>Impact claims backed by immutable data sources and third-party audits.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "api-integrations" && (
        <div className="min-h-[400px] border rounded-xl bg-card flex flex-col items-center justify-center text-center p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Database className="w-16 h-16 text-muted-foreground mb-6" />
          <h2 className="text-3xl font-bold mb-4">API & Integrations</h2>
          <p className="text-xl text-muted-foreground max-w-lg mb-8">
            Connect Natives infrastructure directly to your internal systems. Programmatic access to the ecosystem's verification and discovery layers.
          </p>
          <Badge variant="outline" className="text-lg px-4 py-2 border-primary text-primary">Coming Soon</Badge>
        </div>
      )}

    </div>
  );
}
