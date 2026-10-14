function marioPourtyEnabled() {
  return localStorage.getItem('marioPourty') === 'true';
}

function getMarioPourtyBonus(rank, total) {
  let bonuses = [];
  if (total >= 2 && total <= 4) bonuses = [10,5,3,0];
  else if (total === 5) bonuses = [10,6,3,1,0];
  else if (total === 6) bonuses = [11,8,5,2,1,0];
  const value = bonuses[rank - 1] ?? 0;
  return `${value >= 0 ? '+' : ''}${value}ac`;
}

function setACText(pill, rank, total) {
  pill.dataset.pourtyRank=String(rank);
  let acBadge = pill.querySelector('.ac-badge');
  if (!acBadge) {
    acBadge = document.createElement('span');
    acBadge.className = 'ac-badge';
    pill.appendChild(acBadge);
  }
  if (marioPourtyEnabled()) {
    acBadge.textContent = getMarioPourtyBonus(rank, total);
    acBadge.style.display = 'inline-block';
  } else {
    acBadge.style.display = 'none';
  }
}

function buildPlayersFooter() {
  const root = document.createElement('div');
  root.className = 'player-bar';

  let players = [];
  try {
    const stored = localStorage.getItem('mini-Jeux-host-players');
    players = stored ? JSON.parse(stored) : [];
  } catch (e) {
    players = [];
  }

  if (!players.length) {
    const msg = document.createElement('div');
    msg.className = 'player-pill';
    msg.textContent = 'Aucun joueur enregistré.';
    root.appendChild(msg);
    document.body.appendChild(root);
    return;
  }

  players.forEach((p, playerIndex) => {
    const item = document.createElement('div');
    item.className = 'player-pill';
    item.dataset.pourtyPlayerIndex = String(playerIndex);
    item.style.flex = '1 1 0';
    item.style.minWidth = '120px';

    const circle = document.createElement('span');
    circle.className = 'player-circle';
    circle.style.backgroundColor = p.color || '#ccc';

    const text = document.createElement('span');
    text.textContent = p.name;

    item.appendChild(circle);
    item.appendChild(text);
    root.appendChild(item);
  });

  document.body.appendChild(root);
}

window.addEventListener('load', buildPlayersFooter);