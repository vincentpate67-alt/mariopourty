import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker, {cleanup} from './worker.mjs';
const now=Date.parse('2026-10-14T12:00:00Z');
const env={CLOUDINARY_API_KEY:'test',CLOUDINARY_API_SECRET:'test'};
const old={asset_folder:'aboubaphoto',resource_type:'image',type:'upload',public_id:'old',created_at:'2026-10-12T12:00:00Z'};
test('Only expired Aboubaphoto images are deleted',async()=>{
  let calls=0;
  const result=await cleanup(env,async(url,options)=>{
    calls++;
    if(options.method==='DELETE') {
      assert.deepEqual(options.body.getAll('public_ids[]'),['old']);
      return {ok:true,json:async()=>({deleted:{old:'deleted'}})};
    }
    assert.match(JSON.parse(options.body).expression,/asset_folder=aboubaphoto/);
    return {ok:true,json:async()=>({resources:[old,{...old,public_id:'other',asset_folder:'other'},
      {...old,public_id:'fresh',created_at:'2026-10-14T11:00:00Z'}, {...old,public_id:'invalid',created_at:'bad'}]})};
  },now);
  assert.equal(calls,2);assert.equal(result.deleted,1);
});
test('Simulation and HTTP access cannot delete anything',async()=>{
  const result=await cleanup({...env,DRY_RUN:'true'},async(url,options)=>{
    assert.equal(options.method,'POST');return {ok:true,json:async()=>({resources:[old]})};
  },now);
  assert.equal(result.deleted,0);assert.equal(result.selected,1);
  assert.equal(worker.fetch().status,404);
});
test('Missing credentials and API failures are visible',async()=>{
  await assert.rejects(()=>cleanup({}),/Secrets/);
  await assert.rejects(()=>cleanup(env,async()=>({ok:false,status:401}),now),/401/);
});

