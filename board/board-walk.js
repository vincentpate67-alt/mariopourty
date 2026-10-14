(() => {
  class BoardWalk {
    constructor(canvas, board, onChange) { this.canvas = canvas; this.board = board; this.onChange = onChange; this.current = board.startId; this.busy = false; this.frame = null; this.stopped = false; }
    start() { const node = this.board.nodes.find(n => n.id === this.current); if (!node) return; this.canvas.center(node.x, node.y, 1.15); this.canvas.render(this.board, null, null, node); this.onChange(node, this.options()); }
    options() { return this.board.edges.filter(edge => edge.from === this.current).map(edge => this.board.nodes.find(n => n.id === edge.to)); }
    go(id) {
      if (this.busy || this.stopped || !this.options().some(n => n.id === id)) return;
      const from = this.board.nodes.find(n => n.id === this.current), to = this.board.nodes.find(n => n.id === id); this.busy = true;
      this.onChange(from, []);
      const start = performance.now(), duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
      const animate = now => {
        if (this.stopped) return;
        const t = duration ? Math.min(1, (now - start) / duration) : 1, eased = t * t * (3 - 2 * t), pawn = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
        this.canvas.center(pawn.x, pawn.y, 1.15); this.canvas.render(this.board, null, null, pawn);
        if (t < 1) this.frame = requestAnimationFrame(animate);
        else { this.current = id; this.busy = false; this.onChange(to, this.options()); }
      }; this.frame = requestAnimationFrame(animate);
    }
    stop() { this.stopped = true; cancelAnimationFrame(this.frame); }
  }
  window.PourtyBoardWalk = BoardWalk;
})();
