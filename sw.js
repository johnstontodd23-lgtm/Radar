/* Storm Watch service worker — offline support */
var SHELL_CACHE = "shell-v7";
var TILE_CACHE = "tiles-v7";
var DATA_CACHE = "data-v7";

var SHELL_URLS = [
  "./",
  "./index.html",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function(c){ return c.addAll(SHELL_URLS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k !== SHELL_CACHE && k !== TILE_CACHE && k !== DATA_CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function isTile(url){
  return url.indexOf("arcgisonline.com") >= 0 || url.indexOf("mesonet.agron.iastate.edu") >= 0;
}
function isWeatherAPI(url){
  return url.indexOf("api.weather.gov") >= 0;
}

self.addEventListener("fetch", function(e){
  var url = e.request.url;
  if (e.request.method !== "GET") return;

  // Map + radar tiles: cache-first so browsed areas work offline,
  // refresh in the background when online.
  if (isTile(url)) {
    e.respondWith(
      caches.open(TILE_CACHE).then(function(c){
        return c.match(e.request).then(function(hit){
          var net = fetch(e.request).then(function(res){
            if (res && (res.ok || res.type === "opaque")) c.put(e.request, res.clone());
            return res;
          }).catch(function(){ return hit; });
          return hit || net;
        });
      })
    );
    return;
  }

  // Weather data: network-first for freshness, cached copy when offline.
  if (isWeatherAPI(url)) {
    e.respondWith(
      caches.open(DATA_CACHE).then(function(c){
        return fetch(e.request).then(function(res){
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(function(){
          return c.match(e.request).then(function(hit){
            return hit || new Response("{}", { headers: { "Content-Type": "application/json" } });
          });
        });
      })
    );
    return;
  }

  // App shell: cache-first with background refresh.
  e.respondWith(
    caches.open(SHELL_CACHE).then(function(c){
      return c.match(e.request, { ignoreSearch: true }).then(function(hit){
        var net = fetch(e.request).then(function(res){
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(function(){ return hit; });
        return hit || net;
      });
    })
  );
});
