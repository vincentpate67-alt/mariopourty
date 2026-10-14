"""Serve the site's public files for local phone tests, without uploading to GitHub."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
from urllib.parse import unquote, urlsplit
import webbrowser

ROOT = Path(__file__).resolve().parent.parent


class SiteHandler(SimpleHTTPRequestHandler):
    def allowed(self):
        path = unquote(urlsplit(self.path).path)
        parts = path.replace('\\', '/').split('/')
        if any(p.startswith('.') or p.lower() in {'save', 'node_modules', 'scripts'} for p in parts if p):
            return False
        target = Path(self.translate_path(self.path)).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            return False
        return target.suffix.lower() not in {'.pem', '.key', '.cmd', '.ps1', '.py', '.bak', '.log'}

    def do_GET(self):
        if not self.allowed():
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if not self.allowed():
            self.send_error(404)
            return
        super().do_HEAD()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def local_address():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
            # Route lookup only; no packet is sent.
            connection.connect(('192.0.2.1', 9))
            return connection.getsockname()[0]
    except OSError:
        return '127.0.0.1'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--bind', default='0.0.0.0')
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    handler = functools.partial(SiteHandler, directory=str(ROOT))
    try:
        server = ThreadingHTTPServer((args.bind, args.port), handler)
    except OSError:
        print('Impossible de lancer le serveur : le port est peut-etre deja utilise.')
        return 1
    url = 'http://' + local_address() + ':' + str(server.server_port) + '/'
    print('\nMario Pourty - test local\n')
    print('Adresse du jeu : ' + url)
    print('Telephones : meme Wi-Fi que le PC, puis scanner les QR codes du jeu.')
    print('Modifie tes fichiers puis actualise la page. Aucun envoi sur GitHub.')
    print('Internet reste necessaire pour Firebase et Cloudinary.')
    print('Ferme cette fenetre ou fais Ctrl+C pour arreter.\n', flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
