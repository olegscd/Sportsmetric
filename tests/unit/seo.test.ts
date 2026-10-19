import assert from "node:assert/strict";
import { test } from "node:test";
import archive from "../../data/uaap_archive_master.json";
import { pageMetadata, serializeJsonLd } from "../../lib/seo";
import { archivePath, archiveSeo, indexableArchivePaths } from "../../lib/uaap-seo";
import { preparePublicUAAPData } from "../../lib/uaap-publication";
import type { UAAPArchiveExtras, UAAPTable } from "../../lib/uaap-schema";

const data = preparePublicUAAPData({ tables: archive.tables as unknown as UAAPTable[], extras: archive.extras as UAAPArchiveExtras, seasons: [] });

test("archive canonical URLs preserve competition identity while dropping tracking and resolving aliases", () => {
  const selected = archiveSeo(data, { sport: "basketball", season: "1998-1999", division: "Men", tab: "standings", utm_source: "social" });
  assert.equal(selected.path, archivePath("Basketball", "1998-1999", "Men's"));
  assert.equal(selected.index, true);
  assert.match(selected.title, /1998-1999 UAAP Basketball Men's Standings/);
  assert.equal(archiveSeo(data, { sport: "Basketball", season: "invalid" }).path, "/uaap?sport=Basketball");
  assert.equal(archiveSeo(data, { sport: "invalid" }).path, "/uaap");
});

test("withheld archive standings stay out of search while independently checked awards remain discoverable", () => {
  const pending = archiveSeo(data, { sport: "Chess", season: "2003-2004", division: "Juniors" });
  assert.equal(pending.index, false);
  const awards = archiveSeo(data, { sport: "Chess", season: "2003-2004", division: "Juniors", tab: "awards" });
  assert.equal(awards.index, true);
  const paths = indexableArchivePaths(data);
  assert.ok(!paths.includes(pending.path));
  assert.ok(paths.includes(awards.path));
  assert.equal(new Set(paths).size, paths.length);
});

test("preview metadata is noindex and structured data cannot break out of its script element", () => {
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "preview";
    assert.equal((pageMetadata("Players", "Description", "/players").robots as { index: boolean }).index, false);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
  const data = { name: "</script><script>alert(1)</script>" };
  const serialized = serializeJsonLd(data);
  assert.ok(!serialized.includes("<"));
  assert.deepEqual(JSON.parse(serialized), data);
});
