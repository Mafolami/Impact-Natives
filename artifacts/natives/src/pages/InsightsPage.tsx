import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, FileText, Library, Download, ArrowUpRight } from "lucide-react";

export default function InsightsPage() {
  const params = useParams();
  const tab = params.tab || "dashboard";

  return (
    <div className="container max-w-6xl py-12 md:py-24">
      <div className="mb-12 border-b pb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Insights & Impact</h1>
        <p className="text-xl text-muted-foreground">Data-driven visibility and intelligence for the ecosystem.</p>
      </div>

      {tab === "dashboard" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Ecosystem Dashboard</h2>
            <Button variant="outline"><Download className="w-4 h-4 mr-2"/> Export Report</Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Capital Mobilized", value: "$0M+", trend: "+0%" },
              { label: "Partnerships", value: "0", trend: "+0%" },
              { label: "Active Projects", value: "0", trend: "+0%" },
              { label: "Verified Entities", value: "0", trend: "+0%" }
            ].map((stat, i) => (
              <Card key={i} className="bg-card">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-bold">{stat.value}</h3>
                    <span className="text-xs text-[#2D6A4F] font-bold bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full">{stat.trend}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Capital Flow Over Time</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center bg-muted/20 border-t border-b">
                <div className="flex flex-col items-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                  <p className="font-mono text-sm">[Recharts Area/Bar Chart Placeholder]</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>SDG Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center bg-muted/20 border-t border-b">
                 <p className="font-mono text-sm text-muted-foreground">[Recharts Pie/Donut Chart Placeholder]</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "case-studies" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <h2 className="text-2xl font-bold">Case Studies</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="overflow-hidden hover:border-primary/50 transition-colors group cursor-pointer border-border">
                <div className="aspect-video bg-muted relative">
                   <div className="absolute inset-0 flex items-center justify-center">
                     <span className="text-muted-foreground/50 font-mono text-sm">[Image Placeholder]</span>
                   </div>
                </div>
                <CardContent className="p-6">
                  <div className="flex gap-2 mb-3">
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none">Agritech</Badge>
                    <Badge variant="secondary">Kenya</Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">Scaling smallholder financing models through blended capital</h3>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-2">How a consortium of DFIs, local banks, and agritech founders built a shared risk-mitigation framework.</p>
                  <div className="flex items-center text-sm font-medium text-primary">
                    Read Case Study <ArrowUpRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "research" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <h2 className="text-2xl font-bold">Research & Reports</h2>
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start md:items-center justify-between p-6 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 shrink-0 bg-primary/10 rounded flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">State of African Impact Ecosystem Q{i} 2024</h3>
                    <p className="text-sm text-muted-foreground mt-1">Analysis of funding trends, verification standards adoption, and emerging sectors.</p>
                  </div>
                </div>
                <Button variant="outline" className="shrink-0 mt-4 md:mt-0"><Download className="w-4 h-4 mr-2" /> Download PDF</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "solution-library" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Solution Library</h2>
            <p className="text-muted-foreground">Scalable models and intervention playbooks.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
             {[1, 2, 3, 4, 5, 6].map((i) => (
               <Card key={i} className="hover:border-primary/50 transition-colors cursor-pointer border-border group">
                 <CardHeader className="pb-4">
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center mb-4">
                      <Library className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-lg">Intervention Playbook {i}</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">Standardized implementation framework for replication in new geographies.</p>
                 </CardContent>
               </Card>
             ))}
          </div>
        </div>
      )}
      
      {tab === "resources" && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <h2 className="text-2xl font-bold">Resource Hub</h2>
           <div className="grid md:grid-cols-2 gap-6">
             <Card>
               <CardHeader>
                 <CardTitle>Partnership Frameworks</CardTitle>
                 <CardDescription>Templates for structuring multi-stakeholder agreements.</CardDescription>
               </CardHeader>
               <CardContent className="space-y-3">
                 {['MoU Template - Consortium', 'Data Sharing Agreement', 'Co-funding Term Sheet'].map(doc => (
                   <div key={doc} className="flex justify-between items-center p-3 border rounded hover:bg-muted/50 cursor-pointer">
                     <span className="text-sm font-medium">{doc}</span>
                     <Download className="w-4 h-4 text-muted-foreground" />
                   </div>
                 ))}
               </CardContent>
             </Card>
             
             <Card>
               <CardHeader>
                 <CardTitle>Reporting Guides</CardTitle>
                 <CardDescription>Standardized methodologies for impact measurement.</CardDescription>
               </CardHeader>
               <CardContent className="space-y-3">
                 {['SDG Alignment Guide', 'Metrics Definition Dictionary', 'Verification Readiness Checklist'].map(doc => (
                   <div key={doc} className="flex justify-between items-center p-3 border rounded hover:bg-muted/50 cursor-pointer">
                     <span className="text-sm font-medium">{doc}</span>
                     <Download className="w-4 h-4 text-muted-foreground" />
                   </div>
                 ))}
               </CardContent>
             </Card>
           </div>
        </div>
      )}
      
    </div>
  );
}
