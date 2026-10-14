// Cloudflare Worker: secrets belong in Settings > Variables and Secrets.
// Configure an hourly Cron Trigger: 23 * * * * (UTC).
const CLOUD = 'ua1z1wb8';
const FOLDER = 'aboubaphoto';
const DAY = 86400000;

export async function cleanup(env, request = fetch, now = Date.now()) {
  if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error('Secrets Cloudinary manquants.');
  }
  const authorization = 'Basic ' + btoa(env.CLOUDINARY_API_KEY + ':' + env.CLOUDINARY_API_SECRET);
  async function api(path, body, method = 'POST') {
    const json = !(body instanceof URLSearchParams);
    const response = await request('https://api.cloudinary.com/v1_1/' + CLOUD + path, {
      method, headers: { Authorization: authorization,
        'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' },
      body: json ? JSON.stringify(body) : body,
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error('Cloudinary HTTP ' + response.status);
    return response.json();
  }
  // Bounded work fits the free Worker: up to 500 oldest expired images per run.
  // Remaining images are picked first on the next run, without storing a cursor.
  const page = await api('/resources/search', {
    expression: 'asset_folder=' + FOLDER + ' AND resource_type=image AND type=upload AND created_at<=' + Math.floor((now - DAY) / 1000),
    sort_by: [{created_at: 'asc'}], max_results: 500
  });
  if (!Array.isArray(page.resources)) throw new Error('Liste Cloudinary invalide.');
  const ids = [...new Set(page.resources.filter(asset =>
    asset.asset_folder === FOLDER && asset.resource_type === 'image' && asset.type === 'upload'
    && typeof asset.public_id === 'string' && asset.public_id.length > 0
    && Number.isFinite(Date.parse(asset.created_at)) && Date.parse(asset.created_at) <= now - DAY
  ).map(asset => asset.public_id))];
  const dryRun = env.DRY_RUN === 'true';
  let deleted = 0;
  if (!dryRun) for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100), body = new URLSearchParams({invalidate: 'true'});
    batch.forEach(id => body.append('public_ids[]', id));
    const result = await api('/resources/image/upload', body, 'DELETE');
    for (const id of batch) {
      if (!['deleted', 'not_found'].includes(result.deleted?.[id])) throw new Error('Suppression partielle : nouvel essai au prochain passage.');
      deleted++;
    }
  }
  const summary = {selected: ids.length, deleted, dryRun, morePending: Boolean(page.next_cursor)};
  console.log('Nettoyage Aboubaphoto', JSON.stringify(summary));
  return summary;
}

export default {
  async scheduled(_event, env) { await cleanup(env); },
  // The public URL must never trigger deletion or expose secrets/photo URLs.
  fetch() { return new Response('Nettoyage planifié uniquement.', {status: 404}); }
};
