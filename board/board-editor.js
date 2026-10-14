(() => {
  'use strict';
  const model = window.PourtyBoardModel, library = window.PourtyBoardLibrary, $ = id => document.getElementById(id);
  let board = library.draft() || model.create(), selected = null, source = null, tool = 'select', addType = 'blue', pointer = null, walker = null;
  let undo = [], redo = [], draftSaved = true, decorMode=false, addDecor=null, terrainMode=false, paintTexture='grass';
  const selectedDecor=()=>board.decorations?.find(d=>'decor:'+d.id===selected);
  const svg = $('board-canvas'), canvas = new window.PourtyBoardCanvas(svg, view => { $('zoom-value').textContent = Math.round(view.scale * 100) + ' %'; });
  const typeButtons = [], say = text => { $('editor-message').textContent = text; };
  const selectedNode = () => board.nodes.find(node => node.id === selected);
  const snapshot = () => JSON.stringify(board);
  const free = value => Math.max(-20000,Math.min(20000,Math.round(value)));
  const snap = value => Math.max(-20000, Math.min(20000, $('snap-grid').checked ? Math.round(value / 40) * 40 : Math.round(value)));
  function saveDraft() { draftSaved = library.saveDraft(board); $('draft-state').textContent = draftSaved ? 'Brouillon enregistré dans ce navigateur' : 'Brouillon non sauvegardé'; if (!draftSaved) say('Stockage indisponible ou plein. Exporte un fichier pour conserver ton plateau.'); }
  function remember(before) { if (before === snapshot()) return; undo.push(before); if (undo.length > 80) undo.shift(); redo = []; saveDraft(); $('validation-results').replaceChildren(); }
  function stopPreview() { if (walker) { walker.stop(); walker = null; $('preview-controls').hidden = true; $('start-preview').disabled = false; canvas.fit(); } }
  function change(action) { stopPreview(); const before = snapshot(); action(); remember(before); render(); }
  function draw() { canvas.editDecorations=decorMode; canvas.render(board, selected, source); }
  function render() {
    draw(); $('street-enabled').checked=board.streetMarket?.enabled===true; $('street-settings').hidden=!board.streetMarket?.enabled;for(const [key,value]of Object.entries(board.streetMarket?.costs||{house:10,apartment:15,tower:30}))$('street-cost-'+key).value=value; $('treasure-enabled').checked=board.treasureEnabled===true; $('board-name').value = board.name; $('board-description').value = board.description; $('board-difficulty').value=model.difficulty(board);$('difficulty-preview').replaceChildren(model.difficultyArtwork(board));
    const plotNote=$('street-plot-note'),plotSelection=selected?.startsWith('decor:')?board.decorations.find(d=>d.id===selected.slice(6)&&d.type==='street-empty-plot'):null,plotLinks=model.streetPlots(board),linkedNode=plotSelection?board.nodes.find(n=>plotLinks[n.id]?.id===plotSelection.id):null;plotNote.hidden=!plotSelection;plotNote.textContent=linkedNode?'Associé à '+(linkedNode.label||'la case Terrain n° '+(board.nodes.indexOf(linkedNode)+1))+'.':'Place une case Événement · Terrain à proximité.';
    $('undo').disabled = !undo.length; $('redo').disabled = !redo.length;
    $('canvas-count').textContent = `${board.nodes.length} case${board.nodes.length > 1 ? 's' : ''} · ${board.edges.length} chemin${board.edges.length > 1 ? 's' : ''}`;
    inspect();renderItemPool();inspectDecor();for(const button of $('background-library').children)button.setAttribute('aria-pressed',String(button.dataset.background===(board.background||'plain')));
  }
  function inspect() {
    const node = selectedNode(), edge = selected?.startsWith('edge:') ? board.edges[Number(selected.slice(5))] : null;
    $('selection-empty').hidden = !!node || !!edge; $('node-properties').hidden = !node; $('edge-properties').hidden = !edge; $('delete-selection').hidden = !node && !edge;
    $('lucky-settings').hidden=node?.type!=='lucky-box';if(node?.type==='lucky-box')renderLucky(node);
    $('coaster-settings').hidden=node?.type!=='event'||node?.event!=='roller-coaster';if(node?.type==='event'&&node.event==='roller-coaster'){const select=$('coaster-target');select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Choisir une case d’arrivée…';select.append(empty);for(const other of board.nodes)if(other.id!==node.id){const option=document.createElement('option');option.value=other.id;option.textContent=(other.label||model.types[other.type].name)+' · ('+other.x+', '+other.y+')';select.append(option);}select.value=node.coasterTarget||'';}
    $('wheel-settings').hidden=node?.type!=='event'||node?.event!=='ferris-wheel';if(node?.type==='event'&&node.event==='ferris-wheel'){const select=$('wheel-target');select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Sortie uniquement (pas de trajet au départ)';select.append(empty);for(const other of board.nodes)if(other.id!==node.id&&other.type==='event'&&other.event==='ferris-wheel'){const option=document.createElement('option');option.value=other.id;option.textContent=(other.label||'Grande roue')+' · ('+other.x+', '+other.y+')';select.append(option);}select.value=node.wheelTarget||'';}
    $('port-settings').hidden=node?.type!=='port';if(node?.type==='port'){const select=$('port-target');select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Choisir un port…';select.append(empty);board.nodes.forEach((other,index)=>{if(other.type!=='port'||other.id===node.id)return;const option=document.createElement('option');option.value=other.id;option.textContent=(index+1)+'. '+(other.label||'Port')+' · ('+other.x+', '+other.y+')';select.append(option);});select.value=node.portTarget||'';}
    $('event-settings').hidden=node?.type!=='event';if(node?.type==='event')$('node-event').value=node.event||'';
    $('fishing-settings').hidden=node?.type!=='event'||node?.event!=='fishing-items';if(node?.type==='event'&&node.event==='fishing-items')renderFishing(node);
    $('shop-settings').hidden=node?.type!=='shop';if(node?.type==='shop')renderShop(node);
    if (node) {
      $('node-type').value = node.type; $('node-label').value = node.label; $('node-x').value = node.x; $('node-y').value = node.y;
      $('node-trigger').textContent = model.types[node.type].countsAsStep ? 'À l’arrivée · compte pour un pas' : 'Au passage · ne consomme pas de pas';
      $('set-start').disabled = !model.types[node.type].countsAsStep || node.id === board.startId; $('set-start').textContent = node.id === board.startId ? 'Case de départ' : 'Définir comme départ';
      $('node-routes').replaceChildren();
      board.edges.forEach((edge, index) => { if (edge.from !== node.id) return; const to = board.nodes.find(n => n.id === edge.to); const row = document.createElement('div'); row.className = 'route-row'; const text = document.createElement('span'); text.textContent = `→ ${board.nodes.indexOf(to) + 1}. ${to.label || model.types[to.type].name}`; const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Supprimer ce chemin'); remove.addEventListener('click', () => change(() => { board.edges.splice(index, 1); })); row.append(text, remove); $('node-routes').append(row); });
    }
    if (edge) $('edge-name').textContent = `Chemin ${board.nodes.findIndex(n => n.id === edge.from) + 1} → ${board.nodes.findIndex(n => n.id === edge.to) + 1}`;
  }

  function renderLucky(node){
    const root=$('lucky-items');root.replaceChildren();model.normalizeLuckyItems(node.luckyItems).forEach((id,index)=>{const row=document.createElement('label');row.className='shop-editor-row';const img=document.createElement('img');model.itemImage(img,id);img.alt='';const select=document.createElement('select');select.setAttribute('aria-label','Objet Lucky box '+(index+1));for(const [key,item]of Object.entries(model.items)){const option=document.createElement('option');option.value=key;option.textContent=item.name;select.append(option);}select.value=id;select.addEventListener('change',()=>change(()=>{node.luckyItems=model.normalizeLuckyItems(node.luckyItems);node.luckyItems[index]=select.value;}));const remove=document.createElement('button');remove.type='button';remove.textContent='−';remove.setAttribute('aria-label','Retirer '+model.items[id].name);remove.addEventListener('click',e=>{e.preventDefault();change(()=>{node.luckyItems=model.normalizeLuckyItems(node.luckyItems);node.luckyItems.splice(index,1);});});row.append(img,select,remove);root.append(row);});
    const add=document.createElement('button');add.type='button';add.textContent='+ Ajouter un objet';add.addEventListener('click',()=>change(()=>{node.luckyItems=model.normalizeLuckyItems(node.luckyItems);node.luckyItems.push('pipe');}));root.append(add);
    const select=$('lucky-copy-source'),previous=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Choisir une Lucky box…';select.append(empty);for(const other of board.nodes)if(other.type==='lucky-box'&&other.id!==node.id){const option=document.createElement('option');option.value=other.id;option.textContent=(other.label||'Lucky box')+' · ('+other.x+', '+other.y+')';select.append(option);}select.value=previous;$('lucky-copy').disabled=!select.value;
  }
  $('lucky-copy-source').addEventListener('change',()=>{$('lucky-copy').disabled=!$('lucky-copy-source').value;});
  $('lucky-copy').addEventListener('click',()=>{const node=selectedNode(),source=board.nodes.find(n=>n.id===$('lucky-copy-source').value);if(node?.type==='lucky-box'&&source?.type==='lucky-box')change(()=>{node.luckyItems=model.normalizeLuckyItems(source.luckyItems);});});
  $('coaster-target').addEventListener('change',()=>{const node=selectedNode();if(node?.event==='roller-coaster')change(()=>{node.coasterTarget=$('coaster-target').value||null;});});
  $('wheel-target').addEventListener('change',()=>{const node=selectedNode(),target=$('wheel-target').value;if(node?.event!=='ferris-wheel')return;change(()=>{node.wheelTarget=target||null;});});
  let renderedPool=null;
  function renderItemPool(){const key=JSON.stringify(board.itemPool);if(key===renderedPool)return;renderedPool=key;const pool=model.normalizeItemPool(board.itemPool);for(const phase of ['early','late']){const root=$('item-pool-'+phase);root.replaceChildren();for(const [id,item] of Object.entries(model.items)){const label=document.createElement('label');label.className='item-pool-option';label.title=item.description;const check=document.createElement('input');check.type='checkbox';check.checked=pool[phase].includes(id);check.addEventListener('change',()=>change(()=>{board.itemPool=model.normalizeItemPool(board.itemPool);board.itemPool[phase]=check.checked?[...board.itemPool[phase],id]:board.itemPool[phase].filter(x=>x!==id);}));const image=document.createElement('img');model.itemImage(image,id);image.alt='';label.append(check,image,document.createTextNode(item.name));root.append(label);}}}
  function renderFishing(node){
    const list=model.normalizeFishingItems(node.fishingItems),root=$('fishing-items');root.replaceChildren();
    list.forEach((id,index)=>{const row=document.createElement('label');row.className='shop-editor-row';const icon=document.createElement('img');model.itemImage(icon,id);icon.alt='';const select=document.createElement('select');select.setAttribute('aria-label','Objet de pêche '+(index+1));for(const [key,item]of Object.entries(model.items)){const o=document.createElement('option');o.value=key;o.textContent=item.name;select.append(o);}select.value=id;select.addEventListener('change',()=>change(()=>{node.fishingItems=model.normalizeFishingItems(node.fishingItems);node.fishingItems[index]=select.value;}));row.append(icon,select);root.append(row);});
    const select=$('fishing-copy-source'),previous=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Choisir un coin de pêche…';select.append(empty);const sources=board.nodes.filter(n=>n.id!==node.id&&n.type==='event'&&n.event==='fishing-items');for(const source of sources){const option=document.createElement('option');option.value=source.id;option.textContent=(source.label||'Pêche aux objets')+' · ('+source.x+', '+source.y+')';select.append(option);}select.value=sources.some(n=>n.id===previous)?previous:'';select.disabled=!sources.length;$('fishing-copy').disabled=!select.value;
  }
  $('fishing-copy-source').addEventListener('change',()=>{$('fishing-copy').disabled=!$('fishing-copy-source').value;});
  $('fishing-copy').addEventListener('click',()=>{const node=selectedNode(),source=board.nodes.find(n=>n.id===$('fishing-copy-source').value&&n.event==='fishing-items');if(node?.event!=='fishing-items'||!source||node===source)return;change(()=>{node.fishingItems=model.normalizeFishingItems(source.fishingItems);});say('Les cinq objets ont été copiés.');});
  function renderShop(node){
    const stock=model.normalizeShop(node.shop);
    const sources=board.nodes.filter(other=>other.type==='shop'&&other.id!==node.id);
    const sourceSelect=$('shop-copy-source'),previous=sourceSelect.value;sourceSelect.replaceChildren();
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=sources.length?'Choisir un shop…':'Aucun autre shop';sourceSelect.append(placeholder);
    sources.forEach(other=>{const option=document.createElement('option');option.value=other.id;option.textContent=(other.label||'Shop')+' · ('+other.x+', '+other.y+')';sourceSelect.append(option);});
    sourceSelect.value=sources.some(other=>other.id===previous)?previous:'';
    sourceSelect.disabled=!sources.length;$('shop-copy').disabled=!sourceSelect.value;
    for(const phase of ['early','late']){
      const root=$('shop-'+phase);root.replaceChildren();
      const update=action=>change(()=>{node.shop=model.normalizeShop(node.shop);action(node.shop[phase]);});
      stock[phase].forEach((offer,index)=>{const row=document.createElement('div');row.className='shop-editor-row';const icon=document.createElement('img');model.itemImage(icon,offer.itemId);icon.alt='';const select=document.createElement('select');for(const [id,item]of Object.entries(model.items)){const option=document.createElement('option');option.value=id;option.textContent=item.name;select.append(option);}select.value=offer.itemId;select.setAttribute('aria-label','Objet');select.addEventListener('change',()=>update(list=>list[index].itemId=select.value));const price=document.createElement('input');price.type='number';price.min='0';price.step='1';price.value=offer.price;price.setAttribute('aria-label','Prix en AC');price.addEventListener('change',()=>{const value=Number(price.value);if(price.value===''||!Number.isSafeInteger(value)||value<0){say('Le prix doit être un nombre entier positif ou nul.');inspect();return;}update(list=>list[index].price=value);});const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Retirer cet objet');remove.addEventListener('click',()=>update(list=>list.splice(index,1)));row.append(icon,select,price,remove);root.append(row);});
      const add=document.createElement('button');add.type='button';add.textContent='+ Ajouter un objet';add.addEventListener('click',()=>update(list=>list.push({itemId:Object.keys(model.items)[0],price:5})));root.append(add);
    }
  }
  $('shop-copy-source').addEventListener('change',()=>{$('shop-copy').disabled=!$('shop-copy-source').value;});
  $('shop-copy').addEventListener('click',()=>{
    const target=selectedNode(),from=board.nodes.find(node=>node.id===$('shop-copy-source').value&&node.type==='shop');
    if(!target||target.type!=='shop'||!from||target.id===from.id)return;
    change(()=>{target.shop=model.normalizeShop(from.shop);});
    say('Objets et prix copiés pour les shops early et late.');
  });
  function selectTool(next, type = addType) {
    stopPreview(); tool = next; addType = type; source = null; svg.querySelector('.terrain-cursor')?.setAttribute('visibility','hidden');
    for (const key of ['select', 'link', 'pan']) $('tool-' + key).setAttribute('aria-pressed', String(tool === key));
    document.querySelectorAll('[data-decor-type]').forEach(button=>button.setAttribute('aria-pressed',String(tool==='decor'&&button.dataset.decorType===addDecor)));
    typeButtons.forEach(button => button.setAttribute('aria-pressed', String(tool === 'add' && button.dataset.type === type)));
    const help = { paint: 'Glisse pour peindre le terrain. Clic molette : déplacer la vue. Échap : sélection.', decor: 'Clique sur le plateau pour placer ce décor. Échap : sélection.', select: 'Glisse une case pour la déplacer. Glisse le fond pour déplacer la vue. Suppr : supprimer.', add: `${model.types[type].name} : clique sur le plateau pour placer une case. Échap : sélection.`, link: 'Clique sur la case de départ du chemin, puis sur sa destination. Répète pour créer un embranchement.', pan: 'Glisse pour déplacer la vue. Molette : zoom.' };
    $('terrain-erase').setAttribute('aria-pressed',String(tool==='paint'&&paintTexture==='erase'));for(const b of $('terrain-library').children)b.setAttribute('aria-pressed',String(tool==='paint'&&b.dataset.texture===paintTexture));
    $('tool-help').textContent = help[tool]; svg.style.cursor = tool === 'pan' ? 'grab' : ['add','paint'].includes(tool) ? 'crosshair' : 'default'; draw();
  }
  const passageGroups=[
    {name:'Toutes les maps',keys:['boo','shop','star'],common:true},
    {name:'Papazino',keys:['slots']},
    {name:'Abouba-Islands',keys:['port']},
    {name:'Parc d’attraction',keys:['lucky-box','zipline']},
    {name:'Aboubastreet',keys:['street-investment','street-bull','street-bear','street-black']}
  ];
  const passageTargets=new Map();
  for(const group of passageGroups){
    const section=document.createElement(group.common?'div':'details');section.className='passage-group';
    const heading=document.createElement(group.common?'h3':'summary');heading.textContent=group.name;section.append(heading);
    const grid=document.createElement('div');grid.className='type-grid passage-grid';section.append(grid);$('pass-types').append(section);
    for(const key of group.keys)passageTargets.set(key,grid);
    if(!group.common)section.addEventListener('toggle',()=>{if(section.open&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)grid.animate?.([{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});});
  }
  Object.entries(model.types).forEach(([key, type]) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.type = key; button.setAttribute('aria-pressed', 'false');
    const dot = document.createElement('span'); dot.className = 'type-dot' + (type.trigger === 'pass' ? ' pass' : ''); dot.append(model.spaceIcon(key)); dot.setAttribute('aria-hidden', 'true');
    const label=document.createElement('span');label.className='type-name';label.textContent=type.name;button.append(dot,label); button.addEventListener('click', () => selectTool('add', key)); (type.trigger==='land'?$('landing-types'):(passageTargets.get(key)||$('pass-types'))).append(button); typeButtons.push(button);
    const option = document.createElement('option'); option.value = key; option.textContent = type.name; $('node-type').append(option);
  });
  for (const name of ['select', 'link', 'pan']) $('tool-' + name).addEventListener('click', () => selectTool(name));
  function linkTo(id) {
    if (!source) { source = id; selected = id; say('Clique maintenant sur la destination.'); render(); return; }
    if (source === id) { source = null; draw(); return; }
    if (board.edges.length >= 3998) { say('Limite de chemins atteinte.'); return; }
    const from = source;
    change(() => { if (!board.edges.some(e => e.from === from && e.to === id)) board.edges.push({ from, to: id }); if ($('bidirectional').checked && !board.edges.some(e => e.from === id && e.to === from)) board.edges.push({ from: id, to: from }); source = null; selected = id; });
    say('Chemin ajouté. Choisis une nouvelle origine pour continuer.');
  }
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.button !== 1 || walker || pointer) return;
    event.preventDefault(); svg.focus(); const nodeElement = event.target.closest('[data-node]'), edgeElement = event.target.closest('[data-edge]');
    const p = canvas.point(event.clientX, event.clientY), node = nodeElement && board.nodes.find(n => n.id === nodeElement.dataset.node);
    if (event.button === 1 || tool === 'pan') pointer = { mode: 'pan', x: event.clientX, y: event.clientY, view: { ...canvas.view } };
    else if(tool==='paint') {if((board.terrain||[]).length>=500||(board.terrain||[]).reduce((n,s)=>n+s.points.length,0)>=50000){say('Limite de peinture atteinte. Annule un trait pour continuer.');return;}selected=null;source=null;pointer={mode:'paint',before:snapshot(),stroke:{texture:paintTexture,layer:$('terrain-layer').value,size:Number($('terrain-size').value),points:[[free(p.x),free(p.y)]]}};(board.terrain??=[]).push(pointer.stroke);pointer.total=board.terrain.reduce((n,s)=>n+s.points.length,0);draw();}
    else if(tool==='decor') {if((board.decorations||[]).length>=1000){say('1 000 décors maximum.');return;}change(()=>{const d={id:model.id('decor'),type:addDecor,x:free(p.x),y:free(p.y),size:model.decorations[addDecor].size,rotation:0};(board.decorations??=[]).push(d);selected='decor:'+d.id;});return;}
    else if(decorMode&&event.target.closest('[data-decor]')) {const d=board.decorations.find(d=>d.id===event.target.closest('[data-decor]').dataset.decor);selected='decor:'+d.id;pointer={mode:'decor',id:d.id,x:p.x,y:p.y,originalX:d.x,originalY:d.y,before:snapshot()};render();}
    else if (tool === 'link' && node) { linkTo(node.id); return; }
    else if (node && !decorMode) { selected = node.id; pointer = { mode: 'node', id: node.id, x: p.x, y: p.y, originalX: node.x, originalY: node.y, before: snapshot() }; render(); }
    else if (edgeElement && tool === 'select' && !decorMode) { selected = 'edge:' + edgeElement.dataset.edge; render(); return; }
    else if (tool === 'add') {
      if (board.nodes.length >= 1000) { say('1 000 cases maximum.'); return; }
      change(() => { const type = model.types[addType]; const node = { id: model.id('node'), x: snap(p.x), y: snap(p.y), type: addType, label: '', trigger: type.trigger, countsAsStep: type.countsAsStep }; board.nodes.push(node); selected = node.id; if (!board.startId && type.countsAsStep) board.startId = node.id; }); return;
    } else { selected = null; source = null; pointer = { mode: 'pan', x: event.clientX, y: event.clientY, view: { ...canvas.view } }; render(); }
    pointer.pointerId = event.pointerId; svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', event => {
    showBrush(event);if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (pointer.mode === 'pan') { canvas.view.x = pointer.view.x + event.clientX - pointer.x; canvas.view.y = pointer.view.y + event.clientY - pointer.y; canvas.apply(); }
    else if(pointer.mode==='paint'){const p=canvas.point(event.clientX,event.clientY),point=[free(p.x),free(p.y)],last=pointer.stroke.points.at(-1);if(Math.hypot(point[0]-last[0],point[1]-last[1])>=Math.max(2,pointer.stroke.size/25)&&pointer.total<50000){pointer.stroke.points.push(point);pointer.total++;canvas.updateTerrain();}}
    else { const node = (pointer.mode==='decor'?board.decorations:board.nodes).find(n => n.id === pointer.id), p = canvas.point(event.clientX, event.clientY); const align=pointer.mode==='decor'?free:snap; node.x = align(pointer.originalX + p.x - pointer.x); node.y = align(pointer.originalY + p.y - pointer.y); canvas.moveElement(pointer.id,pointer.mode==='decor'); $(pointer.mode==='decor'?'decor-x':'node-x').value = node.x; $(pointer.mode==='decor'?'decor-y':'node-y').value = node.y; }
  });
  function finishPointer(event) { if (!pointer || pointer.pointerId !== event.pointerId) return; if (pointer.mode === 'node' || pointer.mode==='decor' || pointer.mode==='paint') { if (event.type === 'pointercancel') board = JSON.parse(pointer.before); else remember(pointer.before); } const id = pointer.pointerId; pointer = null; if (svg.hasPointerCapture(id)) svg.releasePointerCapture(id); render(); }
  svg.addEventListener('pointerup', finishPointer); svg.addEventListener('pointercancel', finishPointer); svg.addEventListener('lostpointercapture', finishPointer);
  svg.addEventListener('keydown', event => { if (event.key !== 'Enter' && event.key !== ' ') return; const target = event.target.closest('[data-node],[data-edge]'); if (!target || walker) return; event.preventDefault(); if (target.dataset.node) { if (tool === 'link') linkTo(target.dataset.node); else { selected = target.dataset.node; render(); } } else { selected = 'edge:' + target.dataset.edge; render(); } });
  function removeSelection() { if (!selected) return; change(() => { if(selectedDecor()){board.decorations=board.decorations.filter(d=>'decor:'+d.id!==selected);} else if (selectedNode()) { board.nodes = board.nodes.filter(n => n.id !== selected); board.edges = board.edges.filter(e => e.from !== selected && e.to !== selected); if (board.startId === selected) board.startId = null; } else if (selected.startsWith('edge:')) board.edges.splice(Number(selected.slice(5)), 1); selected = null; source = null; }); }
  $('delete-selection').addEventListener('click', removeSelection);
  $('board-name').addEventListener('change', () => { const name = $('board-name').value.trim(); if (!name) { $('board-name').value = board.name; say('Le nom ne peut pas être vide.'); return; } change(() => { board.name = name.slice(0, 80); }); });
  $('board-difficulty').addEventListener('change',()=>change(()=>{board.difficulty=Number($('board-difficulty').value);}));
  $('board-description').addEventListener('change', () => change(() => { board.description = $('board-description').value.slice(0, 300); }));
  $('street-enabled').addEventListener('change',()=>change(()=>{board.streetMarket||={costs:{house:10,apartment:15,tower:30}};board.streetMarket.enabled=$('street-enabled').checked;}));
  for(const key of ['house','apartment','tower'])$('street-cost-'+key).addEventListener('change',()=>change(()=>{board.streetMarket||={enabled:false,costs:{house:10,apartment:15,tower:30}};board.streetMarket.costs[key]=Math.max(0,Math.min(99999,Math.round(Number($('street-cost-'+key).value)||0)));}));
  $('treasure-enabled').addEventListener('change',()=>change(()=>{board.treasureEnabled=$('treasure-enabled').checked;}));
  $('port-target').addEventListener('change',()=>{if(selectedNode()?.type==='port')change(()=>{selectedNode().portTarget=$('port-target').value||null;});});
  $('node-event').addEventListener('change',()=>{if(selectedNode()?.type==='event')change(()=>{selectedNode().event=$('node-event').value||null;});});
  $('node-type').addEventListener('change', () => { const value = $('node-type').value; if (!selectedNode()) return; change(() => { const node = selectedNode(); node.type = value; node.trigger = model.types[value].trigger; node.countsAsStep = model.types[value].countsAsStep; if (!node.countsAsStep && board.startId === node.id) board.startId = null; }); });
  $('node-label').addEventListener('change', () => { if (selectedNode()) change(() => { selectedNode().label = $('node-label').value.slice(0, 60); }); });
  for (const coordinate of ['x', 'y']) $('node-' + coordinate).addEventListener('change', () => { const raw = $('node-' + coordinate).value, value = Number(raw); if (!raw || !Number.isFinite(value) || Math.abs(value) > 20000) { say('Coordonnée attendue entre −20 000 et 20 000.'); inspect(); return; } if (selectedNode()) change(() => { selectedNode()[coordinate] = Math.round(value); }); });
  $('set-start').addEventListener('click', () => { const node = selectedNode(); if (node && model.types[node.type].countsAsStep) change(() => { board.startId = node.id; }); });
  function history(back) { const from = back ? undo : redo, to = back ? redo : undo; if (!from.length) return; stopPreview(); to.push(snapshot()); board = JSON.parse(from.pop()); selected = null; source = null; saveDraft(); render(); }
  $('undo').addEventListener('click', () => history(true)); $('redo').addEventListener('click', () => history(false));
  window.addEventListener('keydown', event => {
    if (event.target.closest('input,textarea,select') || pointer) return;
    if ((event.ctrlKey || event.metaKey) && ['z','y'].includes(event.key.toLowerCase())) { event.preventDefault(); history(event.key.toLowerCase() === 'z' && !event.shiftKey); }
    else if (event.key === 'Delete' || event.key === 'Backspace') { if (selected) { event.preventDefault(); removeSelection(); } }
    else if (event.key === 'Escape') selectTool('select');
    else if ((selectedNode()||selectedDecor()) && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) && !walker) { event.preventDefault(); const delta = selectedDecor() ? (event.shiftKey ? 10 : 1) : (event.shiftKey ? 1 : 40); change(() => { const node = selectedNode()||selectedDecor(); if (event.key === 'ArrowLeft') node.x -= delta; if (event.key === 'ArrowRight') node.x += delta; if (event.key === 'ArrowUp') node.y -= delta; if (event.key === 'ArrowDown') node.y += delta; node.x = Math.max(-20000,Math.min(20000,node.x)); node.y = Math.max(-20000,Math.min(20000,node.y)); }); }
  });
  $('zoom-in').addEventListener('click', () => canvas.zoom(1.25)); $('zoom-out').addEventListener('click', () => canvas.zoom(.8)); $('fit').addEventListener('click', () => canvas.fit());
  function refreshLibrary() { const select = $('library-select'); select.replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Ouvrir un plateau…'; select.append(empty); library.all().forEach(item => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option); }); }
  function load(next) { stopPreview(); const before = snapshot(); board = model.normalize(next); selected = null; source = null; remember(before); render(); canvas.fit(); }
  $('library-select').addEventListener('change', () => { const next = library.all().find(item => item.id === $('library-select').value); if (!next) return; if ((board.nodes.length||board.decorations?.length||board.terrain?.length) && !confirm('Ouvrir ce plateau ? Le brouillon actuel restera accessible avec Annuler.')) { $('library-select').value = ''; return; } load(next); });
  $('new-board').addEventListener('click', () => { if ((board.nodes.length||board.decorations?.length||board.terrain?.length) && !confirm('Créer un nouveau plateau ? Tu peux récupérer le précédent avec Annuler.')) return; load(model.create()); });
  $('duplicate-board').addEventListener('click', () => { const copy = model.clone(board); copy.id = model.id('board'); copy.name = (copy.name + ' (copie)').slice(0,80); load(copy); say('Copie créée.'); });
  function saveCurrent() { try { board = model.normalize(board); library.saveMany([board]); saveDraft(); refreshLibrary(); say('Plateau enregistré dans ce navigateur. Exporte les plateaux pour obtenir le fichier permanent.'); return true; } catch (error) { say(error.message); return false; } }
  $('save-board').addEventListener('click', saveCurrent);
  $('delete-board').addEventListener('click',()=>{
    if(!confirm('Supprimer « '+board.name+' » ? Pour retirer ce plateau du fichier permanent, exporte ensuite les plateaux (.js) et remplace assets/plateaux/plateaux.js.'))return;
    try {
      library.remove(board.id);stopPreview();
      board=library.all()[0]||model.create();selected=null;source=null;undo=[];redo=[];
      saveDraft();refreshLibrary();render();canvas.fit();
      say('Plateau supprimé. Exporte les plateaux (.js) pour mettre à jour le fichier permanent.');
    } catch(error){say(error.message);}
  });
  function download(name, text, mime) { const url = URL.createObjectURL(new Blob([text], { type: mime })); const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000); }
  const filename = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'plateau';
  $('export-json').addEventListener('click', () => { try { const clean = model.assertEventsConfigured(model.normalize(board)); download(filename(board.name) + '.json', JSON.stringify(clean, null, 2), 'application/json'); say('Fichier JSON exporté.'); } catch (error) { say(error.message); } });
  $('export-catalog').addEventListener('click', () => {
    try { const current = model.normalize(board), all = new Map(library.all().map(item => [item.id, item])); if(current.nodes.length||current.decorations?.length||current.terrain?.length||all.has(current.id)||current.name!=='Nouveau plateau'||current.description)all.set(current.id, current); download('plateaux.js', library.catalogText([...all.values()]), 'text/javascript'); const invalid = [...all.values()].filter(item => model.issues(item).errors.length).length; say(`Fichier exporté : place plateaux.js dans assets/plateaux/.${invalid ? ` ${invalid} plateau(x) incomplet(s) conservé(s), masqué(s) dans le menu de jeu.` : ''}`); }
    catch (error) { say(error.message); }
  });
  $('import-board').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async () => {
    const file = $('import-file').files[0]; if (!file) return;
    try {
      if (file.size > 10000000) throw Error('Fichier trop volumineux (10 Mo maximum).');
      const imported = model.parse(await file.text()); if (!imported.length) throw Error('Ce fichier ne contient aucun plateau.');
      const existing = new Set(library.all().map(item => item.id));
      if (imported.some(item => existing.has(item.id)) && !confirm('Remplacer les plateaux de même identifiant dans cette bibliothèque ?')) return;
      library.saveMany(imported); load(imported[0]); refreshLibrary(); say(`${imported.length} plateau(x) importé(s).`);
    } catch (error) { say('Import impossible : ' + error.message); }
    finally { $('import-file').value = ''; }
  });
  function validate() {
    const result = model.issues(board), root = $('validation-results'); root.replaceChildren();
    if (!result.errors.length) { const p = document.createElement('p'); p.className = 'validation-ok'; p.textContent = 'Parcours valide.'; root.append(p); }
    else { const ul = document.createElement('ul'); ul.className = 'validation-list'; result.errors.forEach(text => { const li = document.createElement('li'); li.textContent = text; ul.append(li); }); root.append(ul); }
    result.warnings.forEach(text => { const p = document.createElement('p'); p.className = 'validation-warning'; p.textContent = text; root.append(p); }); return result;
  }
  $('validate-board').addEventListener('click', validate);
  $('start-preview').addEventListener('click',()=>{
    if(validate().errors.length){say('Corrige les erreurs avant de tester le plateau.');return;}
    saveDraft();if(!draftSaved)return;
    try{location.href=window.PourtyBoardTest.launch(board);}catch(error){say('Test impossible : '+error.message);}
  });
  $('stop-preview').addEventListener('click', () => { stopPreview(); render(); });
  window.addEventListener('beforeunload', event => { if (!draftSaved && (board.nodes.length||board.decorations?.length||board.terrain?.length)) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', () => { if (walker) walker.stop(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { stopPreview(); render(); } });

  function inspectDecor(){const d=selectedDecor();$('decor-properties').hidden=!d;if(!d)return;$('selection-empty').hidden=true;$('delete-selection').hidden=false;$('decor-name').textContent=model.decorations[d.type].name;for(const k of ['x','y','size','rotation'])$('decor-'+k).value=d[k];$('decor-size-value').textContent=Math.round(d.size)+' px';$('decor-rotation-value').textContent=d.rotation+'°';}
  function palette(mode){terrainMode=mode==='terrain';decorMode=mode===true;$('asset-pack-control').hidden=!terrainMode&&!decorMode;addDecor=null;selected=null;for(const [id,on]of [['spaces',!terrainMode&&!decorMode],['decor',decorMode],['terrain',terrainMode]]){$('tab-'+id).setAttribute('aria-pressed',String(on));$(id==='spaces'?'space-palette':id+'-palette').hidden=!on;}selectTool(terrainMode?'paint':'select');render();const panel=$(terrainMode?'terrain-palette':decorMode?'decor-palette':'space-palette');panel.animate?.([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});}
  $('tab-spaces').addEventListener('click',()=>palette(false));$('tab-decor').addEventListener('click',()=>palette(true));
  for(const [id,def]of Object.entries(model.decorations)){const button=document.createElement('button');button.type='button';button.dataset.decorType=id;button.dataset.pack=def.pack||'classic';button.setAttribute('aria-pressed','false');const image=document.createElement('img');image.src='../assets/decors/'+id+'.svg';image.alt='';const label=document.createElement('span');label.textContent=def.name;button.append(image,label);button.addEventListener('click',()=>{addDecor=id;selectTool('decor');});$('decor-library').append(button);}
  for(const key of ['x','y','size','rotation']){const input=$('decor-'+key);input.addEventListener('change',()=>{const value=Number(input.value),min=Number(input.min),max=Number(input.max);if(!selectedDecor()||input.value===''||!Number.isFinite(value)||value<min||value>max){inspectDecor();return;}change(()=>selectedDecor()[key]=value);});}
  for(const key of ['size','rotation']){const input=$('decor-'+key);let before=null;
    input.addEventListener('input',()=>{const d=selectedDecor();if(!d)return;before??=snapshot();d[key]=Number(input.value);draw();inspectDecor();});
    input.addEventListener('change',()=>{if(before!==null){remember(before);before=null;render();}});
  }
  $('decor-duplicate').addEventListener('click',()=>{const d=selectedDecor();if(!d||board.decorations.length>=1000)return;change(()=>{const copy={...d,id:model.id('decor'),x:free(d.x+40),y:free(d.y+40)};board.decorations.push(copy);selected='decor:'+copy.id;});});
  for(const direction of ['back','front'])$('decor-'+direction).addEventListener('click',()=>{const d=selectedDecor();if(!d)return;change(()=>{board.decorations=board.decorations.filter(other=>other!==d);board.decorations[direction==='back'?'unshift':'push'](d);});});
  svg.addEventListener('keydown',event=>{if(!decorMode||walker||!['Enter',' '].includes(event.key))return;const d=event.target.closest('[data-decor]');if(d){event.preventDefault();selected='decor:'+d.dataset.decor;render();}});
  for(const [key,def]of Object.entries(model.backgrounds)){const button=document.createElement('button');button.type='button';button.dataset.background=key;button.dataset.pack=def.pack||'classic';button.textContent=def.name;button.style.backgroundColor=def.color;if(key!=='plain')button.style.backgroundImage='linear-gradient(#0b152c22,#0b152c99),url("../assets/backgrounds/'+key+(def.raster?'.png':'.svg')+'")';button.addEventListener('click',()=>change(()=>{board.background=key;}));$('background-library').append(button);}
  $('tab-terrain').addEventListener('click',()=>palette('terrain'));
  for(const [id,texture]of Object.entries(model.terrainTextures)){const b=document.createElement('button');b.type='button';b.dataset.texture=id;b.dataset.pack=texture.pack||'classic';b.textContent=texture.name;b.style.backgroundImage='linear-gradient(#0001,#0005),url("../assets/terrain/'+id+'.png")';b.addEventListener('click',()=>{paintTexture=id;selectTool('paint');});$('terrain-library').append(b);}
  $('terrain-erase').addEventListener('click',()=>{paintTexture='erase';selectTool('paint');});$('terrain-size').addEventListener('input',()=>{$('terrain-size-value').textContent=$('terrain-size').value+' px';});
  const brush=document.createElementNS('http://www.w3.org/2000/svg','circle');brush.setAttribute('class','terrain-cursor');brush.setAttribute('fill','#ffffff08');brush.setAttribute('stroke','#e4edff');brush.setAttribute('stroke-width','1.5');brush.setAttribute('stroke-dasharray','5 4');brush.setAttribute('visibility','hidden');svg.append(brush);
  function showBrush(event){const active=tool==='paint'&&!walker;brush.setAttribute('visibility',active?'visible':'hidden');if(!active)return;const r=svg.getBoundingClientRect();brush.setAttribute('cx',event.clientX-r.left);brush.setAttribute('cy',event.clientY-r.top);brush.setAttribute('r',Number($('terrain-size').value)*canvas.view.scale/2);}
  svg.addEventListener('pointerleave',()=>brush.setAttribute('visibility','hidden'));
  $('asset-pack').addEventListener('change',()=>{
    const pack=$('asset-pack').value;
    for(const id of ['decor-library','terrain-library','background-library']){
      const root=$(id);for(const button of root.children)button.hidden=pack!=='all'&&button.dataset.pack!==pack;
      root.animate?.([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'ease-out'});
    }
    // Do not leave an invisible brush or decoration active after changing packs.
    if(terrainMode){const visible=[...$('terrain-library').children].find(b=>!b.hidden);if(visible){paintTexture=visible.dataset.texture;selectTool('paint');}}
    else if(decorMode){addDecor=null;selectTool('select');}
  });
  window.PourtyShopComparison.mount({button:$('shop-compare'),getBoard:()=>board,library,model});
  refreshLibrary(); render(); canvas.fit();
})();

