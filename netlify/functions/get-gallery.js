// Netlify serverless function.
// Fetches the list of photos in one event's GitHub folder, server-side, instead of
// each visitor's own browser calling GitHub directly. This fixes the rate-limit
// problem two ways at once:
//   1. An optional GITHUB_TOKEN (see below) raises the limit from 60/hour to
//      5,000/hour, shared across ALL visitors combined rather than 60 per visitor.
//   2. The response is cached at Netlify's edge for 10 minutes, so repeat visits
//      across ALL visitors within that window don't call GitHub again at all.
//
// Optional environment variable (Netlify dashboard → Environment variables):
//   GITHUB_TOKEN = a GitHub Personal Access Token, fine-grained, scoped to this repo,
//   with "Contents: Read-only" permission.
// If this token is missing, invalid, or expired, requests automatically retry
// without it — falling back to the 60/hour anonymous limit rather than breaking.

const GITHUB_OWNER = "firestarternepal-2015";
const GITHUB_REPO = "firestarternepal.com";
const GITHUB_BRANCH = "main";
const GITHUB_GALLERY_PATH = "images/Events";

exports.handler = async function (event) {
  const folder = event.queryStringParameters && event.queryStringParameters.folder;

  if (!folder) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing "folder" query parameter.' }) };
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_GALLERY_PATH}/${encodeURIComponent(folder)}?ref=${GITHUB_BRANCH}`;
  const baseHeaders = { 'User-Agent': 'firestarter-nepal-site' };

  try {
    let res;

    if (process.env.GITHUB_TOKEN) {
      res = await fetch(url, {
        headers: { ...baseHeaders, Authorization: `token ${process.env.GITHUB_TOKEN}` },
      });
      // 401 = invalid/expired token, 403 = token present but rejected (e.g. revoked).
      // Either way, retry anonymously instead of treating this as "no photos."
      if (res.status === 401 || res.status === 403) {
        res = await fetch(url, { headers: baseHeaders });
      }
    } else {
      res = await fetch(url, { headers: baseHeaders });
    }

    if (!res.ok) {
      // Folder genuinely doesn't exist yet, or both attempts were rejected
      // (e.g. anonymous limit also hit) — return an empty list rather than an
      // error, so the page just shows its placeholder tiles.
      return {
        statusCode: 200,
        headers: { 'Cache-Control': 'public, max-age=120' },
        body: JSON.stringify({ images: [] }),
      };
    }

    const data = await res.json();
    const images = Array.isArray(data)
      ? data
          .filter((f) => f.type === 'file' && /\.(jpe?g|png|gif|webp)$/i.test(f.name))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((f) => ({ url: f.download_url, name: f.name }))
      : [];

    return {
      statusCode: 200,
      headers: { 'Cache-Control': 'public, max-age=600' }, // cached at Netlify's edge for 10 minutes
      body: JSON.stringify({ images }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({ images: [] }),
    };
  }
};
