import { useParams } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Calendar, Search, MapPin, Globe, ShieldCheck } from "lucide-react";

export default function LabsPage() {
  const params = useParams();
  const tab = params.tab || "active";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Labs & Network</h1>
        <p className="text-xl text-muted-foreground">Collaborative environments and ecosystem intelligence.</p>
      </div>

      {tab === "active" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-end">
            <h2 className="text-2xl font-bold">Active Innovation Labs</h2>
            <Button variant="outline">Propose a Lab</Button>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="flex flex-col border border-border hover:border-primary/50 transition-all">
              <CardHeader>
                <div className="flex justify-between items-start mb-4">
                  <Badge className="bg-[#2D6A4F] text-white uppercase tracking-wider text-[10px] font-bold px-2 py-1">Open</Badge>
                </div>
                <CardTitle className="text-xl font-bold leading-tight">Agritech Innovation Lab</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">Accelerating last-mile distribution models for smallholder farmers across East Africa. Seeking founders and implementation partners.</p>
                <div className="flex items-center text-sm font-medium text-foreground mb-3">
                  <Users className="w-4 h-4 mr-3 text-muted-foreground" /> 0 Participants
                </div>
                <div className="flex items-center text-sm font-medium text-foreground">
                  <Calendar className="w-4 h-4 mr-3 text-muted-foreground" /> Q3 2024 - Q1 2025
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full bg-primary hover:bg-primary/90 text-white font-medium">Join Lab</Button>
              </CardFooter>
            </Card>

            <Card className="flex flex-col border border-border hover:border-primary/50 transition-all">
              <CardHeader>
                <div className="flex justify-between items-start mb-4">
                  <Badge className="bg-[#2D6A4F] text-white uppercase tracking-wider text-[10px] font-bold px-2 py-1">Open</Badge>
                </div>
                <CardTitle className="text-xl font-bold leading-tight">Climate Resilience Lab</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">Developing scalable financing mechanisms for community-led adaptation projects. Seeking structured finance expertise.</p>
                <div className="flex items-center text-sm font-medium text-foreground mb-3">
                  <Users className="w-4 h-4 mr-3 text-muted-foreground" /> 0 Participants
                </div>
                <div className="flex items-center text-sm font-medium text-foreground">
                  <Calendar className="w-4 h-4 mr-3 text-muted-foreground" /> Q4 2024 - Q2 2025
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full bg-primary hover:bg-primary/90 text-white font-medium">Join Lab</Button>
              </CardFooter>
            </Card>

            <Card className="flex flex-col bg-muted/30 border-dashed">
              <CardHeader>
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="outline" className="uppercase tracking-wider text-[10px] font-bold px-2 py-1 text-muted-foreground border-muted-foreground">Coming Soon</Badge>
                </div>
                <CardTitle className="text-xl font-bold leading-tight text-muted-foreground">Health Systems Lab</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground/70 mb-6 leading-relaxed">Digital health data interoperability standards for regional health networks. Foundational partners needed.</p>
                <div className="flex items-center text-sm font-medium text-muted-foreground/70 mb-3">
                  <Users className="w-4 h-4 mr-3" /> -- Participants
                </div>
                <div className="flex items-center text-sm font-medium text-muted-foreground/70">
                  <Calendar className="w-4 h-4 mr-3" /> 2025
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full border-muted-foreground/30 text-muted-foreground" disabled>Notify Me</Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {tab === "marketplace" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <h2 className="text-2xl font-bold">Network Directory</h2>
          
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search organizations..." className="pl-10 h-12" />
            </div>
            <Button variant="outline" className="h-12 border-dashed">
              + Filter by SDG
            </Button>
            <Button variant="outline" className="h-12 border-dashed">
              <MapPin className="w-4 h-4 mr-2" /> Geography
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="hover:border-primary/30 transition-all cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center font-bold text-lg text-muted-foreground">
                      O{i}
                    </div>
                    {i % 2 !== 0 && (
                      <Badge className="bg-[#2D6A4F]/10 text-[#2D6A4F] border-none flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">Organization Name {i}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">Providing essential infrastructure services and capacity building for local communities.</p>
                  
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <Badge variant="secondary" className="text-xs font-normal">SDG {i}</Badge>
                    <Badge variant="secondary" className="text-xs font-normal">SDG {i + 1}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "impact-map" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Africa Impact Map</h2>
            <div className="flex space-x-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Projects</Badge>
              <Badge variant="outline">Partnerships</Badge>
            </div>
          </div>
          
          <div className="border rounded-xl bg-card overflow-hidden relative">
            <div className="aspect-[21/9] w-full bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:16px_16px] flex items-center justify-center relative">
              
              {/* Abstract Map Representation Placeholder */}
              <Globe className="w-64 h-64 text-muted/30 absolute" strokeWidth={1} />
              
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="bg-background/80 backdrop-blur-sm border p-4 rounded-lg shadow-lg pointer-events-auto">
                  <h3 className="font-bold mb-2 flex items-center"><MapPin className="w-4 h-4 mr-2 text-primary" /> Geographic Visualization Placeholder</h3>
                  <p className="text-sm text-muted-foreground max-w-xs text-center">Interactive SVG map rendering data points for active projects, capital deployment, and organizational presence across the continent.</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
