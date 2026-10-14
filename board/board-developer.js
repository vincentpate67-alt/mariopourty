(() => {
  window.PourtyDeveloper=function(ctx){
    const {$,players,board,session}=ctx;
    const inputs=players.map(player=>{const label=document.createElement('label');label.textContent=player.name+' · AC';const input=document.createElement('input');input.type='number';input.min='0';input.max='100000';input.step='1';label.append(input);$('developer-wallets').append(label);return input;});
    board.nodes.forEach((node,index)=>{const option=document.createElement('option');option.value=node.id;option.textContent=(index+1)+' · '+(node.label||(node.type==='event'?window.PourtyBoardModel.events[node.event]?.name:null)||window.PourtyBoardModel.types[node.type].name);$('developer-node').append(option);});
    players.forEach((player,id)=>{const option=document.createElement('option');option.value=id;option.textContent=player.name;$('developer-item-player').append(option);});
    Object.entries(window.PourtyBoardModel.items).forEach(([id,item])=>{const option=document.createElement('option');option.value=id;option.textContent=item.name;$('developer-item').append(option);});
    $('developer-give-item').addEventListener('click',()=>{if(!ready())return;const owner=Number($('developer-item-player').value),itemId=$('developer-item').value;if(!players[owner]||!Object.hasOwn(window.PourtyBoardModel.items,itemId))return;$('developer-panel').hidden=true;ctx.giveItem(owner,itemId);});
    function show(){const panel=$('developer-panel');if(!panel.hidden){panel.hidden=true;return;}panel.hidden=false;$('developer-enabled').checked=true;ctx.enabled(true);const state=ctx.getState();$('developer-round').max=session.turns;$('developer-round').value=state.round;inputs.forEach((input,i)=>input.value=state.wallets[i].ac);$('developer-status').textContent=ctx.canEdit()?'':'Modifie les tours, pièces et positions au choix des actions ou à une intersection.';}
    function ready(){if(ctx.canEdit())return true;$('developer-status').textContent='Attends le choix des actions ou une intersection pour modifier la partie.';return false;}
    $('developer-simulate-end').addEventListener('click',()=>{if(!ready())return;$('developer-panel').hidden=true;ctx.simulateEnd();});
    $('developer-close').addEventListener('click',()=>$('developer-panel').hidden=true);
    $('developer-enabled').addEventListener('change',()=>ctx.enabled($('developer-enabled').checked));
    $('developer-apply').addEventListener('click',()=>{if(!ready())return;const round=Number($('developer-round').value),wallets=inputs.map(input=>Number(input.value));if(!Number.isInteger(round)||round<1||round>session.turns||wallets.some(v=>!Number.isSafeInteger(v)||v<0||v>100000)){$('developer-status').textContent='Vérifie le tour et les montants (0–100 000 AC).';return;}ctx.apply(round,wallets);$('developer-status').textContent='Modifications appliquées.';});
    $('developer-teleport').addEventListener('click',()=>{if(!ready())return;const id=$('developer-node').value;if(!board.nodes.some(node=>node.id===id))return;$('developer-panel').hidden=true;ctx.teleport(id);});
    ctx.registerOpen?.(show);
    window.addEventListener('keydown',event=>{if(event.key==='Escape'){$('developer-panel').hidden=true;return;}if(event.key!=='*'&&event.code!=='NumpadMultiply')return;if(event.repeat)return;event.preventDefault();show();});
  };
})();
