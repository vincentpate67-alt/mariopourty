(() => {
  const ns = 'http://www.w3.org/2000/svg', model = window.PourtyBoardModel;
  function el(tag, attributes = {}, text) { const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); if (text !== undefined) node.textContent = text; return node; }
  const PaintedTerrain=window.PourtyRaster.Layer;
  class BoardCanvas {
    constructor(svg, onView = () => {}) {
      this.svg = svg; this.onView = onView; this.view = { x: 0, y: 0, scale: 1 }; this.board = model.create(); this.zoomEnabled = true;
      const defs = el('defs'), marker = el('marker', { id: 'route-arrow', markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: 'auto', markerUnits: 'userSpaceOnUse' }); marker.append(el('path', { d: 'M0 0L8 4L0 8Z', fill: '#a8b8df' })); defs.append(marker); const choiceMarker=el('marker',{id:'choice-arrow',markerWidth:13,markerHeight:13,refX:11,refY:6.5,orient:'auto',markerUnits:'userSpaceOnUse'});choiceMarker.append(el('path',{d:'M0 0L13 6.5L0 13Z',fill:'#ff6476'}));defs.append(choiceMarker);
      this.scene=el('g',{'data-board-scene':''});this.world = el('g');this.scene.append(this.world);this.svg.append(defs,this.scene);
      this.svg.addEventListener('wheel', event => { event.preventDefault(); if (!this.zoomEnabled) return; this.zoom(Math.exp(-event.deltaY * .0015), event.clientX, event.clientY); }, { passive: false });
      this.resize = new ResizeObserver(() => {this.viewport=null;this.apply();}); this.resize.observe(svg);
    }
    apply() { this.viewport??=this.svg.getBoundingClientRect();this.scene.setAttribute('transform', `translate(${this.view.x} ${this.view.y}) scale(${this.view.scale})`); model.applyBackground(this.svg,this.board,this.view,this.scene,this.viewport); this.cullDecorations(); this.updateTerrainView(); this.onView(this.view); }
    point(clientX, clientY) { const rect = this.svg.getBoundingClientRect(); return { x: (clientX - rect.left - this.view.x) / this.view.scale, y: (clientY - rect.top - this.view.y) / this.view.scale }; }
    zoom(factor, clientX, clientY) {
      const rect = this.svg.getBoundingClientRect(); clientX ??= rect.left + rect.width / 2; clientY ??= rect.top + rect.height / 2;
      const p = this.point(clientX, clientY); this.view.scale = Math.max(.1, Math.min(3, this.view.scale * factor)); this.view.x = clientX - rect.left - p.x * this.view.scale; this.view.y = clientY - rect.top - p.y * this.view.scale; this.apply();
    }
    fit() { const b = model.bounds(this.board), rect = this.svg.getBoundingClientRect(); this.view.scale = Math.max(.1, Math.min(1.3, (rect.width - 40) / b.width, (rect.height - 40) / b.height)); this.center(b.x + b.width / 2, b.y + b.height / 2); }
    center(x, y, scale = this.view.scale) { const rect = this.svg.getBoundingClientRect(); this.view.scale = scale; this.view.x = rect.width / 2 - x * scale; this.view.y = rect.height / 2 - y * scale; this.apply(); }
    render(board, selected = null, linkSource = null, pawn = null) {
      this.board = board; this.world.replaceChildren(); const nodes = new Map(board.nodes.map(node => [node.id, node]));
      this.updateTerrain();this.terrainLayer=this.paintedTerrain.back.layer;this.world.append(this.terrainLayer);this.decorEntries=[];
      this.decorRaster ||= {back:new PaintedTerrain('decor'),front:new PaintedTerrain('decor')};this.decorKeys ||= {};
      for(const ground of [true,false]){const key=ground?'back':'front';if(!ground)this.world.append(this.paintedTerrain.front.layer);const decorations=(board.decorations||[]).filter(d=>model.isGroundDecoration(d)===ground),staticDecor=this.editDecorations?[]:decorations.filter(d=>!['casino-bank','street-factory','street-empty-plot'].includes(d.type)),signature=JSON.stringify(staticDecor);if(this.decorKeys[key]!==signature){this.decorKeys[key]=signature;this.decorRaster[key].update({decorations:staticDecor});}this.world.append(this.decorRaster[key].layer);
        for(const d of decorations){if(!this.editDecorations&&!['casino-bank','street-factory','street-empty-plot'].includes(d.type))continue;const group=model.decorationArtwork(d,!!this.editDecorations,selected==='decor:'+d.id);group.style.display='none';this.world.append(group);const r=d.size*.71+2;this.decorEntries.push({d,group,visible:false,x:d.x-r,y:d.y-r,right:d.x+r,bottom:d.y+r});}}
      this.decorIndex=new window.PourtyRaster.SpatialIndex(this.decorEntries);this.visibleDecor=new Set();this.decorCullKey=null;
      const routes = new Set(board.edges.map(edge => edge.from + '>' + edge.to));
      const numbers = new Map(board.nodes.map((node, index) => [node.id, index + 1]));
      board.edges.forEach((edge, index) => {
        const from = nodes.get(edge.from), to = nodes.get(edge.to); if (!from || !to) return;
        const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
        const x1 = from.x + dx / length * 29, y1 = from.y + dy / length * 29, x2 = to.x - dx / length * 32, y2 = to.y - dy / length * 32;
        const reverse = routes.has(edge.to + '>' + edge.from), offset = reverse ? 8 : 0;
        const path = `M${x1} ${y1} Q${(x1 + x2) / 2 - dy / length * offset} ${(y1 + y2) / 2 + dx / length * offset} ${x2} ${y2}`;
        const group = el('g', { 'data-edge': index, tabindex: 0, role: 'button', 'aria-label': `Chemin ${numbers.get(from.id)} vers ${numbers.get(to.id)}` });
        group.append(el('path', { d: path, stroke: 'transparent', 'stroke-width': 18, fill: 'none' }), el('path', { d: path, stroke: selected === `edge:${index}` ? '#f0bd77' : '#667aab', 'stroke-width': selected === `edge:${index}` ? 4 : 3, class: 'route-line', fill: 'none', 'marker-end': 'url(#route-arrow)' })); this.world.append(group);
      });
      board.nodes.forEach((node, index) => {
        const type = model.types[node.type], group = el('g', { transform: `translate(${node.x} ${node.y})`, 'data-node': node.id, tabindex: 0, role: 'button', 'aria-label': `${index + 1}. ${type.name}${node.id === board.startId ? ', départ' : ''}${node.label ? ', ' + node.label : ''}` });
        if (selected === node.id || linkSource === node.id) group.append(el('circle', { r: 34, fill: '#a7b9ff13', stroke: linkSource === node.id ? '#f1d084' : '#b7c6ff', 'stroke-width': 2, 'stroke-dasharray': linkSource === node.id ? '5 4' : 'none' }));
        group.append(...model.spaceArtwork(node.type).children);
        if (this.showNodeText !== false && (node.label || this.showNodeNumbers !== false)) group.append(el('text', { x: 0, y: 48, 'text-anchor': 'middle', fill: '#a9b8d6', 'font-size': 11, 'pointer-events': 'none' }, node.label || `${index + 1}`));
        if (this.showNodeText !== false && node.id === board.startId) group.append(el('text', { x: 0, y: -39, 'text-anchor': 'middle', fill: '#dfe7ff', 'font-size': 10, 'font-weight': 700 }, 'DÉPART'));
        this.world.append(group);
      });
      if (pawn) { this.world.append(el('circle', { cx: pawn.x, cy: pawn.y, r: 12, fill: '#fff', stroke: '#17213b', 'stroke-width': 4, 'pointer-events': 'none' })); }
      this.pawnElements=new Map();this.pawnOrder='';this.pawnLayer = el('g', { 'pointer-events': 'none' }); this.world.append(this.pawnLayer);
      this.apply();
    }
    updateTerrain(){
      this.paintedTerrain ||= {back:new PaintedTerrain(),front:new PaintedTerrain()};this.terrainKeys ||= {};
      const strokes=this.board.terrain||[],paintBudget=strokes.some(s=>s.layer==='front')&&strokes.some(s=>s.layer!=='front')?4000000:8000000;
      for(const layer of ['back','front']){const terrain=(this.board.terrain||[]).filter(s=>(s.layer||'back')===layer),key=paintBudget+':'+JSON.stringify(terrain);if(this.terrainKeys[layer]!==key){this.terrainKeys[layer]=key;this.paintedTerrain[layer].update({terrain,paintBudget});}}
    }
    updateTerrainView(){if(!this.paintedTerrain)return;this.viewport??=this.svg.getBoundingClientRect();for(const layer of [...Object.values(this.paintedTerrain),...Object.values(this.decorRaster||{})])layer.setView(this.view,this.viewport);}
    setStar(id,animate=false){
      this.world.querySelectorAll('[data-node]').forEach(group=>{
        let icon=group.querySelector('.board-star');
        if(group.dataset.node!==id){if(icon)icon.remove();return;}
        if(!icon){icon=el('path',{class:'board-star',d:'M0 -18L5.3 -6.2L18 -5.6L8.5 3L11.1 16L0 9.5L-11.1 16L-8.5 3L-18 -5.6L-5.3 -6.2Z',fill:'#ffe585',stroke:'#a66821','stroke-width':1.5,'pointer-events':'none'});group.append(icon);}
        if(animate)icon.classList.add('appearing');
      });
    }
    setPawns(pawns) {
      if(!this.pawnLayer)return;const keys=pawns.map((p,i)=>p.playerId??i),wanted=new Set(keys);
      for(const [id,entry]of this.pawnElements)if(!wanted.has(id)){entry.group.remove();this.pawnElements.delete(id);}
      pawns.forEach((pawn,i)=>{const id=keys[i];let e=this.pawnElements.get(id);if(!e){e={group:el('g'),circle:el('circle',{r:16,'stroke-width':3}),text:el('text',{x:0,y:4,'text-anchor':'middle','font-size':12,'font-weight':800})};e.group.append(e.circle,e.text);this.pawnElements.set(id,e);this.pawnLayer.append(e.group);}const position=pawn.x+','+pawn.y;if(position!==e.position){e.group.setAttribute('transform','translate('+pawn.x+' '+pawn.y+')');e.position=position;}const appearance=[pawn.color,pawn.border,pawn.ink,pawn.initial].join('|');if(appearance!==e.appearance){e.circle.setAttribute('fill',pawn.color);e.circle.setAttribute('stroke',pawn.border||'#17213b');e.text.setAttribute('fill',pawn.ink||'#152039');e.text.textContent=pawn.initial;e.appearance=appearance;}});
      const order=keys.join(',');if(order!==this.pawnOrder){for(const id of keys)this.pawnLayer.append(this.pawnElements.get(id).group);this.pawnOrder=order;}
    }
    cullDecorations(){
      if(!this.decorEntries?.length)return;this.viewport??=this.svg.getBoundingClientRect();const v=this.view,cell=256,x=Math.floor((-v.x/v.scale-100/v.scale)/cell)*cell,y=Math.floor((-v.y/v.scale-100/v.scale)/cell)*cell,right=Math.ceil(((this.viewport.width-v.x)/v.scale+100/v.scale)/cell)*cell,bottom=Math.ceil(((this.viewport.height-v.y)/v.scale+100/v.scale)/cell)*cell,key=[x,y,right,bottom].join(':');if(key===this.decorCullKey)return;this.decorCullKey=key;
      const visible=new Set(this.decorIndex.query(x,y,right,bottom));for(const e of this.visibleDecor||[])if(!visible.has(e)){e.group.style.display='none';e.visible=false;}for(const e of visible)if(!e.visible){e.group.style.display='';e.visible=true;}this.visibleDecor=visible;
    }
    moveElement(id,decor=false){
      if(decor){const entry=this.decorEntries.find(e=>e.d.id===id);if(entry)entry.group.setAttribute('transform','translate('+entry.d.x+' '+entry.d.y+') rotate('+entry.d.rotation+')');if(entry){const r=entry.d.size*.71+2;Object.assign(entry,{x:entry.d.x-r,y:entry.d.y-r,right:entry.d.x+r,bottom:entry.d.y+r});this.decorIndex=new window.PourtyRaster.SpatialIndex(this.decorEntries);this.decorCullKey=null;}this.cullDecorations();return;}
      const node=this.board.nodes.find(n=>n.id===id),group=this.world.querySelector('[data-node="'+id+'"]');if(!node||!group)return;group.setAttribute('transform','translate('+node.x+' '+node.y+')');
      const nodes=new Map(this.board.nodes.map(n=>[n.id,n])),routes=new Set(this.board.edges.map(e=>e.from+'>'+e.to));this.board.edges.forEach((edge,index)=>{if(edge.from!==id&&edge.to!==id)return;const a=nodes.get(edge.from),b=nodes.get(edge.to),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,x1=a.x+dx/length*29,y1=a.y+dy/length*29,x2=b.x-dx/length*32,y2=b.y-dy/length*32,offset=routes.has(edge.to+'>'+edge.from)?8:0,d='M'+x1+' '+y1+' Q'+((x1+x2)/2-dy/length*offset)+' '+((y1+y2)/2+dx/length*offset)+' '+x2+' '+y2;this.world.querySelector('[data-edge="'+index+'"]')?.querySelectorAll('path').forEach(p=>p.setAttribute('d',d));});
    }
    highlightRoute(path = []) {
      const nodes = new Set(path), edges = new Set(path.slice(1).map((to, i) => path[i] + '>' + to));
      this.world.querySelectorAll('[data-edge]').forEach(group => {
        const edge = this.board.edges[Number(group.dataset.edge)], line = group.lastElementChild;
        const on = edges.has(edge.from + '>' + edge.to); line.setAttribute('stroke', on ? '#ffe194' : '#667aab'); line.setAttribute('stroke-width', on ? 7 : 3);
      });
      this.world.querySelectorAll('[data-node]').forEach(group => {
        let ring = group.querySelector('.route-ring');
        if (!ring) { ring = el('circle', { r: 31, fill: 'none', stroke: '#ffe194', 'stroke-width': 3, class: 'route-ring', 'pointer-events': 'none' }); group.append(ring); }
        ring.setAttribute('visibility', nodes.has(group.dataset.node) ? 'visible' : 'hidden');
      });
    }
  }
  window.PourtyBoardCanvas = BoardCanvas;
})();
