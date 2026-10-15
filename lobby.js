(() => {
  'use strict';
  // getRandomValues is also available on HTTP LAN addresses.
  const playerId = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), value => value.toString(16).padStart(2, '0')).join('');
  const key = 'mini-Jeux-host-players';
  const palette = ['#7c8cff', '#ff7b97', '#51cdb4', '#ffc478', '#ba91fa', '#66baff'];
  const home = document.body.dataset.page === 'home';
  let players = [];
  let editing = null;
  const byId = id => document.getElementById(id);
  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      const valid = Array.isArray(saved) ? saved.filter(p => p && typeof p.name === 'string' && p.name.trim() && /^#[0-9a-f]{6}$/i.test(p.color)).slice(0, 6) : [];
      if(home && valid.some(p=>!p.connectionId)){valid.forEach(p=>p.connectionId ||= playerId());localStorage.setItem(key,JSON.stringify(valid));}
      return valid;
    } catch { return []; }
  }
  function commit(next) {
    try { localStorage.setItem(key, JSON.stringify(next)); players = next; window.dispatchEvent(new Event('pourty-roster-changed')); return true; }
    catch { byId('player-feedback').textContent = 'Le navigateur empêche la sauvegarde. Autorise le stockage pour continuer.'; return false; }
  }
  function resetForm() {
    editing = null;
    byId('player-form').reset();
    byId('player-color').value = palette.find(color => !players.some(p => p.color === color)) || palette[0];
    byId('form-label').textContent = 'Ajouter un joueur';
    byId('save-player').textContent = '+ Ajouter';
    byId('cancel-edit').hidden = true;
  }
  function render() {
    const list = byId('players-list');
    list.replaceChildren();
    players.forEach((player, index) => {
      const row = document.createElement('div'); row.className = 'roster-row';
      const avatar = document.createElement('span'); avatar.className = 'player-avatar'; avatar.style.setProperty('--player-color', player.color); avatar.textContent = player.name.trim().slice(0, 1).toUpperCase();
      const name = document.createElement('span'); name.className = 'roster-name'; name.textContent = player.name;
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'icon-button'; edit.textContent = '✎'; edit.setAttribute('aria-label', `Modifier ${player.name}`); edit.title = `Modifier ${player.name}`;
      edit.addEventListener('click', () => {
        editing = index; byId('player-name').value = player.name; byId('player-color').value = player.color;
        byId('form-label').textContent = 'Modifier le joueur'; byId('save-player').textContent = 'Enregistrer'; byId('cancel-edit').hidden = false; byId('player-feedback').textContent = ''; render(); byId('player-name').focus();
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button remove-player'; remove.textContent = '×'; remove.setAttribute('aria-label', `Supprimer ${player.name}`); remove.title = `Supprimer ${player.name}`;
      remove.addEventListener('click', () => { if (commit(players.filter((_, i) => i !== index))) { resetForm(); render(); byId('player-feedback').textContent = `${player.name} a été retiré de l’équipe.`; } });
      row.append(avatar, name, edit, remove); list.append(row);
    });
    byId('player-count').textContent = `${players.length} / 6`;
    byId('ready-status').textContent = players.length ? `${players.length} joueur${players.length > 1 ? 's' : ''} prêt${players.length > 1 ? 's' : ''} à jouer` : 'Crée un joueur pour commencer';
    byId('ready-dot').classList.toggle('is-ready', players.length > 0);
    const full = players.length >= 6 && editing === null;
    byId('save-player').disabled = full; byId('player-name').disabled = full; byId('player-color').disabled = full;
    if (full) byId('save-player').textContent = 'Équipe complète';
  }
  function sync() {
    players = read();
    if (!home) {
      if (!players.length) { location.replace('index.html?players=required'); return; }
      const summary = byId('team-summary');
      if (summary) summary.textContent = `${players.length} joueur${players.length > 1 ? 's' : ''} · ${players.map(p => p.name).join(' / ')}`;
      return;
    }
    resetForm(); render();
    if (!players.length || location.hash === '#players' || location.search.includes('players=required')) byId('players-menu').open = true;
  }
  if (home) {
    byId('player-form').addEventListener('submit', event => {
      event.preventDefault();
      const name = byId('player-name').value.trim().slice(0, 20);
      if (!name) { byId('player-feedback').textContent = 'Choisis un nom pour ce joueur.'; byId('player-name').focus(); return; }
      if (editing === null && players.length >= 6) return;
      const next = players.slice();
      const player = { ...(editing !== null ? players[editing] : {}), connectionId: editing !== null ? (players[editing].connectionId || playerId()) : playerId(), name, color: byId('player-color').value };
      if (editing === null) next.push(player); else next[editing] = player;
      if (commit(next)) { resetForm(); render(); byId('player-feedback').textContent = `${name} est prêt à jouer.`; if (players.length < 6) byId('player-name').focus(); }
    });
    byId('cancel-edit').addEventListener('click', () => { resetForm(); render(); });
    document.querySelectorAll('[data-play]').forEach(link => link.addEventListener('click', event => {
      players = read();
      if (players.length) return;
      event.preventDefault(); resetForm(); render(); byId('players-menu').open = true;
      byId('player-feedback').textContent = 'Ajoute au moins un joueur avant de continuer.'; byId('player-name').focus();
    }));
  }
  sync();
  window.addEventListener('pageshow', sync);
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) sync(); });
})();
