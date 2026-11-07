const CACHE="sports-calendar-v33";
const APP_FILES=[
  "./",
  "./index.html",
  "./styles.css?v=20261107-33",
  "./app.js?v=20261107-26",
  "./sports-data.js?v=20261107-03",
  "./sports.js?v=20261107-06",
  "./sports-hub.js?v=20261107-01",
  "./manifest.json"
];
const DATA_PATHS=["/data/fights.json","/data/fighter-images.json","/data/f1.json","/data/darts.json","/data/ufc.json","/data/sports-hub.json"];
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
  const isAppAsset=url.pathname.endsWith("/")||/\.(html|css|js|json)$/.test(url.pathname);
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
