import { prisma } from "../lib/db";
import { fetchSubredditPosts } from "../lib/reddit";

const sub = process.argv[2];
if (!sub) { console.error("Usage: npx tsx scripts/single.ts <subreddit>"); process.exit(1); }

async function main() {
  const posts = await fetchSubredditPosts(sub, 10000);
  let added = 0;
  for (const post of posts) {
    const existing = await prisma.video.findUnique({ where: { redditId: post.id } });
    if (existing) continue;
    if (!post.videoUrl) continue;
    await prisma.video.create({
      data: {
        redditId: post.id, title: post.title, subreddit: post.subreddit,
        videoUrl: post.videoUrl, hlsUrl: post.hlsUrl, thumbnail: post.thumbnail,
        duration: post.duration, width: post.width, height: post.height,
        author: post.author, permalink: post.permalink, score: post.score,
        isGif: post.isGif, createdAt: post.createdAt,
      },
    });
    added++;
  }
  const count = await prisma.video.count({ where: { subreddit: sub } });
  console.log(`r/${sub}: added ${added}, total ${count}`);
}

main().then(() => process.exit(0)).catch(console.error);
