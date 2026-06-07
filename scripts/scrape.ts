import { prisma } from "../lib/db";
import { fetchSubredditPosts, SUBREDDITS } from "../lib/reddit";

function parseArgs() {
  const args = process.argv.slice(2);
  const monthsIdx = args.indexOf("--months");
  const months =
    monthsIdx !== -1 ? parseInt(args[monthsIdx + 1], 10) : null;
  return { months };
}

async function scrape() {
  const { months } = parseArgs();

  const since = months
    ? new Date(Date.now() - months * 30 * 86400000)
    : null;

  console.log(
    `Starting Reddit video scrape${since ? ` (last ${months} months)` : ""}...\n`,
  );

  for (const sub of SUBREDDITS) {
    console.log(`🔍 Fetching r/${sub}${since ? ` since ${since.toISOString().slice(0, 10)}` : ""}...`);

    const posts = await fetchSubredditPosts(sub, 10000, since ?? undefined);
    if (posts.length === 0) {
      console.log(`  No video posts found\n`);
      continue;
    }

    const oldest = posts[posts.length - 1];
    const daysAgo = Math.floor(
      (Date.now() - oldest.createdAt.getTime()) / 86400000,
    );

    let added = 0;
    let skipped = 0;
    let updated = 0;

    for (const post of posts) {
      const existing = await prisma.video.findUnique({
        where: { redditId: post.id },
      });

      if (existing) {
        if (!existing.hlsUrl && post.hlsUrl) {
          await prisma.video.update({
            where: { redditId: post.id },
            data: {
              hlsUrl: post.hlsUrl,
              width: post.width,
              height: post.height,
              author: post.author,
              permalink: post.permalink,
              score: post.score,
              isGif: post.isGif,
            },
          });
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      if (!post.videoUrl) continue;

      await prisma.video.create({
        data: {
          redditId: post.id,
          title: post.title,
          subreddit: post.subreddit,
          videoUrl: post.videoUrl,
          hlsUrl: post.hlsUrl,
          thumbnail: post.thumbnail,
          duration: post.duration,
          width: post.width,
          height: post.height,
          author: post.author,
          permalink: post.permalink,
          score: post.score,
          isGif: post.isGif,
          createdAt: post.createdAt,
        },
      });

      added++;
    }

    console.log(`  ${posts.length} videos (${daysAgo}d back), added ${added}, updated ${updated}, skipped ${skipped}\n`);
  }

  const count = await prisma.video.count();
  console.log(`Done! Total videos in database: ${count}`);
}

scrape()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Scrape failed:", err);
    process.exit(1);
  });
