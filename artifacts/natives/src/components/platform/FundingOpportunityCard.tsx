import { Link } from "wouter";
import { getAuthLinkProps } from "@/lib/authLinks";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FundingOpportunityCardProps {
  title: string;
  instrumentType: string;
  sector: string;
  deadline: string;
  leadOrganization: string;
  openSlots: number;
  description: string;
}

export const FundingOpportunityCard: React.FC<FundingOpportunityCardProps> = ({
  title,
  instrumentType,
  sector,
  deadline,
  leadOrganization,
  openSlots,
  description
}) => {
  return (
    <Card className="h-full hover:border-trust/30 transition-colors">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground block">Funding Type</span>
            <span className="text-primary font-medium">{instrumentType}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Sector</span>
            <span className="text-primary font-medium">{sector}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Deadline</span>
            <span className="text-primary font-medium">{deadline}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Lead Organization</span>
            <span className="text-primary font-medium">{leadOrganization}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-muted-foreground">Consortium Slots</span>
          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
            {openSlots} Open
          </span>
        </div>
      </CardContent>
      <CardFooter>
        <a {...getAuthLinkProps("/signup")}>
          <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/5">
            Express Interest
          </Button>
        </a>
      </CardFooter>
    </Card>
  );
};