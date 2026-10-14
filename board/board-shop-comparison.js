(() => {
  function compare(boards,model,period='all'){
    const periods=period==='all'?['early','late']:[period];
    return Object.entries(model.items).map(([id,item])=>{
      const cells=boards.map(board=>{const offers=[];for(const [index,node]of board.nodes.entries())if(node.type==='shop'){const shop=model.normalizeShop(node.shop);for(const phase of periods)for(const offer of shop[phase])if(offer.itemId===id)offers.push({price:offer.price,phase,shop:node.label||'Shop '+(index+1)});}return offers;});
      const prices=cells.flat().map(o=>o.price);return {id,item,cells,average:prices.length?prices.reduce((a,b)=>a+b,0)/prices.length:null};
    });
  }
  window.PourtyShopComparison={compare,mount({button,getBoard,library,model}){
    const dialog=document.createElement('dialog');dialog.className='shop-comparison';dialog.setAttribute('aria-labelledby','shop-comparison-title');
    const panel=document.createElement('div');panel.className='shop-comparison-panel';const header=document.createElement('header'),title=document.createElement('h2');title.id='shop-comparison-title';title.textContent='Prix des shops';
    const controls=document.createElement('div'),period=document.createElement('select');period.setAttribute('aria-label','Période des shops');for(const [value,label]of [['all','Early + Late'],['early','Early'],['late','Late']]){const option=document.createElement('option');option.value=value;option.textContent=label;period.append(option);}
    const closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent='Fermer';controls.append(period,closeButton);header.append(title,controls);
    const scroll=document.createElement('div');scroll.className='shop-comparison-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','Tableau des prix par plateau');const table=document.createElement('table');scroll.append(table);const note=document.createElement('p');note.textContent='Prix de base · Moyenne de toutes les offres des shops et périodes sélectionnées.';panel.append(header,scroll,note);dialog.append(panel);document.body.append(dialog);
    const number=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2});let closing=false;
    function render(){const current=getBoard(),maps=new Map(library.all().map(b=>[b.id,b]));maps.set(current.id,current);const boards=[...maps.values()];table.replaceChildren();const head=document.createElement('thead'),headRow=document.createElement('tr');for(const [i,label]of ['Objet',...boards.map(b=>b.name+(b.id===current.id?' · en cours':'')),'Moyenne'].entries()){const th=document.createElement('th');th.scope='col';th.textContent=label;if(i===boards.length+1)th.className='price-average';headRow.append(th);}head.append(headRow);table.append(head);const body=document.createElement('tbody');
      for(const row of compare(boards,model,period.value||'all')){const tr=document.createElement('tr'),name=document.createElement('th');name.scope='row';const item=document.createElement('span');item.className='price-item';const image=document.createElement('img');image.alt='';image.loading='lazy';model.itemImage(image,row.id);item.append(image,document.createTextNode(row.item.name));name.append(item);tr.append(name);
        for(const offers of row.cells){const td=document.createElement('td');if(!offers.length){td.textContent='—';td.className='price-absent';}else{for(const phase of ['early','late']){const matching=offers.filter(o=>o.phase===phase);if(!matching.length)continue;const line=document.createElement('div');line.className='price-line';if(period.value==='all'){const label=document.createElement('small');label.textContent=phase==='early'?'Early':'Late';line.append(label);}const text=document.createElement('span');text.textContent=[...new Set(matching.map(o=>o.price))].sort((a,b)=>a-b).map(p=>number.format(p)).join(' / ')+' AC';line.append(text);line.title=matching.map(o=>o.shop+' : '+o.price+' AC').join('\n');td.append(line);}}tr.append(td);}
        const avg=document.createElement('td');avg.className='price-average';avg.textContent=row.average===null?'—':number.format(row.average)+' AC';tr.append(avg);body.append(tr);
      }table.append(body);
    }
    async function close(){if(closing||!dialog.open)return;closing=true;const anim=panel.animate?.([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(10px)'}],{duration:180,easing:'ease-in',fill:'both'});if(anim)await anim.finished.catch(()=>{});dialog.close();anim?.cancel();closing=false;button.focus();}
    button.addEventListener('click',()=>{if(dialog.open)return;render();dialog.showModal();panel.animate?.([{opacity:0,transform:'translateY(14px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:300,easing:'cubic-bezier(.22,.75,.25,1)'});closeButton.focus();});
    period.addEventListener('change',render);closeButton.addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog)close();});dialog.addEventListener('keydown',e=>e.stopPropagation());
  }};
})();
