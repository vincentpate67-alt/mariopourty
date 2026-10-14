import {pathToFileURL} from 'node:url';

const CLOUD='ua1z1wb8', FOLDER='aboubaphoto', PRESET='aboubaphoto';
const DAY=24*60*60*1000;

export function eligible(asset,now){
  const created=Date.parse(asset.created_at);
  return asset.asset_folder===FOLDER && asset.resource_type==='image' && asset.type==='upload'
    && typeof asset.public_id==='string' && asset.public_id.length>0
    && Number.isFinite(created) && created<=now-DAY;
}

export async function cleanup({key,secret,dryRun=true,configurePreset=false,now=Date.now(),request=fetch,log=console.log}){
  if(!key||!secret)throw Error('Ajoute CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET dans les secrets Actions du dépôt.');
  const base='https://api.cloudinary.com/v1_1/'+CLOUD;
  const headers={Authorization:'Basic '+Buffer.from(key+':'+secret).toString('base64')};
  async function api(path,options={}){
    const response=await request(base+path,{...options,headers,signal:AbortSignal.timeout(30000)});
    // Never print API response bodies: they may contain private account information.
    if(!response.ok)throw Error('Cloudinary a refusé le nettoyage (HTTP '+response.status+').');
    return response.json();
  }
  if(configurePreset){
    if(dryRun)throw Error('La configuration du profil nécessite de désactiver le mode simulation.');
    await api('/upload_presets/'+PRESET,{method:'PUT',body:new URLSearchParams({return_delete_token:'true'})});
    log('Suppression temporaire activée pour les prochains envois Aboubaphoto.');
  }
  const ids=new Set(),seenCursors=new Set();let cursor;
  // Finish pagination before deleting, so removals cannot shift the listed pages.
  do{
    const query=new URLSearchParams({asset_folder:FOLDER,max_results:'500'});
    if(cursor)query.set('next_cursor',cursor);
    const page=await api('/resources/by_asset_folder?'+query);
    if(!Array.isArray(page.resources))throw Error('Liste Cloudinary inattendue : aucune suppression effectuée.');
    for(const asset of page.resources)if(eligible(asset,now))ids.add(asset.public_id);
    cursor=page.next_cursor;
    if(cursor&&seenCursors.has(cursor))throw Error('Pagination Cloudinary invalide : aucune suppression effectuée.');
    if(cursor)seenCursors.add(cursor);
  }while(cursor);
  log(ids.size+' photo(s) Aboubaphoto de plus de 24 h '+(dryRun?'à supprimer (simulation).':'à supprimer.'));
  if(dryRun)return {selected:ids.size,deleted:0};
  const list=[...ids];let deleted=0;
  for(let i=0;i<list.length;i+=100){
    const batch=list.slice(i,i+100),body=new URLSearchParams({invalidate:'true'});
    for(const id of batch)body.append('public_ids[]',id);
    const result=await api('/resources/image/upload',{method:'DELETE',body});
    for(const id of batch){
      const status=result.deleted?.[id];
      if(status!=='deleted'&&status!=='not_found')throw Error('Suppression partielle : relance le nettoyage pour réessayer.');
      deleted++;
    }
  }
  log(deleted+' photo(s) nettoyée(s).');return {selected:ids.size,deleted};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  cleanup({key:process.env.CLOUDINARY_API_KEY,secret:process.env.CLOUDINARY_API_SECRET,
    dryRun:process.env.CLEANUP_DRY_RUN!=='false',configurePreset:process.env.CONFIGURE_PRESET==='true'})
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}
