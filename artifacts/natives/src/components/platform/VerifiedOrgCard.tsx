import * as React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "./VerificationBadge";
import { SDGTag } from "./SDGTag";

interface VerifiedOrgCardProps {
  name: string;
  sector: string;
  country: string;
  sdgs: string[];
  verified: boolean;
  description: string;
  partnershipType?: string;
  organizationType?: string;
  href?: string;
}

export const VerifiedOrgCard: React.FC<VerifiedOrgCardProps> = ({
  name,
  sector,
  country,
  sdgs,
  verified,
  description,
  partnershipType,
  organizationType,
  href = "/coming-soon"
}) => {
  return (
    <Card className="hover:border-trust/30 transition-colors">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{name}</CardTitle>
        {organizationType && (
          <CardDescription className="text-sm text-muted-foreground">
            {organizationType}
          </CardDescription>
        )}
        <CardDescription className="text-sm text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {sector}
          </span>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {country}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {sdgs.map((sdg, index) => (
            <SDGTag key={index} label={sdg} />
          ))}
        </div>

        {verified && (
          <div className="flex items-center space-x-2">
            <VerificationBadge />
            <span className="text-sm text-trust font-medium">Verified Organization</span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Link href={href}>
          <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/5">
            View Profile
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};