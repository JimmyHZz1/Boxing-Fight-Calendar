const CACHE="sports-calendar-v156";
const APP_FILES=[
  "./",
  "./index.html",
  "./styles.css?v=20261112-03",
  "./app.js?v=20261112-01",
  "./sports-data.js?v=20261111-04",
  "./sports.js?v=20261111-04",
  "./sports-hub.js?v=20261109-08",
  "./sports-nav.js?v=20261111-03",
  "./sport-pages.js?v=20261109-06",
  "./speedway.js?v=20261111-02",
  "./sports-v11.js?v=20261111-07",
  "./sports-weekend.js?v=20261108-02",
  "./favourites.js?v=20261109-02",
  "./ui-refresh.js?v=20261109-01",
  "./home-next-up.js?v=20261111-02",
  "./version-history.js?v=20261109-01",
  "./f1-grand-prix-centre.js?v=20261109-03",
  "./games-calendar.js?v=20261112-01",
  "./games-popularity.js?v=20261110-07",
  "./games-discovery.js?v=20261111-07",
  "./notifications.js?v=20261111-02",
  "./data-health.js?v=20261111-02",
  "./admin-updates.js?v=20261111-02",
  "./assets/platform-playstation.svg",
  "./assets/platform-xbox.svg",
  "./assets/platform-nintendo.svg",
  "./assets/platform-steam.svg",
  "./assets/platform-windows.svg",
  "./data/games-discovery.json",
  "./manifest.json",
  "./data/games-featured.json",
  "./data/games-popularity.json",
  "./data/speedway.json"
];
const DATA_PATHS=["/data/fights.json","/data/fighter-images.json","/data/event-fighter-images.json","/data/f1.json","/data/darts.json","/data/ufc.json","/data/bkfc.json","/data/sports-hub.json","/data/sports-images.json","/data/image-library.json","/data/games-featured.json","/data/games-popularity.json","/data/games-discovery.json","/data/company-profiles.json","/data/speedway.json"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin)return;
  if(DATA_PATHS.some(path=>url.pathname.endsWith(path))){
    event.respondWith(fetch(request,{cache:"no-store"}).catch(()=>caches.match(request)));
    return;
  }
  const isAppAsset=url.pathname.endsWith("/")||/\.(html|css|js|json|png|jpe?g|webp|svg|gif)$/.test(url.pathname);
  if(!isAppAsset)return;
  event.respondWith((async()=>{
    const cached=await caches.match(request);
    try{
      const response=await fetch(request,{cache:"no-store"});
      if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
      return response;
    }catch(error){
      if(cached)return cached;
      throw error;
    }
  })());
});
