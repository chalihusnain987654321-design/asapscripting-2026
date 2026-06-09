import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { connectDB, Website, IndexingQueue, ExecutionLog, Settings } from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_URLS_PER_WEBSITE = 5000;
const SITEMAP_CONCURRENCY  = 8;

// ─── helpers ─────────────────────────────────────────────────────────────────

const pythonBin = process.env.PYTHON_EXECUTABLE || "python3";
const scriptsDir = join(process.cwd(), "scripts", "python");

function runScript(pythonFile: string, args: string[]): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const scriptPath = join(scriptsDir, pythonFile);
    const proc = spawn(pythonBin, [scriptPath, ...args], {
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
    });
    let output = "";
    proc.stdout.on("data", (d: Buffer) => { output += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { output += d.toString(); });
    proc.on("error", (err) => resolve({ output: err.message, exitCode: -1 }));
    proc.on("close", (code) => resolve({ output, exitCode: code ?? 0 }));
  });
}

async function cleanupFiles(paths: string[]) {
  await Promise.allSettled(paths.map((p) => unlink(p)));
}

// Parse one-URL-per-line TXT file
async function parseTxtFile(path: string): Promise<string[]> {
  const text = await readFile(path, "utf-8");
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

// Parse CSV where first column is URL (skip header row)
async function parseUrlCsv(path: string): Promise<string[]> {
  const text = await readFile(path, "utf-8");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((l) => l.split(",")[0].replace(/^"|"$/g, "").trim()).filter(Boolean);
}

// Node.js sitemap URL extractor — no Python needed, parallel fetching
async function extractPageUrls(
  sitemapUrl: string,
  maxUrls: number
): Promise<{ urls: string[]; log: string }> {
  const collected: string[] = [];
  let log = "";

  async function fetchXml(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ASAPBot/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) return null;
      return text;
    } catch {
      return null;
    }
  }

  async function processSitemap(url: string, depth: number): Promise<void> {
    if (collected.length >= maxUrls || depth > 4) return;
    const xml = await fetchXml(url);
    if (!xml) return;

    const isSitemapIndex = xml.includes("<sitemapindex") ||
      (xml.includes("<sitemap>") && xml.includes("<loc>") && !xml.includes("<urlset"));

    if (isSitemapIndex) {
      const childUrls: string[] = [];
      const blocks = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) ?? [];
      for (const block of blocks) {
        const m = block.match(/<loc>\s*([^<]+)\s*<\/loc>/);
        if (m) childUrls.push(m[1].trim());
      }
      log += `\n  [index] ${url} → ${childUrls.length} child sitemaps`;
      for (let i = 0; i < childUrls.length; i += SITEMAP_CONCURRENCY) {
        if (collected.length >= maxUrls) break;
        await Promise.all(childUrls.slice(i, i + SITEMAP_CONCURRENCY).map((u) => processSitemap(u, depth + 1)));
      }
    } else {
      const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
      for (const block of blocks) {
        if (collected.length >= maxUrls) break;
        const m = block.match(/<loc>\s*([^<]+)\s*<\/loc>/);
        if (m) collected.push(m[1].trim());
      }
      log += `\n  [sitemap] ${url} → ${blocks.length} URLs`;
    }
  }

  await processSitemap(sitemapUrl, 0);
  return { urls: collected, log };
}

// Parse GSC result CSV: URL,HTTP_Status,Result
async function parseGscResultCsv(path: string): Promise<{ url: string; success: boolean; error: string }[]> {
  const text = await readFile(path, "utf-8");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((l) => {
    const parts = l.split(",");
    const url    = parts[0]?.replace(/^"|"$/g, "").trim() ?? "";
    const result = parts.slice(2).join(",").replace(/^"|"$/g, "").trim();
    const success = result === "Indexed Successfully";
    return { url, success, error: success ? "" : result };
  });
}

// Parse Bing result CSV: URL,Status,Batch,HTTP Code
async function parseBingResultCsv(path: string): Promise<{ url: string; success: boolean; error: string }[]> {
  const text = await readFile(path, "utf-8");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((l) => {
    const parts = l.split(",");
    const url    = parts[0]?.replace(/^"|"$/g, "").trim() ?? "";
    const status = parts[1]?.replace(/^"|"$/g, "").trim() ?? "";
    const success = status === "Submitted";
    return { url, success, error: success ? "" : status };
  });
}

// ─── route ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Fetch all automation-enabled websites
  const allWebsites = await Website.find({}).lean();
  const websites = allWebsites.filter(
    (w) => !!(w as unknown as Record<string, unknown>).automationEnabled
  );

  if (websites.length === 0) {
    return Response.json({ message: "No automation-enabled websites." });
  }

  const settings = await Settings.findOne({ singleton: true }).lean();
  const results: { websiteId: string; name: string; steps: string[] }[] = [];

  for (const website of websites) {
    const websiteId   = website._id.toString();
    const websiteName = website.name;
    const raw         = website as unknown as Record<string, unknown>;

    console.log(`\n[AUTOMATION] Processing: ${websiteName}`);

    const automationStartDate = (raw.automationStartDate as Date | null) ?? null;
    if (automationStartDate && automationStartDate > new Date()) {
      console.log(`[AUTOMATION] Skipping ${websiteName} — start date not reached`);
      results.push({ websiteId, name: websiteName, steps: [`⏳ Scheduled to start at ${automationStartDate.toISOString()}`] });
      continue;
    }

    const gscAccountName = (raw.gscServiceAccountName as string) ?? "";
    const bingApiKey     = (raw.bingApiKey as string) ?? "";
    const robotsTxtUrl   = ((raw.robotsTxtUrl as string) || (website.url ? `${website.url.replace(/\/$/, "")}/robots.txt` : "")).replace(/([^:])\/\/+/g, "$1/");
    const existingSitemaps = (raw.sitemaps as { url: string }[]) ?? [];

    const tempFiles: string[] = [];
    const steps: string[] = [];
    const startedAt = new Date();
    let fullOutput = "";

    try {
      // ── Step 1: Discover sitemaps (only if none saved yet) ────────────────
      let sitemapUrls: string[] = existingSitemaps.map((s) => s.url);

      if (sitemapUrls.length === 0) {
        if (!robotsTxtUrl) {
          steps.push("⚠ Skipped sitemap discovery: no robots.txt URL configured.");
        } else {
          const sitemapOutputFile = join(tmpdir(), `asap_auto_sitemaps_${websiteId}_${randomUUID()}.txt`);
          tempFiles.push(sitemapOutputFile);

          const { output, exitCode } = await runScript("sitemap_scraper.py", [
            "--robots_urls", robotsTxtUrl,
            "--output_file", sitemapOutputFile,
          ]);
          fullOutput += `\n[SITEMAP DISCOVERY]\n${output}`;

          if (exitCode === 0) {
            const discovered = await parseTxtFile(sitemapOutputFile).catch(() => []);
            sitemapUrls = discovered;

            if (sitemapUrls.length > 0) {
              const now = new Date();
              await Website.collection.updateOne(
                { _id: website._id },
                { $set: { sitemaps: sitemapUrls.map((url) => ({ url, discoveredAt: now })) } }
              );
              console.log(`[AUTOMATION] ${websiteName}: discovered ${sitemapUrls.length} sitemap(s)`);
              steps.push(`✓ Discovered ${sitemapUrls.length} sitemap(s)`);
            } else {
              steps.push("⚠ Sitemap discovery ran but found no sitemaps");
            }
          } else {
            steps.push(`✗ Sitemap discovery failed (exit ${exitCode})`);
          }
        }
      } else {
        steps.push(`✓ Using ${sitemapUrls.length} saved sitemap(s)`);
      }

      // ── Step 2: Extract URLs via Node.js (parallel, no Python) ──────────
      let newUrlsAdded = 0;

      if (sitemapUrls.length > 0) {
        console.log(`[AUTOMATION] ${websiteName}: extracting URLs from ${sitemapUrls.length} sitemap(s)`);
        for (const sitemapUrl of sitemapUrls) {
          if (newUrlsAdded >= MAX_URLS_PER_WEBSITE) break;
          const { urls, log } = await extractPageUrls(sitemapUrl, MAX_URLS_PER_WEBSITE - newUrlsAdded);
          fullOutput += `\n[URL EXTRACT: ${sitemapUrl}]${log}`;

          for (const url of urls) {
            try {
              await IndexingQueue.updateOne(
                { websiteId, url },
                { $setOnInsert: { websiteId, url, discoveredAt: new Date(), gscStatus: "pending", bingStatus: "pending" } },
                { upsert: true }
              );
              newUrlsAdded++;
            } catch { /* duplicate — skip */ }
          }
        }
        steps.push(`✓ Added ${newUrlsAdded} new URLs to queue`);
        console.log(`[AUTOMATION] ${websiteName}: added ${newUrlsAdded} URLs to queue`);
      }

      // ── Step 3: GSC Indexing (200 pending URLs) ───────────────────────────
      console.log(`[AUTOMATION] ${websiteName}: starting GSC indexing`);
      const serviceAccount = settings?.serviceAccounts.find((a) => a.name === gscAccountName);

      if (!serviceAccount) {
        steps.push("⚠ Skipped GSC indexing: service account not found");
      } else {
        const pendingGsc = await IndexingQueue.find({ websiteId, gscStatus: "pending" })
          .limit(200)
          .lean();

        if (pendingGsc.length === 0) {
          steps.push("✓ GSC: no pending URLs");
        } else {
          const saFile   = join(tmpdir(), `asap_auto_sa_${websiteId}_${randomUUID()}.json`);
          const inCsv    = join(tmpdir(), `asap_auto_gsc_in_${websiteId}_${randomUUID()}.csv`);
          const outCsv   = join(tmpdir(), `asap_auto_gsc_out_${websiteId}_${randomUUID()}.csv`);
          tempFiles.push(saFile, inCsv, outCsv);

          await writeFile(saFile, serviceAccount.json);

          // Write input CSV (url column)
          const csvContent = "url\n" + pendingGsc.map((q) => q.url).join("\n");
          await writeFile(inCsv, csvContent);

          const { output, exitCode } = await runScript("url_indexer.py", [
            "--service_account_file", saFile,
            "--csv_file", inCsv,
            "--output_file", outCsv,
          ]);
          fullOutput += `\n[GSC INDEXING]\n${output}`;

          if (exitCode === 0) {
            const gscResults = await parseGscResultCsv(outCsv).catch(() => []);
            const resultMap = new Map(gscResults.map((r) => [r.url, r]));

            let gscOk = 0, gscFail = 0;
            for (const q of pendingGsc) {
              const r = resultMap.get(q.url);
              if (r?.success) {
                await IndexingQueue.updateOne(
                  { _id: q._id },
                  { $set: { gscStatus: "submitted", gscSubmittedAt: new Date(), gscError: null } }
                );
                gscOk++;
              } else {
                await IndexingQueue.updateOne(
                  { _id: q._id },
                  { $set: { gscStatus: "failed", gscError: r?.error ?? "Unknown error" } }
                );
                gscFail++;
              }
            }
            steps.push(`✓ GSC: ${gscOk} submitted, ${gscFail} failed`);
          } else {
            await IndexingQueue.updateMany(
              { _id: { $in: pendingGsc.map((q) => q._id) } },
              { $set: { gscStatus: "failed", gscError: `Script exited with code ${exitCode}` } }
            );
            steps.push(`✗ GSC indexing script failed (exit ${exitCode})`);
          }
        }
      }

      // ── Step 4: Bing IndexNow (10,000 pending URLs) ───────────────────────
      console.log(`[AUTOMATION] ${websiteName}: starting Bing indexing`);
      const pendingBing = await IndexingQueue.find({ websiteId, bingStatus: "pending" })
        .limit(10000)
        .lean();

      if (pendingBing.length === 0) {
        steps.push("✓ Bing: no pending URLs");
      } else {
        const bingInFile  = join(tmpdir(), `asap_auto_bing_in_${websiteId}_${randomUUID()}.txt`);
        const bingOutFile = join(tmpdir(), `asap_auto_bing_out_${websiteId}_${randomUUID()}.csv`);
        tempFiles.push(bingInFile, bingOutFile);

        await writeFile(bingInFile, pendingBing.map((q) => q.url).join("\n"));

        const bingArgs = ["--urls", bingInFile, "--output_file", bingOutFile];
        if (bingApiKey) bingArgs.push("--api_key", bingApiKey);

        const { output, exitCode } = await runScript("bing_indexnow.py", bingArgs);
        fullOutput += `\n[BING INDEXING]\n${output}`;

        if (exitCode === 0) {
          const bingResults = await parseBingResultCsv(bingOutFile).catch(() => []);
          const resultMap = new Map(bingResults.map((r) => [r.url, r]));

          let bingOk = 0, bingFail = 0;
          for (const q of pendingBing) {
            const r = resultMap.get(q.url);
            if (r?.success) {
              await IndexingQueue.updateOne(
                { _id: q._id },
                { $set: { bingStatus: "submitted", bingSubmittedAt: new Date(), bingError: null } }
              );
              bingOk++;
            } else {
              await IndexingQueue.updateOne(
                { _id: q._id },
                { $set: { bingStatus: "failed", bingError: r?.error ?? "Unknown error" } }
              );
              bingFail++;
            }
          }
          steps.push(`✓ Bing: ${bingOk} submitted, ${bingFail} failed`);
        } else {
          await IndexingQueue.updateMany(
            { _id: { $in: pendingBing.map((q) => q._id) } },
            { $set: { bingStatus: "failed", bingError: `Script exited with code ${exitCode}` } }
          );
          steps.push(`✗ Bing indexing script failed (exit ${exitCode})`);
        }
      }

    } finally {
      await cleanupFiles(tempFiles);
    }

    // ── Execution log ─────────────────────────────────────────────────────
    const durationMs = Date.now() - startedAt.getTime();
    const hasFailure = steps.some((s) => s.startsWith("✗"));

    await ExecutionLog.create({
      userId:      null,
      userEmail:   "system",
      userName:    "Automated",
      scriptSlug:  "automation-daily",
      scriptName:  "Daily Automation",
      inputs:      {},
      output:      fullOutput.trim(),
      status:      hasFailure ? "error" : "success",
      exitCode:    hasFailure ? 1 : 0,
      startedAt,
      completedAt: new Date(),
      durationMs,
      isAutomated: true,
      websiteId,
      websiteName,
    });

    console.log(`[AUTOMATION] ${websiteName}: done — ${steps.join(" | ")}`);
    results.push({ websiteId, name: websiteName, steps });
  }

  console.log(`[AUTOMATION] All done. Processed ${results.length} website(s).`);
  return Response.json({ processed: results.length, results });
}
