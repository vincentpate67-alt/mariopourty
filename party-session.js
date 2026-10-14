(() => {
  'use strict';
  const keys = Object.freeze({ draft: 'mario-pourty-board-draft', session: 'mario-pourty-session', players: 'mini-Jeux-host-players' });
  const bonusCategories=Object.freeze([{id:'minigame-wins',label:'Le plus de mini-jeux gagnés'},{id:'ac-earned',label:'Le plus d’AC récupérés'},{id:'items-used',label:'Le plus d’objets utilisés'},{id:'most-spaces',label:'Le plus de cases parcourues'},{id:'fewest-spaces',label:'Le moins de cases parcourues'},{id:'boubakar-stops',label:'Le plus d’arrêts sur une case Boubakar'},{id:'event-stops',label:'Le plus d’arrêts sur une case Événement'}]);
  const catalog = games;
  const maps = window.PourtyMaps;
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  function normalize(value = {}) {
    if (!value || typeof value !== 'object') value = {};
    const availableCategories=bonusCategories.filter(c=>c.id!=='event-stops'||(value.board||maps.find(m=>m.id===(value.mapId||value.map?.id))?.board)?.nodes.some(n=>n.type==='event'));
    const categories=Array.isArray(value.bonusCategories)?availableCategories.filter(c=>value.bonusCategories.includes(c.id)).map(c=>c.id):availableCategories.map(c=>c.id);
    return {
      hiddenBlocks:value.hiddenBlocks!==false,hiddenBlockCount:Number.isSafeInteger(value.hiddenBlockCount)&&value.hiddenBlockCount>=1&&value.hiddenBlockCount<=999?value.hiddenBlockCount:1,doubleCoinsMinigames:value.doubleCoinsMinigames!==false,shopMultiplier:Number.isFinite(value.shopMultiplier)&&value.shopMultiplier>=0?value.shopMultiplier:1,shopSelling:value.shopSelling!==false,movementDieMax:Number.isInteger(value.movementDieMax)&&value.movementDieMax>=5&&value.movementDieMax<=20?value.movementDieMax:10,teams:Array.isArray(value.teams)?JSON.parse(JSON.stringify(value.teams)):[],gameMode:['inverted','teams'].includes(value.gameMode)?value.gameMode:'normal',inventorySlots:Number.isInteger(value.inventorySlots)&&value.inventorySlots>=1&&value.inventorySlots<=4?value.inventorySlots:3,bonusCategories:categories,bonusCount:Math.max(1,Math.min(categories.length||1,Number.isSafeInteger(value.bonusCount)?value.bonusCount:2)),startingAC:Number.isSafeInteger(value.startingAC)&&value.startingAC>=0?value.startingAC:10,startingStars:Number.isSafeInteger(value.startingStars)&&value.startingStars>=0?value.startingStars:0,starPrice:Number.isSafeInteger(value.starPrice)&&value.starPrice>=0?value.starPrice:20,
      mapId: maps.some(map => map.id === value.mapId) ? value.mapId : null,
      turns: Number.isInteger(value.turns) && value.turns >= 5 && value.turns <= 30 ? value.turns : 10,
      minigameIds: Array.isArray(value.minigameIds) ? catalog.filter(game => value.minigameIds.includes(game.id)).map(game => game.id) : catalog.map(game => game.id),
      bonusStars: typeof value.bonusStars === 'boolean' ? value.bonusStars : true
    };
  }
  function getPlayers() {
    const value = read(keys.players);
    return Array.isArray(value) ? value.filter(player => player && typeof player.name === 'string' && player.name.trim() && /^#[0-9a-f]{6}$/i.test(player.color)).slice(0, 6).map(player => ({ ...player })) : [];
  }
  function validate(config) {
    if (!maps.some(map => map.id === config?.mapId)) throw new Error('Choisis une map.');
    if (!Number.isInteger(config.turns) || config.turns < 5 || config.turns > 30) throw new Error('Choisis entre 5 et 30 tours.');
    if (!Array.isArray(config.minigameIds) || !config.minigameIds.length || config.minigameIds.some(id => !catalog.some(game => game.id === id))) throw new Error('Sélectionne au moins un mini-jeu.');
    if(config.shopMultiplier!==undefined&&(!Number.isFinite(config.shopMultiplier)||config.shopMultiplier<0))throw new Error('Le multiplicateur du shop doit être positif ou nul.');
    if(config.hiddenBlocks!==undefined&&typeof config.hiddenBlocks!=='boolean')throw Error('Réglage des blocks cachés invalide.');if(config.hiddenBlocks!==false&&config.hiddenBlockCount!==undefined&&(!Number.isSafeInteger(config.hiddenBlockCount)||config.hiddenBlockCount<1||config.hiddenBlockCount>999))throw Error('Choisis entre 1 et 999 blocks cachés.');
    if(config.doubleCoinsMinigames!==undefined&&typeof config.doubleCoinsMinigames!=='boolean')throw new Error('Réglage des mini-jeux pièces ×2 invalide.');
    if(config.shopSelling!==undefined&&typeof config.shopSelling!=='boolean')throw new Error('Réglage de vente invalide.');
    if(config.movementDieMax!==undefined&&(!Number.isInteger(config.movementDieMax)||config.movementDieMax<5||config.movementDieMax>20))throw new Error('Choisis un dé de déplacement entre 5 et 20.');
    if(config.gameMode!==undefined&&!['normal','inverted','teams'].includes(config.gameMode))throw new Error('Mode de jeu invalide.');
    if(config.gameMode==='teams')window.PourtyTeams.validate(config.teams,(config.players||getPlayers()).length);
    if(config.inventorySlots!==undefined&&(!Number.isInteger(config.inventorySlots)||config.inventorySlots<1||config.inventorySlots>4))throw new Error('Choisis entre 1 et 4 places d’inventaire.');
    for(const field of ['startingAC','startingStars','starPrice'])if(config[field]!==undefined&&(!Number.isSafeInteger(config[field])||config[field]<0))throw new Error('Les montants doivent être des nombres entiers positifs ou nuls.');
    const options=normalize(config);if(config.bonusStars&&(!options.bonusCategories.length||!Number.isSafeInteger(config.bonusCount??options.bonusCount)||(config.bonusCount??options.bonusCount)<1||(config.bonusCount??options.bonusCount)>options.bonusCategories.length))throw new Error('Choisis au moins une catégorie et un nombre de bonus entre 1 et le nombre de catégories.');
    if (typeof config.bonusStars !== 'boolean') throw new Error('Choisis le réglage des étoiles bonus.');
  }
  // Placeholder estimate, intentionally independent of future gameplay timing.
  const estimateMinutes = turns => turns * 3;
  function saveDraft(config) {
    try { localStorage.setItem(keys.draft, JSON.stringify({ version: 1, ...normalize(config) })); }
    catch { throw new Error('Sauvegarde impossible. Autorise le stockage dans le navigateur.'); }
  }
  function launch(config) {
    validate(config);config={...config,...normalize(config)};
    const players = getPlayers();
    if (!players.length) throw new Error('Ajoute au moins un joueur depuis l’accueil.');
    const map = maps.find(item => item.id === config.mapId);
    const session = {
      version: 1,
      id: globalThis.crypto?.randomUUID?.() || `party-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      map: { id: map.id, name: map.name, file: map.file },
      ...(map.board ? { board: window.PourtyBoardModel.clone(map.board) } : {}),
      turns: config.turns,
      estimatedMinutes: estimateMinutes(config.turns),
      minigameIds: [...new Set(config.minigameIds)],
      bonusStars: config.bonusStars,
      hiddenBlocks:config.hiddenBlocks,hiddenBlockCount:config.hiddenBlockCount,doubleCoinsMinigames:config.doubleCoinsMinigames,shopMultiplier:config.shopMultiplier,shopSelling:config.shopSelling,movementDieMax:config.movementDieMax,teams:config.gameMode==='teams'?config.teams:[],gameMode:config.gameMode,inventorySlots:config.inventorySlots,bonusCategories:[...config.bonusCategories],bonusCount:config.bonusCount,startingAC:config.startingAC,startingStars:config.startingStars,starPrice:config.starPrice,
      players
    };
    try { localStorage.setItem(keys.session, JSON.stringify(session)); }
    catch { throw new Error('Sauvegarde impossible. La partie n’a pas été lancée.'); }
    return session;
  }
  function getSession() {
    const session = read(keys.session);
    if (session?.version !== 1 || !Array.isArray(session.players) || !session.players.length || session.players.length > 6) return null;
    if (!session.players.every(player => player && typeof player.name === 'string' && player.name.trim() && /^#[0-9a-f]{6}$/i.test(player.color))) return null;
    try { validate({ ...session, mapId: session.map?.id }); } catch { return null; }
    const map = maps.find(item => item.id === session.map.id);
    if (session.map.file !== map.file) return null;
    if (map.board) {
      try { const board = window.PourtyBoardModel.normalize(session.board); if (board.id !== map.id || window.PourtyBoardModel.issues(board).errors.length) return null; session.board = board; }
      catch { return null; }
    }
    const options=normalize(session);for(const field of ['hiddenBlocks','hiddenBlockCount','doubleCoinsMinigames','teams','shopMultiplier','shopSelling','movementDieMax','gameMode','inventorySlots','bonusCategories','bonusCount','startingAC','startingStars','starPrice'])session[field]=options[field];return session;
  }
  window.PourtySession = Object.freeze({ bonusCategories, keys, normalize, getPlayers, validate, estimateMinutes, saveDraft, getDraft: () => normalize(read(keys.draft)), launch, getSession });
})();
