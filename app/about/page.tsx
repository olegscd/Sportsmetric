import Link from "next/link";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeading } from "@/components/ui/PageHeading";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("About Sportsmetric — Philippine Sports & Filipino Excellence", "Learn about Sportsmetric's coverage of Philippine leagues, athlete performance and sports history, and its plans for Filipino athletes competing internationally.", "/about");

export default function AboutPage() {
  return (
    <div className={PAGE_FRAME}>
      <JsonLd data={breadcrumbJsonLd([{ name: "About Sportsmetric", path: "/about" }])} />
      <PageHeading title="Philippine sports. Filipino excellence." eyebrow="About Sportsmetric" description="Making individual performance, team records and sports history easier to explore." />
      <div className="grid max-w-5xl gap-4 md:grid-cols-3">
        <Card className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-muted">
          <h2 className="text-base font-bold text-foreground">Scores and the athletes behind them</h2>
          <p>Sportsmetric brings together Philippine sports scores, schedules, team standings and athlete statistics across UAAP basketball, the Philippine Basketball Association and the Premier Volleyball League, alongside a historical multi-sport UAAP archive.</p>
          <p>Player profiles connect the available season records and game logs so readers can explore individual performance. Coverage depends on the records published for each competition and season; an absent record does not mean an athlete or event did not exist.</p>
        </Card>
        <Card className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-muted">
          <h2 className="text-base font-bold text-foreground">Building toward International</h2>
          <p>Sportsmetric’s direction extends to Filipino athletes competing overseas and on the international stage. The planned International section will focus on individual achievements, competition context and source-backed results. It will launch once verified athlete profiles are ready.</p>
        </Card>
        <Card className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-muted">
          <h2 className="text-base font-bold text-foreground">Understanding the records</h2>
          <p>The UAAP archive distinguishes source-checked results from transcriptions awaiting review. Disputed records are withheld, and awards and leaders require a matching source review. Champion-only coverage, co-champions and competition stages are identified where supported by the source.</p>
          <p>Current league scores and statistics reflect the records available on Sportsmetric. Historical gaps and incomplete coverage remain visible. Game status and results can change as records are updated.</p>
          <div className="mt-auto pt-2">
            <Link href="/uaap" className={buttonClasses({ variant: "outline", size: "sm" })}>
              Explore the UAAP historical archive
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
