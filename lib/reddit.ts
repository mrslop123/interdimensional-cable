export const SUBREDDITS = [
  "aivideo",
  "weirddalle",
  "FacebookAIslop",
  "aislop",
  "SoraAi",
  "runwayml",
  "aivideos",
  "kling",
  "animatediff",
  "midjourney",
  "Seedance_AI",
  "veo3",
  "HiggsfieldAI",
  "CursedAI",
];

export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  videoUrl: string | null;
  hlsUrl: string | null;
  thumbnail: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  author: string;
  permalink: string;
  score: number;
  isGif: boolean;
  createdAt: Date;
}

interface RedditChild {
  data: {
    id: string;
    title: string;
    subreddit: string;
    author: string;
    permalink: string;
    score: number;
    thumbnail: string;
    over_18: boolean;
    created_utc: number;
    media?: {
      reddit_video?: {
        fallback_url: string;
        hls_url: string;
        duration: number;
        width: number;
        height: number;
        is_gif: boolean;
      };
    };
    url: string;
    is_video: boolean;
  };
}

function extractVideoUrl(post: RedditChild["data"]): string | null {
  if (post.media?.reddit_video?.hls_url) {
    return post.media.reddit_video.hls_url;
  }
  if (post.media?.reddit_video?.fallback_url) {
    return post.media.reddit_video.fallback_url;
  }
  if (post.is_video && post.url.includes("v.redd.it")) {
    return post.media?.reddit_video?.hls_url ?? post.media?.reddit_video?.fallback_url ?? null;
  }
  if (post.url.endsWith(".mp4") || post.url.endsWith(".webm") || post.url.endsWith(".m3u8")) {
    return post.url;
  }
  return null;
}

function extractHlsUrl(post: RedditChild["data"]): string | null {
  return post.media?.reddit_video?.hls_url ?? null;
}

function extractDuration(post: RedditChild["data"]): number | null {
  if (post.media?.reddit_video?.duration) {
    return Math.floor(post.media.reddit_video.duration);
  }
  return null;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET || "";

  if (!clientId) {
    throw new Error("Missing REDDIT_CLIENT_ID in .env");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "interdimensional_cable/1.0",
    },
    body: "grant_type=https://oauth.reddit.com/grants/installed_client&device_id=DO_NOT_TRACK_THIS_DEVICE",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Reddit auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

export async function fetchSubredditTopPosts(
  subreddit: string,
  limit = 10,
): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];

  try {
    const token = await getAccessToken();
    const url = `https://oauth.reddit.com/r/${subreddit}/top.json?t=all&limit=${limit}&raw_json=1`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "interdimensional_cable/1.0",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const children = json.data.children;
    if (!children || children.length === 0) return posts;

    for (const child of children) {
      const d = child.data;
      if (d.over_18) continue;
      if (/chatgpt/i.test(d.title)) continue;
      if (/epstein|maxwell/i.test(d.title)) continue;

      const videoUrl = extractVideoUrl(d);
      if (!videoUrl) continue;

      posts.push({
        id: d.id,
        title: d.title,
        subreddit: d.subreddit,
        videoUrl,
        hlsUrl: extractHlsUrl(d),
        thumbnail: d.thumbnail && d.thumbnail.startsWith("http") ? d.thumbnail : null,
        duration: extractDuration(d),
        width: d.media?.reddit_video?.width ?? null,
        height: d.media?.reddit_video?.height ?? null,
        author: d.author,
        permalink: d.permalink,
        score: d.score,
        isGif: d.media?.reddit_video?.is_gif ?? false,
        createdAt: new Date(d.created_utc * 1000),
      });
    }

    return posts;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  r/${subreddit} top: ${msg}`);
    return posts;
  }
}

export async function fetchSubredditPosts(
  subreddit: string,
  maxPosts = 1000,
  since?: Date,
): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  let after: string | null = null;

  try {
    const token = await getAccessToken();

    while (posts.length < maxPosts) {
      let url = `https://oauth.reddit.com/r/${subreddit}/new.json?limit=100&raw_json=1`;
      if (after) url += `&after=${after}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "interdimensional_cable/1.0",
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      const children = json.data.children;
      if (!children || children.length === 0) break;

      for (const child of children) {
        if (posts.length >= maxPosts) break;

        const d = child.data;
        const createdAt = new Date(d.created_utc * 1000);
        if (since && createdAt < since) break;
        if (d.over_18) continue;
        if (/chatgpt/i.test(d.title)) continue;

        const videoUrl = extractVideoUrl(d);
        if (!videoUrl) continue;

        const width = d.media?.reddit_video?.width ?? 0;
        const height = d.media?.reddit_video?.height ?? 0;

        const hlsUrl = extractHlsUrl(d);
        const thumbnail =
          d.thumbnail && d.thumbnail.startsWith("http") ? d.thumbnail : null;

        posts.push({
          id: d.id,
          title: d.title,
          subreddit: d.subreddit,
          videoUrl,
          hlsUrl,
          thumbnail,
          duration: extractDuration(d),
          width: width || null,
          height: height || null,
          author: d.author,
          permalink: d.permalink,
          score: d.score,
          isGif: d.media?.reddit_video?.is_gif ?? false,
          createdAt,
        });
      }

      if (since && children.length > 0) {
        const lastCreatedAt = new Date(children[children.length - 1].data.created_utc * 1000);
        if (lastCreatedAt < since) break;
      }

      after = json.data.after;
      if (!after) break;
    }

    return posts;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  r/${subreddit}: ${msg}`);
    return posts;
  }
}
