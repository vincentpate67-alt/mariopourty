import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanup,eligible} from './cleanup-aboubaphoto.mjs';
const now=Date.parse('2026-10-14T12:00:00Z');
const asset=(id,extra={})=>({public_id:id,asset_folder:'aboubaphoto',resource_type:'image',type:'upload',created_at:'2026-10-12T12:00:00Z',...extra});
test('Scope and retention exclude other folders, recent photos and invalid dates',()=>{
  assert(eligible(asset('old'),now));
  for(const change of [{asset_folder:'other'},{asset_folder:'aboubaphoto/other'},{resource_type:'video'},{type:'private'},{created_at:'broken'},{created_at:'2026-10-14T11:00:00Z'}])assert(!eligible(asset('safe',change),now));
});
test('Pagination collected before deletion, including a safe empty dry run',async()=>{
  const calls=[];
  const request=async(url,options)=>{
    calls.push({url,options});
    if(options.method==='DELETE'){
      assert.equal(calls.length,3);assert.deepEqual(options.body.getAll('public_ids[]'),['a','b']);
      return {ok:true,json:async()=>({deleted:{a:'deleted',b:'not_found'}})};
    }
    return {ok:true,json:async()=>calls.length===1?{resources:[asset('a'),asset('new',{created_at:'2026-10-14T11:00:00Z'})],next_cursor:'next'}:{resources:[asset('b'),asset('other',{asset_folder:'other'})]}};
  };
  const result=await cleanup({key:'test',secret:'test',dryRun:false,now,request,log:()=>{}});
  assert.equal(result.deleted,2);
  const dry=await cleanup({key:'test',secret:'test',now,log:()=>{},request:async(url,options)=>{
    assert.equal(options.method,undefined);return {ok:true,json:async()=>({resources:[asset('a')]})};
  }});assert.deepEqual(dry,{selected:1,deleted:0});
});
test('Failure never reports success or prints private API response',async()=>{
  await assert.rejects(()=>cleanup({key:'test',secret:'test',request:async()=>({ok:false,status:401}),log:()=>{}}),/HTTP 401/);
  await assert.rejects(()=>cleanup({}),/CLOUDINARY_API_KEY/);
});
