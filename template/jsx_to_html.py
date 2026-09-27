#!/usr/bin/env python3
"""Deterministically convert a self-contained MarketMatrix .jsx into a standalone
.html twin. No model involvement -> no drift.

Robustness guarantees:
  * Strips the ESM `import React ...` (and any other import) and exposes hooks
    from the global UMD React, so no `import` statement survives in the page.
  * Pins React / ReactDOM / Babel to exact versions (an UNPINNED @babel/standalone
    is what broke the reports: its default JSX runtime flipped to "automatic",
    which emits `import {jsx} from "react/jsx-runtime"` and dies in a classic script).
  * Forces Babel's *classic* runtime explicitly (React.createElement), so even a
    future Babel default change cannot reintroduce that import.
  * Shows a visible error instead of hanging on "Loading..." if anything fails.
  * Loads the libraries with per-file timeouts and a CDN fallback (jsDelivr -> unpkg),
    then a Retry button, so one stalled download can't freeze the page.

Usage:  python3 template/jsx_to_html.py <file.jsx> [<file2.jsx> ...]
"""
import sys, os, re

WRAPPER = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>US Market Pulse — Recency × Impact Matrix</title>
<style>
  html, body { margin: 0; background: #0b0f1a; }
  body { padding: 16px; -webkit-text-size-adjust: 100%; }
  #root { max-width: 1000px; margin: 0 auto; }
  .boot { color:#64748b; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; text-align:center; padding:40px 16px; font-size:14px; }
  .err  { color:#f87171; font-family:ui-monospace,monospace; white-space:pre-wrap; padding:16px; font-size:12px; }
  .retry { background:#818cf8; color:#0b0f1a; border:0; border-radius:8px; padding:10px 22px; font-size:14px; font-weight:700; cursor:pointer; }
</style>
</head>
<body>
<div id="root"><div class="boot">Loading market matrix…</div></div>
<script id="jsx-source" type="text/plain">
__SRC__

ReactDOM.createRoot(document.getElementById("root")).render(<__COMP__ />);
</script>
<script>
  (function () {
    // Libraries are loaded here rather than with blocking <script src> tags: a stalled
    // CDN request (common on mobile) used to leave the page on "Loading..." forever.
    // Each library gets a timeout and falls back to another CDN; if all fail, a Retry button shows.
    var CDNS = ["https://cdn.jsdelivr.net/npm/", "https://unpkg.com/", "https://cdn.jsdelivr.net/npm/"];
    var LIB = {
      react: "react@18.3.1/umd/react.production.min.js",
      dom:   "react-dom@18.3.1/umd/react-dom.production.min.js",
      babel: "@babel/standalone@7.24.7/babel.min.js"
    };
    var root = document.getElementById("root");
    var dead = false;

    function status(msg) { var b = root.querySelector(".boot"); if (b) b.textContent = msg; }
    function fail(msg) {
      if (dead) return; dead = true;
      root.innerHTML = '<div class="err"></div><div class="boot"><button class="retry">Retry</button></div>';
      root.querySelector(".err").textContent = msg;
      root.querySelector(".retry").onclick = function () { location.reload(); };
    }

    function load(path, globalName, timeoutMs, done) {
      var attempt = 0, finished = false;
      function next() {
        if (dead || finished) return;
        if (attempt >= CDNS.length) {
          finished = true;
          done(new Error("Could not load " + path + " — the connection is too slow or blocked."));
          return;
        }
        if (attempt > 0) status("Slow connection — retrying from a backup server…");
        var settled = false, s = document.createElement("script");
        var timer = setTimeout(function () { settle(false); }, timeoutMs);
        function settle(ok) {
          if (settled || finished) return;
          settled = true; clearTimeout(timer); s.onload = s.onerror = null;
          if (ok && window[globalName]) { finished = true; done(null); } else next();
        }
        s.onload = function () { settle(true); };
        s.onerror = function () { settle(false); };
        s.src = CDNS[attempt++] + path;
        document.head.appendChild(s);
      }
      next();
    }

    var R, RD, B, pending = 2;
    function ready(err) {
      if (err) { fail(err.message); return; }
      if (--pending === 0) boot();
    }
    function boot() {
      try {
        var src = document.getElementById("jsx-source").textContent;
        var out = B.transform(src, { presets: [["react", { runtime: "classic" }]] }).code;
        new Function("React", "ReactDOM", out)(R, RD);
      } catch (e) {
        fail("Render error: " + (e && e.message ? e.message : e));
        console.error(e);
      }
    }
    window.addEventListener("error", function (e) {
      if (root.querySelector(".boot") && !root.querySelector(".retry")) fail("Render error: " + e.message);
    });

    load(LIB.react, "React", 10000, function (err) {
      if (err) return ready(err);
      load(LIB.dom, "ReactDOM", 10000, function (err2) {
        // Capture the React instance ReactDOM bound to, so a late duplicate download can't split them.
        if (!err2) { R = window.React; RD = window.ReactDOM; }
        ready(err2);
      });
    });
    load(LIB.babel, "Babel", 20000, function (err) {
      if (!err) B = window.Babel;
      ready(err);
    });
  })();
</script>
</body>
</html>
'''


def convert(jsx_path):
    with open(jsx_path, encoding="utf-8") as f:
        original = f.read()
    src = original

    # `import React, { useState, useMemo } from "react";` -> `const { useState, useMemo } = React;`
    src = re.sub(
        r'(?m)^[ \t]*import\s+React\s*,\s*\{([^}]*)\}\s*from\s*["\']react["\'];?[ \t]*$',
        lambda m: "const {" + m.group(1) + "} = React;", src, count=1)
    # `import { useState, useMemo } from "react";` (no React) -> `const { useState, useMemo } = React;`
    src = re.sub(
        r'(?m)^[ \t]*import\s*\{([^}]*)\}\s*from\s*["\']react["\'];?[ \t]*$',
        lambda m: "const {" + m.group(1) + "} = React;", src, count=1)
    # `import React from "react";` / `import * as React from "react";` -> drop (React is the global UMD)
    src = re.sub(r'(?m)^[ \t]*import\s+(?:\*\s+as\s+)?React\s+from\s*["\']react["\'];?[ \t]*$', "", src, count=1)
    # any other ESM import line -> drop (defensive; none expected — reports use no third-party libs)
    src = re.sub(r'(?m)^[ \t]*import\s+.*?from\s*["\'][^"\']+["\'];?[ \t]*$', "", src)

    # detect the default-exported component name so render(<NAME />) is always correct
    m = (re.search(r'export\s+default\s+function\s+(\w+)', original)
         or re.search(r'export\s+default\s+(\w+)\s*;', original))
    comp = m.group(1) if m else "App"

    # strip the export keyword(s), keeping the declaration
    src = re.sub(r'export\s+default\s+function', "function", src, count=1)
    src = re.sub(r'(?m)^[ \t]*export\s+default\s+\w+\s*;[ \t]*$', "", src)
    src = re.sub(r'(?m)^[ \t]*export\s+default\s+', "", src)

    leftover = [l for l in src.splitlines() if l.lstrip().startswith("import ")]
    if leftover:
        raise SystemExit(jsx_path + ": leftover import(s) after conversion: " + repr(leftover[:3]))

    html = WRAPPER.replace("__SRC__", src).replace("__COMP__", comp)
    out_path = os.path.splitext(jsx_path)[0] + ".html"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    return out_path, comp


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: jsx_to_html.py <file.jsx> [<file2.jsx> ...]")
    for p in sys.argv[1:]:
        out, comp = convert(p)
        print("wrote", out, "(<%s />)" % comp)
