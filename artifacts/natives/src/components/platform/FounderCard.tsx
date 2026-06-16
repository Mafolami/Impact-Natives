import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "./VerificationBadge";

interface FounderCardProps {
  founderName: string;
  businessModelType: string;
  stage: string;
  endorsements: number;
  sector: string;
  seeking: string[];
  verified: boolean;
}

export const FounderCard: React.FC<FounderCardProps> = ({
  founderName,
  businessModelType,
  stage,
  endorsements,
  sector,
  seeking,
  verified
}) => {
  // Determine badge for stage
  const getStageBadge = (stage: string) => {
    switch (stage.toLowerCase()) {
      case "concept":
        return "bg-primary/10 text-primary";
      case "prototype":
        return "bg-accent/10 text-accent";
      case "pilot":
        return "bg-trust/10 text-trust";
      case "revenue-generating":
        return "bg-secondary/10 text-secondary-foreground";
      default:
        return "bg-muted/10 text-muted-foreground";
    }
  };

  return (
    <Card className="h-full hover:border-trust/30 transition-colors">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{founderName}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {businessModelType} • {stage}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {sector}
          </span>
          {seeking.map((tag, index) => (
            <span key={index} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            {endorsements} endorsements
          </span>
          {verified && (
            <>
              <VerificationBadge className="ml-1" />
              <span className="text-sm text-trust font-medium">Verified</span>
            </>
          )}
        </div>

        <div className="flex items-center space-x-2 mt-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStageBadge(stage)}`}>
            {stage}
          </span>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/5">
          View Profile
        </Button>
      </CardFooter>
    </Card>
  );
};