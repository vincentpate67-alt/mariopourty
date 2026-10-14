const customMaps = (window.PourtyBoardLibrary?.all() || []).filter(board => !window.PourtyBoardModel.issues(board).errors.length).map(board => ({
  id: board.id, name: board.name, file: 'board-play.html?map=' + encodeURIComponent(board.id),
  image: window.PourtyBoardModel.preview(board), description: board.description || (board.nodes.length + ' cases'), board
}));
customMaps.sort((a,b) => window.PourtyBoardModel.difficulty(a.board) - window.PourtyBoardModel.difficulty(b.board));
window.PourtyMaps = Object.freeze(customMaps.map(map => Object.freeze(map)));
