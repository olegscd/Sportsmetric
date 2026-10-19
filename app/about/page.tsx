import Link from "next/link";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { PageHeading } from "@/components/ui/PageHeading";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("About Sportsmetric — Philippine Sports & Filipino Excellence", "Learn about Sportsmetric's coverage of Philippine leagues, athlete performance and sports history, and its plans for Filipino athletes competing internationally.", "/about");

export default function AboutPage() {
  return <div className={PAGE_FRAME}>
    <JsonLd data={breadcrumbJsonLd([{ name: "About Sportsmetric", path: "/about" }])} />
    <PageHeading title="Philippine sports. Filipino excellence." eyebrow="About Sportsmetric" description="Making individual performance, team records and sports history easier to explore." />
    <div className="max-w-3xl space-y-8 text-sm leading-7 text-muted">
      <section className="space-y-3"><h2 className="text-lg font-bold text-foreground">Scores and the athletes behind them</h2>
        <p>Sportsmetric brings together Philippine sports scores, schedules, team standings and athlete statistics. Its current league pages cover UAAP basketball, the Philippine Basketball Association and the Premier Volleyball League, alongside a historical multi-sport UAAP archive.</p>
        <p>Player profiles connect the available season records and game logs so readers can explore individual performance. Coverage depends on the records published for each competition and season; an absent record does not mean an athlete or event did not exist.</p>
      </section>
      <section className="space-y-3"><h2 className="text-lg font-bold text-foreground">Building toward International</h2>
        <p>Sportsmetric’s direction extends to Filipino athletes competing overseas and on the international stage. The planned International section will focus on individual achievements, competition context and source-backed results. It will launch once verified athlete profiles are ready.</p>
      </section>
      <section className="space-y-3"><h2 className="text-lg font-bold text-foreground">Understanding the records</h2>
        <p>The UAAP archive distinguishes source-checked results from transcriptions awaiting review. Disputed records are withheld, and awards and leaders require a matching source review. Champion-only coverage, co-champions and competition stages are identified where supported by the source.</p>
        <p>Current league scores and statistics reflect the records available on Sportsmetric. Historical gaps and incomplete coverage remain visible. Game status and results can change as records are updated.</p>
        <Link href="/uaap" className="inline-flex min-h-11 items-center font-semibold text-primary">Explore the UAAP historical archive</Link>
      </section>
    </div>
  </div>;
}
