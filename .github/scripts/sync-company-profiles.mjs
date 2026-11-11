import fs from "node:fs/promises";
const companies=[
["rockstar-games","Rockstar Games",["Rockstar Games"],"https://www.rockstargames.com/"],
["ubisoft","Ubisoft",["Ubisoft Entertainment"],"https://www.ubisoft.com/"],
["electronic-arts","Electronic Arts",["Electronic Arts"],"https://www.ea.com/"],
["nintendo","Nintendo",["Nintendo"],"https://www.nintendo.com/"],
["playstation-studios","PlayStation Studios",["Sony Interactive Entertainment"],"https://www.playstation.com/"],
["xbox-game-studios","Xbox Game Studios",["Xbox Game Studios","Microsoft Studios"],"https://www.xbox.com/"],
["sega","SEGA",["Sega","Sega Corporation"],"https://www.sega.com/"],
["capcom","Capcom",["Capcom"],"https://www.capcom.com/"],
["bandai-namco","Bandai Namco",["Bandai Namco Entertainment"],"https://www.bandainamcoent.com/"],
["konami","Konami",["Konami Digital Entertainment"],"https://www.konami.com/"],
["take-two","Take-Two Interactive / 2K",["Take-Two Interactive","2K"],"https://www.take2games.com/"],
["warner-bros-games","Warner Bros. Games",["Warner Bros. Interactive Entertainment","Warner Bros. Games"],"https://www.wbgames.com/"],
["bethesda","Bethesda",["Bethesda Softworks"],"https://bethesda.net/"],
["activision-blizzard","Activision / Blizzard",["Activision","Blizzard Entertainment"],"https://www.activision.com/"],
["square-enix","Square Enix",["Square Enix"],"https://www.square-enix-games.com/"],
["cd-projekt","CD Projekt",["CD Projekt Red","CD Projekt"],"https://www.cdprojekt.com/"],
["kojima-productions","Kojima Productions",["Kojima Productions"],"https://www.kojimaproductions.jp/en/"],
["fromsoftware","FromSoftware",["FromSoftware"],"https://www.fromsoftware.jp/"],
].map(([id,name,aliases,website])=>({id,name,aliases,website}));
const clientId=process.env.IGDB_CLIENT_ID,secret=process.env.IGDB_CLIENT_SECRET;if(!clientId||!secret)throw Error("Missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET.");
const auth=await fetch("https://id.twitch.tv/oauth2/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:secret,grant_type:"client_credentials"})});if(!auth.ok)throw Error("IGDB auth failed: "+auth.status);const token=(await auth.json()).access_token;
async function api(path,body){const r=await fetch("https://api.igdb.com/v4/"+path,{method:"POST",headers:{"Client-ID":clientId,Authorization:"Bearer "+token,"Content-Type":"text/plain"},body});if(!r.ok)throw Error("IGDB "+path+" failed: "+r.status+" "+(await r.text()).slice(0,250));return r.json();}
const esc=s=>String(s).replace(/\\/g,"\\\\").replace(/"/g,'\\"'),result=[];
for(const c of companies){const found=[];for(const alias of c.aliases){for(const row of await api("companies",'fields name,description,start_date,parent.name,logo.image_id,developed,published; where name = "'+esc(alias)+'"; limit 5;'))if(!found.some(x=>x.id===row.id))found.push(row);}
 const ids=[...new Set(found.flatMap(x=>[...(x.developed||[]),...(x.published||[])]))],games=[];
 for(let i=0;i<ids.length;i+=100){const batch=ids.slice(i,i+100),rows=await api("games",'fields name,first_release_date,cover.image_id,platforms.name,release_dates.date,release_dates.human; where id = ('+batch.join(",")+'); limit 100;');
  for(const g of rows){const dates=(g.release_dates||[]).filter(x=>x.date).sort((a,b)=>a.date-b.date),stamp=dates[0]?.date||g.first_release_date||null,d=stamp?new Date(stamp*1000):null;games.push({id:g.id,title:g.name,release_date:d?d.toISOString().slice(0,10):null,release_label:dates[0]?.human||(d?String(d.getUTCFullYear()):"Date not listed"),platforms:[...new Set((g.platforms||[]).map(p=>p.name).filter(Boolean))],artwork_url:g.cover?.image_id?"https://images.igdb.com/igdb/image/upload/t_cover_big/"+g.cover.image_id+".jpg":null,developer:found.some(x=>(x.developed||[]).includes(g.id)),publisher:found.some(x=>(x.published||[]).includes(g.id))});}}
 const p=found[0],founded=p?.start_date?new Date(p.start_date*1000).getUTCFullYear():null;
 result.push({id:c.id,name:c.name,website:c.website,description:p?.description||"",founded,parent_name:p?.parent?.name||null,logo_url:p?.logo?.image_id?"https://images.igdb.com/igdb/image/upload/t_logo_med/"+p.logo.image_id+".png":null,releases:[...new Map(games.map(g=>[g.id,g])).values()].sort((a,b)=>(b.release_date||"").localeCompare(a.release_date||""))});
}
await fs.writeFile("data/company-profiles.json",JSON.stringify({schema_version:1,source:"IGDB",updated_at:new Date().toISOString(),companies:result},null,2)+"\n");console.log("Updated "+result.length+" company profiles.");
