import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface LabCardProps {
  title: string;
  description: string;
  activeChallenges: number;
  participantCount: number;
  fundingOpportunities: number;
  status: string;
}

export const LabCard: React.FC<LabCardProps> = ({
  title,
  description,
  activeChallenges,
  participantCount,
  fundingOpportunities,
  status
}) => {
  // Determine status badge color based on status string
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-trust/10 text-trust";
      case "upcoming":
        return "bg-primary/10 text-primary";
      case "completed":
        return "bg-muted/10 text-muted-foreground";
      default:
        return "bg-muted/10 text-muted-foreground";
    }
  };

  return (
    <Card className="h-full hover:border-trust/30 transition-colors">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground block">Active Challenges</span>
            <span className="text-primary font-medium">{activeChallenges}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Participants</span>
            <span className="text-primary font-medium">{participantCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Funding Opportunities</span>
            <span className="text-primary font-medium">{fundingOpportunities}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Status</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeVariant(status)}`}>
              {status}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/5">
          Join Lab
        </Button>
      </CardFooter>
    </Card>
  );
};