#!/usr/bin/env python3
# Dev server with aggressive no-cache headers.
#
# The Python stdlib http.server sends no Cache-Control header, so browsers fall
# back to heuristic caching and happily serve stale ESM modules during dev
# iteration. This wrapper adds `Cache-Control: no-store, must-revalidate` plus
# `Pragma: no-cache` and `Expires: 0` to every response — equivalent to what
# Chrome's "Disable cache" devtools checkbox does, but server-side, so it works
# in any browser without the inspector open.
#
# Usage: python3 scripts/dev-server.py [port]
#        python3 scripts/dev-server.py            # defaults to 8765

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    with ThreadingHTTPServer(("", port), NoCacheHandler) as httpd:
        print(f"dev server (no-cache) on http://localhost:{port}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print()


if __name__ == "__main__":
    main()
