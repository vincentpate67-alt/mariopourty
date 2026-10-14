(() => {
  'use strict';
  const base=window.PourtyBoardEngine,model=window.PourtyBoardModel,copy=value=>JSON.parse(JSON.stringify(value));
  const phases=['shop-sale-menu','shop-sale','shop-menu','shop-replace','shop-purchase','item-target','item-random','item-animation'];
  const key=state=>state.round+':'+state.turn+':'+base.active(state);
  const inventory=(state,id=base.active(state))=>state.inventories?.[id]||[];
  const inventoryCapacity=(state,id=base.active(state))=>state.inventoryCaps?.[id]??3;
  const ready=state=>{const next=copy(state);next.inventories ||= next.wallets.map(()=>[]);return next;};
  const usedItem=state=>state.itemUsedTurn===key(state);
  const targets=state=>window.PourtyBoardEngine.itemTargets(state);
  function create(session,random){const state=base.create(session,random);state.inventories=session.players.map(()=>[]);state.inventoryCaps=session.players.map(()=>session.inventorySlots??3);return state;}
  function startEffect(state,board,session){if(state.phase==='land'&&base.nodeAt(state,board).type==='loot'){const next=ready(state);next.phase='gift-roll';return next;}if(state.phase!=='pass'||base.nodeAt(state,board).type!=='shop')return base.startEffect(state,board);const next=ready(state);if(session&&state.round>=session.turns){next.phase=saleOffers(next,session).length?'shop-sale-menu':'moving';return next;}next.phase=(next.wallets[base.active(next)].ac>=1||(session&&saleOffers(next,session).length>0))?'shop-menu':'moving';return next;}
  function offers(state,session,nodeId){if(state.round>=session.turns)return [];const node=nodeId===undefined?base.nodeAt(state,session.board):session.board.nodes.find(n=>n.id===nodeId);if(node?.type!=='shop')throw Error('Shop introuvable.');return model.normalizeShop(node.shop)[session.turns-state.round<5?'late':'early'].map(o=>({...o,originalPrice:Math.max(1,Math.floor(o.price*(session.shopMultiplier??1))),price:state.street?window.PourtyStreet.price(state,o.itemId,o.price,session):Math.max(1,Math.floor(o.price*(session.shopMultiplier??1)))*(window.PourtyBoardEngine.priceMultiplier?.(state)||1)}));}
  function saleOffers(state,session){
    if(session.shopSelling===false)return [];
    const node=base.nodeAt(state,session.board);if(node.type!=='shop')return [];
    const prices=new Map();for(const o of model.normalizeShop(node.shop)[session.turns-state.round<5?'late':'early'])prices.set(o.itemId,Math.min(prices.get(o.itemId)??Infinity,o.price));
    return inventory(state).map((itemId,index)=>({itemId,index,originalPrice:Math.max(1,Math.floor((prices.get(itemId)??0)*(session.shopMultiplier??1))),price:state.street?window.PourtyStreet.price(state,itemId,prices.get(itemId)??0,session):Math.max(1,Math.floor(Math.floor((prices.get(itemId)??0)*(session.shopMultiplier??1))*.8))})).filter(o=>prices.has(o.itemId)&&!model.items[o.itemId].locked);
  }
  function openSale(state,session){if(state.phase!=='shop-menu'||!saleOffers(state,session).length)throw Error('Aucun objet à vendre.');return {...ready(state),phase:'shop-sale-menu'};}
  function cancelSale(state){if(state.phase!=='shop-sale-menu')throw Error('Vente indisponible.');return {...ready(state),phase:'shop-menu'};}
  function sellItem(state,session,index){
    if(state.phase!=='shop-sale-menu')throw Error('Vente indisponible.');const offer=saleOffers(state,session).find(o=>o.index===index);if(!offer)throw Error('Objet invendable.');
    const next=ready(state),owner=base.active(state);next.sale={owner,itemId:offer.itemId,price:offer.price,before:copy(state.wallets)};
    next.inventories[owner].splice(index,1);next.wallets[owner].ac+=offer.price;next.phase='shop-sale';return next;
  }
  function finishSale(state){if(state.phase!=='shop-sale')throw Error('Aucune vente en cours.');const next=ready(state);delete next.sale;next.phase='moving';return next;}
  function availableItems(state,session){return model.normalizeItemPool(session.board.itemPool)[session.turns-state.round<5?'late':'early'];}
  function giveItem(state,owner,itemId,replace){
    if(!['turn','choice','gift-roll','gift-replace'].includes(state.phase)||!Number.isInteger(owner)||!state.wallets[owner]||!Object.hasOwn(model.items,itemId))throw Error('Don impossible.');
    const next=ready(state),previous=next.gift;
    if(state.phase==='gift-replace'&&(!previous||previous.owner!==owner||previous.itemId!==itemId))throw Error('Objet invalide.');
    next.gift=previous||{owner,itemId,after:state.phase==='gift-roll'?'land-complete':state.phase};
    const bag=next.inventories[owner],capacity=inventoryCapacity(next,owner);
    if(bag.length>=capacity&&replace===undefined){next.phase='gift-replace';return next;}
    if(bag.length>=capacity){if(!Number.isInteger(replace)||replace<0||replace>=capacity)throw Error('Remplacement invalide.');if(model.items[bag[replace]].locked)throw Error('Cet objet doit être utilisé.');bag[replace]=itemId;}else bag.push(itemId);
    next.phase='gift-delivery';return next;
  }
  function finishGift(state){if(!['gift-replace','gift-delivery'].includes(state.phase)||!state.gift)throw Error('Aucun objet en attente.');const next=ready(state);next.phase=next.gift.after;delete next.gift;return next;}
  function buy(state,session,index,replace){
    if(!['shop-menu','shop-replace'].includes(state.phase))throw Error('Shop indisponible.');const offer=offers(state,session)[index],id=base.active(state);
    if(!Number.isInteger(index)||!offer||state.wallets[id].ac<1||state.wallets[id].ac<offer.price)throw Error('Achat impossible.');
    const next=ready(state),bag=next.inventories[id],capacity=inventoryCapacity(next,id);
    if(bag.length>=capacity&&replace===undefined){next.pendingOffer=index;next.phase='shop-replace';return next;}
    if(bag.length>=capacity&&(!Number.isInteger(replace)||replace<0||replace>=bag.length))throw Error('Remplacement invalide.');
    next.purchase={owner:id,itemId:offer.itemId,price:offer.price,before:copy(next.wallets)};next.wallets[id].ac-=offer.price;
    if(bag.length>=capacity){if(model.items[bag[replace]].locked)throw Error('Cet objet doit être utilisé.');bag[replace]=offer.itemId;}else bag.push(offer.itemId);
    delete next.pendingOffer;next.phase='shop-purchase';return next;
  }
  function decline(state){if(state.phase!=='shop-replace')throw Error('Aucun objet à refuser.');const next=ready(state);delete next.pendingOffer;next.phase='shop-menu';return next;}
  function leaveShop(state){if(!['shop-menu','shop-replace','shop-sale-menu'].includes(state.phase))throw Error('Shop indisponible.');const next=ready(state);delete next.pendingOffer;next.phase='moving';return next;}
  function finishPurchase(state){if(state.phase!=='shop-purchase')throw Error('Aucun achat en cours.');const next=ready(state);delete next.purchase;next.phase='moving';return next;}
  function beginItem(state,index){
    if(state.phase!=='turn'||usedItem(state))throw Error('Objet indisponible pour ce tour.');const next=ready(state),id=base.active(next),itemId=inventory(next,id)[index],item=model.items[itemId];
    if(!Number.isInteger(index)||!item)throw Error('Objet invalide.');next.itemAction={owner:id,index,itemId};
    if(item.target==='opponent'||item.target==='player'){if(!targets(next).length)throw Error('Aucun adversaire disponible.');next.phase='item-target';return next;}
    next.phase='item-target';return consume(next,id);
  }
  function consume(state,target){
    if(!['item-target','item-random'].includes(state.phase))throw Error('Objet indisponible.');const next=ready(state),action=next.itemAction,item=model.items[action.itemId];
    if(usedItem(next)||inventory(next,action.owner)[action.index]!==action.itemId||!Number.isInteger(target)||(['opponent','player'].includes(item.target)?!targets(next).includes(target):target!==action.owner))throw Error('Cible invalide.');
    next.inventories[action.owner].splice(action.index,1);next.itemAction.target=target;next.itemUsedTurn=key(next);next.phase='item-animation';return next;
  }
  function randomTarget(state,random=Math.random){if(state.phase!=='item-target')throw Error('Aucune cible à choisir.');const next=ready(state),list=targets(next);if(!list.length)throw Error('Aucun adversaire.');next.itemAction.target=list[Math.floor(random()*list.length)];next.phase='item-random';return next;}
  function cancelItem(state){if(state.phase!=='item-target')throw Error('Choix indisponible.');const next=ready(state);delete next.itemAction;next.phase='turn';return next;}
  function finishItem(state){if(state.phase!=='item-animation')throw Error('Aucun objet en cours.');const next=ready(state);delete next.itemAction;next.phase='turn';return next;}
  function restore(raw,session){
    if(!raw)return null;try{const mapped=copy(raw);if(raw.phase.startsWith('gift-')){if(raw.phase==='gift-roll'){if(base.nodeAt(raw,session.board).type!=='loot')return null;mapped.phase='land';}else{const g=raw.gift;if(!['gift-replace','gift-delivery'].includes(raw.phase)||!g||!Number.isInteger(g.owner)||!session.players[g.owner]||!Object.hasOwn(model.items,g.itemId)||!['turn','choice','land-complete','star-reveal','moving'].includes(g.after))return null;mapped.phase=g.after==='moving'?'pass':g.after==='land-complete'?'land':g.after==='star-reveal'?'turn':g.after;}}if(phases.includes(mapped.phase))mapped.phase=mapped.phase.startsWith('shop-')?'pass':'turn';const checked=base.restore(mapped,session);if(!checked)return null;
      checked.inventories ||= session.players.map(()=>[]);
      if(checked.inventoryCaps!==undefined&&(!Array.isArray(checked.inventoryCaps)||checked.inventoryCaps.length!==session.players.length||checked.inventoryCaps.some(n=>!Number.isInteger(n)||n<1||n>4)))return null;
      if(!Array.isArray(checked.inventories)||checked.inventories.length!==session.players.length||checked.inventories.some((bag,id)=>!Array.isArray(bag)||bag.length>inventoryCapacity(checked,id)||bag.some(id=>!Object.hasOwn(model.items,id))))return null;
      if(raw.itemUsedTurn!==undefined&&typeof raw.itemUsedTurn!=='string')return null;
      if(raw.phase.startsWith('shop-')){if(base.nodeAt(checked,session.board).type!=='shop')return null;if(raw.phase==='shop-replace'&&(!Number.isInteger(raw.pendingOffer)||!offers(checked,session)[raw.pendingOffer]))return null;if(['shop-purchase','shop-sale'].includes(raw.phase)){const p=raw.phase==='shop-sale'?raw.sale:raw.purchase;if(!p||p.owner!==base.active(checked)||!model.items[p.itemId]||!Number.isSafeInteger(p.price)||p.price<0||!Array.isArray(p.before)||p.before.length!==session.players.length||p.before.some(w=>!w||!Number.isSafeInteger(w.ac)||w.ac<0||!Number.isSafeInteger(w.stars)||w.stars<0))return null;}}
      if(raw.phase.startsWith('item-')){const a=raw.itemAction;if(!a||a.owner!==base.active(checked)||!model.items[a.itemId]||!Number.isInteger(a.index)||a.index<0||a.index>=inventoryCapacity(checked,a.owner))return null;if(raw.phase!=='item-animation'&&inventory(checked,a.owner)[a.index]!==a.itemId)return null;if(raw.phase!=='item-target'&&(!Number.isInteger(a.target)||a.target<0||a.target>=session.players.length||(model.items[a.itemId].target==='opponent'?a.target===a.owner:model.items[a.itemId].target==='self'&&a.target!==a.owner)))return null;if(raw.phase==='item-animation'&&!usedItem(checked))return null;}
      return {...checked,phase:raw.phase};
    }catch{return null;}
  }
  window.PourtyBoardEngine=Object.freeze({...base,create,startEffect,restore,availableItems,giveItem,finishGift,inventory,inventoryCapacity,usedItem,itemTargets:targets,shopOffers:offers,saleOffers,openSale,cancelSale,sellItem,finishSale,buyItem:buy,declineItem:decline,leaveShop,finishPurchase,beginItem,consumeItem:consume,randomItemTarget:randomTarget,cancelItem,finishItem});
})();
