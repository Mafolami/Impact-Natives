Impact Verification

<div>
            <h2 className="text-4xl font-bold mb-2">Impact Verification</h2>
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
                  <Link href="/signup"><Button size="sm" variant="secondary">Export PDF</Button></Link>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <span className="text-sm font-medium">Annual ESG Alignment</span>
                  <Link href="/signup"><Button size="sm" variant="secondary">Export PDF</Button></Link>
                </div>
              </CardContent>
            </Card>
          </div>


Hardcoded Impact Initiatives

// ─── Data ────────────────────────────────────────────────────────────────────
const INITIATIVES: Initiative[] = [] 
  {
    id: 1,
    title: "Rural Last-Mile Health Delivery",
    sectors: ["Health"],
    locations: ["Northern Nigeria"],
    status: "Sponsorship Secured",
    budget: "$180k–$300k",
    partnerships: ["technical", "operational", "leadership"],
    eois: 7,
    problem: "Communities beyond 50km of health facilities lack access to essential medicines and diagnostic services.",
    outcome: "Reduce preventable deaths in target communities by 40% over 24 months.",
    tags: ["Health", "Last-Mile", "Nigeria"],
    posted: "12 days ago",
  },
  {
    id: 2,
    title: "Open-Source Crop Price Data Network",
    sectors: ["Agriculture"],
    locations: ["West Africa"],
    status: "Listed",
    budget: "$40k–$90k",
    partnerships: ["funding", "technical", "operational"],
    eois: 3,
    problem: "Smallholder farmers lack access to real-time, reliable crop price data, leading to exploitation.",
    outcome: "Empower 50,000+ farmers with transparent price discovery tools.",
    tags: ["AgriTech", "Data", "West Africa"],
    posted: "3 days ago",
  },
  {
    id: 3,
    title: "Girls in Climate Science Fellowship",
    sectors: ["Education", "Climate"],
    locations: ["Kenya", "East Africa"],
    status: "Seeking Partners",
    budget: "$200k–$450k",
    partnerships: ["technical", "leadership"],
    eois: 14,
    problem: "Women and girls are underrepresented in climate science despite being disproportionately affected by climate change.",
    outcome: "Train and place 200 girls in climate research roles by 2027.",
    tags: ["Climate", "Gender", "Education"],
    posted: "19 days ago",
  },
  {
    id: 4,
    title: "Urban Informal Waste-to-Energy Pilots",
    sectors: ["Climate", "Energy"],
    locations: ["Lagos"],
    status: "Listed",
    budget: "$120k–$250k",
    partnerships: ["funding", "technical", "operational"],
    eois: 5,
    problem: "Informal waste accumulation in dense urban areas contributes to disease and pollution.",
    outcome: "Convert 200 tonnes/month of informal waste into usable energy for local communities.",
    tags: ["Waste", "Energy", "Urban"],
    posted: "7 days ago",
  },
  {
    id: 5,
    title: "Digital Legal Aid for Migrant Workers",
    sectors: ["Governance & Rights"],
    locations: ["Southern Africa"],
    status: "Executing",
    budget: "$60k–$130k",
    partnerships: ["technical", "operational"],
    eois: 11,
    problem: "Migrant workers face widespread rights violations with no accessible legal recourse.",
    outcome: "Provide legal assistance to 15,000 workers through a digital platform.",
    tags: ["Rights", "Migration", "LegalTech"],
    posted: "31 days ago",
  },
  {
    id: 6,
    title: "Menstrual Health Supply Chain for Schools",
    sectors: ["Health", "Education"],
    locations: ["Kenya", "Sub-Saharan Africa"],
    status: "Listed",
    budget: "$30k–$80k",
    partnerships: ["funding", "operational", "leadership"],
    eois: 2,
    problem: "Lack of menstrual products causes girls to miss 20%+ of school days annually.",
    outcome: "Establish a sustainable supply chain reaching 500 schools across 3 countries.",
    tags: ["Health", "Education", "Girls"],
    posted: "2 days ago",
  },
];*/}