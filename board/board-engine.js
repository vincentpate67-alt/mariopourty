(() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  function die(random = Math.random) { return Math.floor(random() * 10) + 1; }
  function shuffle(values, random = Math.random) { const result = [...values]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
  function create(session, random = Math.random) {
    const players = session.players.map((_, i) => i);
    return { doubleCoinsMinigames:session.doubleCoinsMinigames!==false,teams:session.gameMode==='teams'?clone(session.teams):[],version: 1, sessionId: session.id, phase: 'intro', introQueue: shuffle(players, random), introCursor: 0, rolls: players.map(() => []), introRound: 1, order: [], round: 1, turn: 0, positions: players.map(() => session.board.startId), wallets: players.map(() => ({stars:session.startingStars??0,ac:session.startingAC??10})), movementDieMax:session.movementDieMax??10,starPrice:session.starPrice??20, starNode:null,starVisible:false,starIntroPending:false,remaining: 0, lastRoll: null, target: null, minigameId: null };
  }
  function compare(a, b, rolls) { for (let i = 0; i < Math.max(rolls[a].length, rolls[b].length); i++) { const delta = (rolls[b][i] || 0) - (rolls[a][i] || 0); if (delta) return delta; } return 0; }
  function rollOrder(state, value, random = Math.random) {
    if (state.phase !== 'intro' || !Number.isInteger(value) || value < 1 || value > 10) throw Error('Lancer initial invalide.');
    const next = clone(state), player = next.introQueue[next.introCursor]; next.rolls[player].push(value); next.introCursor++;
    if (next.introCursor < next.introQueue.length) return next;
    const sorted = next.rolls.map((_, i) => i).sort((a, b) => compare(a, b, next.rolls));
    const tied = sorted.filter((p, i) => (i > 0 && compare(p, sorted[i - 1], next.rolls) === 0) || (i + 1 < sorted.length && compare(p, sorted[i + 1], next.rolls) === 0));
    if (tied.length) { next.introQueue = shuffle(tied, random); next.introCursor = 0; next.introRound++; }
    else { next.order = sorted; next.phase = 'order-ready'; }
    return next;
  }
  function starSpaces(board){return board.nodes.filter(node=>node.type==='star');}
  function chooseStar(board,previous=null,random=Math.random){const spaces=starSpaces(board);if(!spaces.length)return null;if(spaces.length===1)return spaces[0].id;const candidates=spaces.filter(node=>node.id!==previous);return candidates[Math.floor(random()*candidates.length)].id;}
  function start(state,board,random=Math.random) {
    if(state.phase!=='order-ready')throw Error('Ordre incomplet.');
    const next=clone(state);next.phase='round-intro';next.starNode=chooseStar(board,null,random);next.starVisible=starSpaces(board).length===1;next.starIntroPending=starSpaces(board).length>=2;return next;
  }
  function finishRoundIntro(state){
    if(state.phase!=='round-intro')throw Error('Aucune annonce de tour.');
    const next=clone(state);if(next.starIntroPending){next.starIntroPending=false;next.phase='star-reveal';next.starReturnPhase='turn';}else next.phase='turn';return next;
  }
  function revealStar(state){if(state.phase!=='star-reveal'||!state.starNode)throw Error('Aucune étoile à révéler.');return {...clone(state),starVisible:true};}
  function finishStarReveal(state){if(state.phase!=='star-reveal'||!state.starVisible)throw Error('Étoile non révélée.');const next=clone(state);next.phase=next.starReturnPhase;delete next.starReturnPhase;return next;}
  function answerStar(state,board,buy,random=Math.random){
    if(state.phase!=='star-offer'||nodeAt(state,board).id!==state.starNode)throw Error('Aucune étoile à acheter ici.');
    const next=clone(state);if(!buy){next.phase='moving';return next;}
    const wallet=next.wallets[active(next)];if(wallet.ac<20)throw Error('Il faut 20 AC pour acheter une étoile.');
    next.rankingBefore=clone(next.wallets);wallet.ac-=20;wallet.stars++;next.phase='star-won';
    if(starSpaces(board).length===1){next.afterRanking='moving';return next;}
    next.starNode=chooseStar(board,next.starNode,random);next.starVisible=false;next.afterRanking='star-reveal';next.starReturnPhase='moving';return next;
  }
  function finishStarWon(state){if(state.phase!=='star-won')throw Error('Aucune étoile gagnée à annoncer.');return {...clone(state),phase:'ranking'};}
  const active = state => state.order[state.turn];
  const nodeAt = (state, board) => board.nodes.find(node => node.id === state.positions[active(state)]);
  const exits = (board, id) => board.edges.filter(edge => edge.from === id).map(edge => edge.to);
  function rollTurn(state, value) {
    if (state.phase !== 'turn' || !Number.isInteger(value) || value < 1 || value > (state.movementDieMax??10)) throw Error('Lancer de déplacement invalide.');
    return { ...clone(state), phase: 'moving', remaining: value, lastRoll: value, target: null };
  }
  function choose(state, board, id) {
    if (!['moving','choice'].includes(state.phase) || state.target || !exits(board, nodeAt(state, board).id).includes(id)) throw Error('Chemin non autorisé.');
    return { ...clone(state), phase: 'moving', target: id };
  }
  function arrive(state, board) {
    if (state.phase !== 'moving' || !state.target) throw Error('Aucun déplacement en cours.');
    const next = clone(state), node = board.nodes.find(item => item.id === next.target);
    if (!node || !exits(board, nodeAt(state, board).id).includes(node.id)) throw Error('Destination invalide.');
    next.positions[active(next)] = node.id; next.target = null;
    if (node.countsAsStep) { next.remaining--; next.phase = next.remaining === 0 ? 'land' : 'moving'; }
    else if(next.turboMovement&&node.type!=='zipline')next.phase='moving';
    else if(node.type==='star')next.phase=next.starVisible&&next.starNode===node.id?'star-offer':'moving';
    else next.phase = 'pass';
    return next;
  }
  function continuePass(state) { if (state.phase !== 'pass') throw Error('Aucun événement en attente.'); return { ...clone(state), phase: 'moving' }; }
  function nextPlayer(state, session, random = Math.random) {
    if (state.phase !== 'land') throw Error('Le déplacement n’est pas terminé.');
    const next = clone(state); next.turn++; delete next.turboMovement; next.remaining = 0; next.lastRoll = null;
    if (next.turn === next.order.length) { next.phase = 'minigame'; next.minigameId = null; next.miniSpin = null; }
    else next.phase = 'turn';
    return next;
  }
  function prepareMinigameBonus(state, random = Math.random) {
    if (state.doubleCoinsMinigames===false || state.round<3 || !['minigame','minigame-playing'].includes(state.phase) || state.duel || state.wager || state.spaceMinigame || state.turn !== state.order.length) return state;
    if (state.miniBonusRound === state.round) return state;
    const next = clone(state);
    next.miniBonusRound = next.round;
    const eligible = !Number.isInteger(next.lastDoubleCoinsRound) || next.round - next.lastDoubleCoinsRound > 3;
    next.miniRewardMultiplier = eligible && random() < .2 ? 2 : 1;
    if (next.miniRewardMultiplier === 2) next.lastDoubleCoinsRound = next.round;
    return next;
  }
  function minigameMultiplier(state) {
    return state.doubleCoinsMinigames!==false && state.round>=3 && !state.duel && !state.wager && !state.spaceMinigame && state.turn === state.order.length && state.miniBonusRound === state.round && state.miniRewardMultiplier === 2 ? 2 : 1;
  }
  function finishMinigame(state, session, rewards = []) {
    if (!['minigame','minigame-playing'].includes(state.phase)) throw Error('Aucun mini-jeu en cours.');
    const next = clone(state);
    next.wallets ||= session.players.map(() => ({stars:0,ac:0}));
    next.rankingBefore=clone(next.wallets);
    const seen = new Set();
    for (const reward of rewards) {
      if (!Number.isInteger(reward.playerIndex) || reward.playerIndex < 0 || reward.playerIndex >= session.players.length || seen.has(reward.playerIndex) || !Number.isSafeInteger(reward.ac) || reward.ac < 0 || reward.ac > 100000) throw Error('Récompenses de mini-jeu invalides.');
      seen.add(reward.playerIndex);next.wallets[reward.playerIndex].ac += reward.ac * minigameMultiplier(state);
    }
    next.minigameId = null; next.turn = 0; delete next.miniRewardMultiplier; delete next.miniBonusRound;
    if (next.round >= session.turns) next.phase = 'finished';
    else { next.round++; next.phase = 'round-intro'; }
    next.afterRanking=next.phase;next.phase='ranking';
    return next;
  }
  // Dijkstra uses arrival spaces as cost 1 and pass events as cost 0.
  function shortest(board, from, to) {
    const nodes = new Map(board.nodes.map(node => [node.id, node]));
    if (!nodes.has(from) || !nodes.has(to)) return null;
    const distance = new Map([[from, 0]]), previous = new Map(), visited = new Set(), queue = new Set([from]);
    while (queue.size) {
      let current; for (const id of queue) if (current === undefined || distance.get(id) < distance.get(current)) current = id;
      queue.delete(current); if (current === to) break; if (visited.has(current)) continue; visited.add(current);
      for (const next of exits(board, current)) { const cost = distance.get(current) + (nodes.get(next).countsAsStep ? 1 : 0); if (cost < (distance.get(next) ?? Infinity)) { distance.set(next, cost); previous.set(next, current); queue.add(next); } }
    }
    if (!distance.has(to)) return null;
    const path = [to]; while (path[0] !== from) { const p = previous.get(path[0]); if (!p || path.length > board.nodes.length) return null; path.unshift(p); }
    return { distance: distance.get(to), path };
  }
  function landings(board, first, remaining) {
    const nodes = new Map(board.nodes.map(n => [n.id,n])), visited = new Set(), result = new Set(), queue = [[first,remaining]];
    while(queue.length) {
      const [id,steps] = queue.pop(), node = nodes.get(id); if(!node)continue;
      const left=steps-(node.countsAsStep?1:0), key=id+':'+left;
      if(left<0||visited.has(key))continue;visited.add(key);
      if(left===0&&node.countsAsStep){result.add(id);continue;}
      exits(board,id).forEach(next=>queue.push([next,left]));
    }
    return board.nodes.filter(n=>result.has(n.id)).map(n=>n.id);
  }
  function preview(board, from, first, remaining) {
    const nodes = new Map(board.nodes.map(n=>[n.id,n])), seen = new Set(), routeNodes = new Set([from]), routeEdges = new Set([from+'>'+first]), pending = [[first,remaining]];
    while(pending.length){
      const [id,steps]=pending.pop(),node=nodes.get(id);if(!node)continue;
      const left=steps-(node.countsAsStep?1:0),key=id+':'+left;
      if(left<0||seen.has(key))continue;seen.add(key);routeNodes.add(id);
      if(left===0&&node.countsAsStep)continue;
      for(const next of exits(board,id)){routeEdges.add(id+'>'+next);pending.push([next,left]);}
    }
    return {nodes:[...routeNodes],edges:[...routeEdges],landings:landings(board,first,remaining)};
  }
  function restore(raw, session) {
    try {
      if (!raw || raw.version !== 1 || raw.sessionId !== session.id) return null;
      raw={...raw,doubleCoinsMinigames:session.doubleCoinsMinigames!==false,movementDieMax:session.movementDieMax??10};
      const n = session.players.length, indices = Array.from({length:n},(_,i)=>i), phases = ['intro','order-ready','turn','moving','choice','pass','land','minigame','minigame-playing','round-intro','ranking','star-reveal','star-offer','star-won','finished'];
      const permutation = values => Array.isArray(values) && values.length === n && new Set(values).size === n && values.every(v => indices.includes(v));
      if(raw.phase==='ranking'&&!['round-intro','finished','moving','star-reveal'].includes(raw.afterRanking))return null;
      if(raw.phase==='star-won'&&!['moving','star-reveal'].includes(raw.afterRanking))return null;
      if(['ranking','star-won'].includes(raw.phase)&&['moving','star-reveal'].includes(raw.afterRanking)&&(raw.remaining<1||!raw.rankingBefore||(raw.afterRanking==='star-reveal'&&(!raw.starNode||raw.starReturnPhase!=='moving'))))return null;
      if (!phases.includes(raw.phase) || !Number.isInteger(raw.round) || raw.round < 1 || raw.round > session.turns || !Number.isInteger(raw.turn) || raw.turn < 0 || raw.turn > n) return null;
      if (!Array.isArray(raw.positions) || raw.positions.length !== n || raw.positions.some(id => !session.board.nodes.some(node => node.id === id))) return null;
      if (!Array.isArray(raw.rolls) || raw.rolls.length !== n || raw.rolls.some(values => !Array.isArray(values) || values.some(v => !Number.isInteger(v) || v < 1 || v > 10))) return null;
      if (!Number.isInteger(raw.remaining) || raw.remaining < 0 || raw.remaining > 4*(session.movementDieMax??10)) return null;
      if (raw.phase === 'intro') {
        if (!Array.isArray(raw.introQueue) || !raw.introQueue.length || new Set(raw.introQueue).size !== raw.introQueue.length || raw.introQueue.some(i=>!indices.includes(i)) || !Number.isInteger(raw.introCursor) || raw.introCursor < 0 || raw.introCursor >= raw.introQueue.length) return null;
      } else if (!permutation(raw.order) || raw.rolls.some(values=>!values.length)) return null;
      const mini = ['minigame','minigame-playing'].includes(raw.phase);
      if (mini && (raw.turn !== n || (raw.minigameId !== null && !session.minigameIds.includes(raw.minigameId)))) return null;
      if (raw.phase === 'minigame-playing' && !session.minigameIds.includes(raw.minigameId)) return null;
      if (raw.miniSpin && (!Number.isInteger(raw.miniSpin.steps) || raw.miniSpin.steps<1 || raw.miniSpin.steps>200)) return null;
      if (!mini && raw.phase !== 'intro' && raw.turn >= n) return null;
      if (['moving','choice','pass','star-offer'].includes(raw.phase) && raw.remaining < 1) return null;
      if (raw.target && (raw.phase !== 'moving' || !exits(session.board, raw.positions[active(raw)]).includes(raw.target))) return null;
      if (raw.phase === 'pass' && nodeAt(raw,session.board).countsAsStep) return null;
      if (raw.phase === 'land' && (raw.remaining !== 0 || !nodeAt(raw,session.board).countsAsStep)) return null;
      if(raw.starNode!=null&&!starSpaces(session.board).some(node=>node.id===raw.starNode))return null;
      if(raw.phase==='star-offer'&&(!raw.starVisible||raw.starNode!==nodeAt(raw,session.board).id))return null;
      if(raw.phase==='star-reveal'&&(!raw.starNode||!['turn','moving'].includes(raw.starReturnPhase)||(raw.starReturnPhase==='moving'&&raw.remaining<1)))return null;
      const restored = clone(raw);
      if(!Object.hasOwn(restored,'starNode')){restored.starNode=chooseStar(session.board);restored.starVisible=Boolean(restored.starNode);restored.starIntroPending=false;}
      restored.wallets ||= session.players.map(() => ({stars:0,ac:0}));
      if (!Array.isArray(restored.wallets) || restored.wallets.length !== n || restored.wallets.some(w => !w || !Number.isSafeInteger(w.ac) || w.ac < 0 || !Number.isSafeInteger(w.stars) || w.stars < 0)) return null;
      if(restored.rankingBefore && (!Array.isArray(restored.rankingBefore)||restored.rankingBefore.length!==n||restored.rankingBefore.some(w=>!w||!Number.isSafeInteger(w.ac)||w.ac<0||!Number.isSafeInteger(w.stars)||w.stars<0)))return null;
      return restored;
    } catch { return null; }
  }
  window.PourtyBoardEngine = Object.freeze({ prepareMinigameBonus, minigameMultiplier, die, shuffle, create, rollOrder, start, finishRoundIntro, revealStar, finishStarReveal, finishStarWon, answerStar, chooseStar, active, nodeAt, exits, rollTurn, choose, arrive, continuePass, nextPlayer, finishMinigame, shortest, landings, preview, restore });
})();
