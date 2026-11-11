import fs from "node:fs/promises";

const companies = [
  ["rockstar-games","Rockstar Games",["Rockstar Games"],"https://www.rockstargames.com/"],
  ["ubisoft","Ubisoft",["Ubisoft","Ubisoft Entertainment"],"https://www.ubisoft.com/"],
  ["electronic-arts","Electronic Arts",["Electronic Arts","EA"],"https://www.ea.com/"],
  ["nintendo","Nintendo",["Nintendo"],"https://www.nintendo.com/"],
  ["playstation-studios","PlayStation Studios",["Sony Interactive Entertainment","PlayStation Studios"],"https://www.playstation.com/"],
  ["xbox-game-studios","Xbox Game Studios",["Xbox Game Studios","Microsoft Studios"],"https://www.xbox.com/"],
  ["sega","SEGA",["Sega","Sega Corporation"],"https://www.sega.com/"],
  ["capcom","Capcom",["Capcom"],"https://www.capcom.com/"],
  ["bandai-namco","Bandai Namco",["Bandai Namco Entertainment","Bandai Namco"],"https://www.bandainamcoent.com/"],
  ["konami","Konami",["Konami Digital Entertainment","Konami"],"https://www.konami.com/"],
  ["take-two","Take-Two Interactive / 2K",["Take-Two Interactive","2K"],"https://www.take2games.com/"],
  ["warner-bros-games","Warner Bros. Games",["Warner Bros. Interactive Entertainment","Warner Bros. Games"],"https://www.wbgames.com/"],
  ["bethesda","Bethesda",["Bethesda Softworks","Bethesda Game Studios"],"https://bethesda.net/"],
  ["activision-blizzard","Activision / Blizzard",["Activision","Blizzard Entertainment"],"https://www.activision.com/"],
  ["square-enix","Square Enix",["Square Enix"],"https://www.square-enix-games.com/"],
  ["cd-projekt","CD Projekt",["CD Projekt Red","CD Projekt"],"https://www.cdprojekt.com/"],
  ["kojima-productions","Kojima Productions",["Kojima Productions"],"https://www.kojimaproductions.jp/en/"],
  ["fromsoftware","FromSoftware",["FromSoftware"],"https://www.fromsoftware.jp/"]
].map(([id,name,aliases,website])=>({id,name,aliases,website}));

const clientId=process.env.IGDB_CLIENT_ID,secret=process.env.IGDB_CLIENT_SECRET;
if(!clientId||!secret) throw Error("Missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET.");
const auth=await fetch("https://id.twitch.tv/oauth2/token",{
  method:"POST",
  headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({client_id:clientId,client_secret:secret,grant_type:"client_credentials"})
});
if(!auth.ok) throw Error("IGDB authentication failed: "+auth.status);
const token=(await auth.json()).access_token;
let lastRequestAt=0;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,body){
  const wait=Math.max(0,260-(Date.now()-lastRequestAt));
  if(wait) await pause(wait);
  lastRequestAt=Date.now();
  for(let attempt=0;attempt<4;attempt++){
    const response=await fetch("https://api.igdb.com/v4/"+path,{
      method:"POST",
      headers:{"Client-ID":clientId,Authorization:"Bearer "+token,"Content-Type":"text/plain"},
      body
    });
    if(response.ok) return response.json();
    const retryable=response.status===429||response.status>=500;
    if(!retryable||attempt===3) throw Error("IGDB "+path+" failed: "+response.status+" "+(await response.text()).slice(0,220));
    const retryAfter=Number(response.headers.get("retry-after"))||Math.pow(2,attempt+1);
    await pause(retryAfter*1000);
  }
  return [];
}
const esc=value=>String(value).replace(/\\/g,"\\\\").replace(/"/g,'\\"');
const pcConsole=/pc|windows|mac|linux|steam|playstation|xbox|nintendo|switch|wii|game boy|gamecube|dreamcast|saturn|mega drive|genesis|atari|commodore|amiga|neo geo|sega|super nes|nes|famicom|master system/i;
const result=[];
for(const company of companies){
  const roots=[];
  for(const alias of company.aliases){
    const rows=await api("companies",'fields name,description,start_date,parent,logo.image_id,developed,published; where name = "'+esc(alias)+'"; limit 10;');
    for(const row of rows) if(!roots.some(item=>item.id===row.id)) roots.push(row);
  }
  const entities=[...roots];
  // Only import explicitly matched company records. Broad parent-child expansion
  // pulled unrelated subsidiaries into profiles and made the browser payload enormous.
  const gameCredits=new Map();
  for(const entity of entities){
    for(const [role,ids] of [["developer",entity.developed||[]],["publisher",entity.published||[]]]){
      for(const id of ids){
        const credit=gameCredits.get(id)||{developer:false,publisher:false,credit_names:[]};
        credit[role]=true;
        if(entity.name&&!credit.credit_names.includes(entity.name)) credit.credit_names.push(entity.name);
        gameCredits.set(id,credit);
      }
    }
  }
  const ids=[...gameCredits.keys()],games=[];
  for(let offset=0;offset<ids.length;offset+=100){
    const batch=ids.slice(offset,offset+100);
    const rows=await api("games",'fields name,first_release_date,cover.image_id,platforms.name,release_dates.date,release_dates.human; where id = ('+batch.join(",")+'); limit 100;');
    for(const game of rows){
      const platforms=[...new Set((game.platforms||[]).map(item=>item.name).filter(name=>name&&pcConsole.test(name)))];
      if(!platforms.length) continue;
      const dates=(game.release_dates||[]).filter(item=>item.date).sort((a,b)=>a.date-b.date);
      const timestamp=dates[0]?.date||game.first_release_date||null;
      const date=timestamp?new Date(timestamp*1000):null;
      const credit=gameCredits.get(game.id)||{};
      games.push({
        igdb_id:game.id,title:game.name,
        release_date:date?date.toISOString().slice(0,10):null,
        release_label:dates[0]?.human||(date?String(date.getUTCFullYear()):"Date not listed"),
        platforms,
        artwork_url:game.cover?.image_id?"https://images.igdb.com/igdb/image/upload/t_cover_big/"+game.cover.image_id+".jpg":null,
        developer:Boolean(credit.developer),publisher:Boolean(credit.publisher),
        credited_companies:credit.credit_names||[]
      });
    }
  }
  const parentIds=[...new Set(roots.map(item=>item.parent).filter(Boolean))];
  let parentName=null;
  if(parentIds.length){
    const parents=await api("companies","fields name; where id = ("+parentIds.join(",")+"); limit 20;");
    parentName=parents.map(item=>item.name).filter(Boolean).join(" / ")||null;
  }
  const primary=roots[0];
  const founded=primary?.start_date?new Date(primary.start_date*1000).getUTCFullYear():null;
  const allUniqueGames=[...new Map(games.map(game=>[game.igdb_id,game])).values()];
  const today=new Date().toISOString().slice(0,10);
  const upcomingGames=allUniqueGames.filter(game=>game.release_date&&game.release_date>=today)
    .sort((a,b)=>a.release_date.localeCompare(b.release_date)||a.title.localeCompare(b.title));
  const previousGames=allUniqueGames.filter(game=>!game.release_date||game.release_date<today)
    .sort((a,b)=>(b.release_date||"").localeCompare(a.release_date||"")||a.title.localeCompare(b.title)).slice(0,100);
  const uniqueGames=[...upcomingGames,...previousGames];
  result.push({
    id:company.id,name:company.name,aliases:company.aliases,website:company.website,
    igdb_company_ids:entities.map(item=>item.id),description:primary?.description||"",
    founded,parent_name:parentName,
    logo_url:primary?.logo?.image_id?"https://images.igdb.com/igdb/image/upload/t_logo_med/"+primary.logo.image_id+".png":null,
    releases:uniqueGames
  });
  console.log(company.name+": "+uniqueGames.length+" PC/console games across "+entities.length+" IGDB company records");
}
if(result.every(company=>!company.releases.length)) throw Error("IGDB returned no PC/console releases; refusing to overwrite the existing catalogue with empty data.");
const output={schema_version:2,source:"IGDB",updated_at:new Date().toISOString(),companies:result};
const serialized=JSON.stringify(output);
const bytes=Buffer.byteLength(serialized,"utf8");
if(bytes>1_500_000) throw Error("Company profile catalogue exceeds the 1.5 MB browser payload limit ("+bytes+" bytes); refusing to publish it.");
await fs.writeFile("data/company-profiles.json",serialized+"\n");
const total=result.reduce((sum,company)=>sum+company.releases.length,0);
console.log("Updated "+result.length+" major company profiles with "+total+" company/game entries.");
