(() => {
  const model = window.PourtyBoardModel;
  const keys = { library: 'mario-pourty-board-library-v1', draft: 'mario-pourty-editor-draft-v1' };
  function local() { try { const value = JSON.parse(localStorage.getItem(keys.library) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
  function all() {
    const result = new Map();
    for (const raw of [...(Array.isArray(window.PourtyBoardFiles) ? window.PourtyBoardFiles : []), ...local()]) {
      try { if(raw.deleted === true && typeof raw.id === "string"){result.delete(raw.id);continue;} const board = model.normalize(raw); result.set(board.id, board); } catch { /* Invalid legacy entries cannot become playable boards. */ }
    }
    return [...result.values()];
  }
  function saveMany(boards) {
    const current = new Map();
    for (const raw of local()) { try { if(raw.deleted === true && typeof raw.id === "string"){current.set(raw.id,raw);continue;} const board = model.normalize(raw); current.set(board.id, board); } catch {} }
    boards.map(model.normalize).map(model.assertEventsConfigured).forEach(board => current.set(board.id, board));
    const combined = new Set([...all().map(board => board.id), ...[...current.values()].filter(item=>!item.deleted).map(item=>item.id)]);
    if (combined.size > 100) throw Error('100 plateaux maximum dans cette bibliothèque.');
    try { localStorage.setItem(keys.library, JSON.stringify([...current.values()])); }
    catch { throw Error('Enregistrement dans le navigateur impossible. Exporte le fichier JSON pour conserver ton travail.'); }
  }
  function remove(id) {
    // A tombstone also hides a board supplied by the read-only plateaux.js file.
    const remaining=local().filter(item=>item?.id!==id);
    remaining.push({id,deleted:true});
    try { localStorage.setItem(keys.library,JSON.stringify(remaining)); }
    catch { throw Error('Suppression impossible : le stockage du navigateur est indisponible.'); }
  }
  function saveDraft(board) { try { localStorage.setItem(keys.draft, JSON.stringify(board)); return true; } catch { return false; } }
  function draft() { try { const value = localStorage.getItem(keys.draft); if(!value)return null; const board=model.normalize(JSON.parse(value)); return local().some(item=>item.id===board.id && item.deleted===true)?null:board; } catch { return null; } }
  function catalogText(boards = all()) { if (boards.length > 100) throw Error('100 plateaux maximum par catalogue.'); return 'window.PourtyBoardFiles = ' + JSON.stringify(boards.map(model.normalize).map(model.assertEventsConfigured), null, 2) + ';\n'; }
  window.PourtyBoardLibrary = Object.freeze({ keys, all, saveMany, remove, saveDraft, draft, catalogText });
})();
