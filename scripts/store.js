import { writable } from 'svelte/store';
import { persist, cookieStorage } from "@macfja/svelte-persistent-store"
import jQuery from 'jquery';
import { tweened } from 'svelte/motion';
export const pbpVideo = persist(writable(''), cookieStorage(), 'pbpVideo');
export const colorVideo = persist(writable(''), cookieStorage(), 'colorVideo');
export const deskVideo = persist(writable(''), cookieStorage(), 'deskVideo');
export const anal1Video = persist(writable(''), cookieStorage(), 'anal1Video');
export const anal2Video = persist(writable(''), cookieStorage(), 'anal2Video');
export const pbpName = persist(writable(''), cookieStorage(), 'pbpName');
export const colorName = persist(writable(''), cookieStorage(), 'colorName');
export const pbpImage = persist(writable(''), cookieStorage(), 'pbpImage');
export const colorImage = persist(writable(''), cookieStorage(), 'colorImage');
export const tickerInfo = persist(writable(''), cookieStorage(), 'tickerInfo');
export const cameraOption = persist(writable('on'), cookieStorage(), 'cameraOption');
export const vidOption = persist(writable('off'), cookieStorage(), 'vidOption');
export const numb = writable('2');
export const currentScene = writable('desk');
export const casterDisplay = tweened(0, {
  duration: 1000
});;
export const deskDisplay = tweened(0, {
  duration: 1000
});;
export const powerRankings = writable([]);
export const tonightGames = persist(writable([]), cookieStorage(), 'tonightGames');
export const league = writable('');
export const teamPlayers1 = writable([]);
export const teamPlayers2 = writable([]);
export const matchupTeam1 = writable('');
export const matchupTeam1logo = writable('');
export const matchupTeam2 = writable('');
export const matchupTeam2logo = writable('');
export const matchupTeam1Record = writable('');
export const matchupTeam2Record = writable('');
export const matchupTeam1Color = writable('');
export const matchupTeam2Color = writable('');

let stop = false;
import WsSubscribers from '../scripts/ws_subscriber.js';

let teamMap = {
    "ascension": {
      "1": " #ffcf56",
      "2": " #18020c",
      "3": " #000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771051087062630430/Ascension_Logo.png"
    },
    "bulls": {
      "1": "#4c2719",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771051080858468363/Bulls_Logo.png"
    },
    "cobras": {
      "1": "#f49d37",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771051085514539048/Cobras_Logo.png"
    },
    "ducks": {
      "1": "#226f54",
      "2": "#f6aa1c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049884321054720/Ducks_Logo.png"
    },
    "eagles": {
      "1": "#0072bb",
      "2": "#9cf6f6",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049887906791464/Eagles_Logo.png"
    },
    "flames": {
      "1": "#f49d37",
      "2": "#18020c",
      "3": "#f72c25",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/679756528567451683/Flames_Logo.png"
    },
    "hawks": {
      "1": "#f42b03",
      "2": "#000001",
      "3": "#d3d5d7",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049891488464927/Hawks_Logo.png"
    },
    "kings": {
      "1": "#ffd046",
      "2": "#000001",
      "3": "#d3d5d7",
      "logo": "https://cdn.discordapp.com/attachments/324268285703094273/648721158174146580/Kings_Logo.png"
    },
    "lions": {
      "1": "#d3d5d7",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049894517014578/Lions_Logo.png"
    },
    "lumberjacks": {
      "1": "#393a10",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049897256288266/Lumberjacks_Logo.png"
    },
    "panthers": {
      "1": "#f42b03",
      "2": "#890620",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049902117224468/Panthers_Logo.png"
    },
    "pirates": {
      "1": "#960200",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/324268285703094273/641071922712412174/Pirates_Logo.png"
    },
    "sharks": {
      "1": "#1f487e",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049903723511888/Sharks_Logo.png"
    },
    "spartans": {
      "1": "#5f5aa2",
      "2": "#d3d5d7",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049907149865000/Spartans_Logo.png"
    },
    "storm": {
      "1": "#fcba04",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/402228472744902656/469553106393235466/dragon-01-1.png"
    },
    "whitecaps": {
      "1": "#c9f9ff",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049910224814080/Whitecaps_Logo.png"
    },
    "bobcats": {
      "1": "#f42b03",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053393082318858/Bobcats_Logo.png"
    },
    "bulldogs": {
      "1": "#c7ccdb",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053399206264922/Bulldogs_Logo.png"
    },
    "dolphins": {
      "1": "#b8e1ff",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/324268285703094273/648718145338736650/Dolphins_Logo.png"
    },
    "entropy": {
      "1": "#f49d37",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053405337681920/Entropy_Logo.png"
    },
    "geese": {
      "1": "#393a10",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053411755491328/Geese_Logo.png"
    },
    "heat": {
      "1": "#f49d37",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053416562032660/Heat_Logo.png"
    },
    "knights": {
      "1": "#18020c",
      "2": "#e9df00",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053345845674020/Knights_Logo.png"
    },
    "osprey": {
      "1": "#ee2e31",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053352686977064/Osprey_Logo.png"
    },
    "owls": {
      "1": "#4c230a",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/654074318631862282/Owls_Logo.png"
    },
    "pioneers": {
      "1": "#656839",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053359012642816/Pioneers_Logo.png"
    },
    "raiders": {
      "1": "#d3d5d7",
      "2": "#e9df00",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/654074118492389376/Raiders_Logo.png"
    },
    "thunder": {
      "1": "#e9df00",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053364338360340/Thunder_Logo.png"
    },
    "tigers": {
      "1": "#f49d37",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053370752106506/Tigers_Logo.png"
    },
    "trojans": {
      "1": "#18020c",
      "2": "#e9df00",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053378343927848/Trojans_Logo.png"
    },
    "tundra": {
      "1": "#2660a4",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/677666710169583647/Tundra_Logo.png"
    },
    "vipers": {
      "1": "#ff8c42",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053385294020658/Vipers_Logo.png"
    },
    "avalanche": {
      "1": "#000001",
      "2": "#4ecdc4",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/667163655065829403/Avalanche_Logo.png"
    },
    "bandits": {
      "1": "#18020c",
      "2": "#000001",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055539521191997/Bandits_Logo.png"
    },
    "barracuda": {
      "1": "#2660a4",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/768905494941007882/Barracuda_Logo.png"
    },
    "dukes": {
      "1": "#18020c",
      "2": "#881600",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/663779106583740446/Dukes_Logo.png"
    },
    "falcons": {
      "1": "#5bc3eb",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/324268285703094273/648727754711498793/Falcons_Logo.png"
    },
    "herons": {
      "1": "#a4af69",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771069879373660180/Herons_Logo.png"
    },
    "inferno": {
      "1": "#e57c04",
      "2": "#bf1a2f",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055542869295174/Inferno_Logo.png"
    },
    "jaguars": {
      "1": "#f42b03",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055545598869564/Jaguars_Logo_3.png"
    },
    "lightning": {
      "1": "#f7d002",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/768223943085129728/Lightning_Logo.png"
    },
    "lynx": {
      "1": "#18020c",
      "2": "#f7d002",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055549412409354/Lynx_Logo_2.png"
    },
    "mustangs": {
      "1": "#4c1c00",
      "2": "#000001",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055552147095602/Mustangs_Logo_2.png"
    },
    "pulsars": {
      "1": "#32936f",
      "2": "#387d7a",
      "3": "#2bc016",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055554603778068/Pulars2.png"
    },
    "pythons": {
      "1": "#ff8c42",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055558321111080/Pythons_Logo_3.png"
    },
    "voyagers": {
      "1": "#0c8346",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055561604595722/Voyagers_Logo_2.png"
    },
    "vultures": {
      "1": "#587291",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/663389725188423680/Vultures_Logo.png"
    },
    "warriors": {
      "1": "#7c238c",
      "2": "#7c72a0",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055564604178442/Warriors_Logo_2.png"
    },
    "cardinals": {
      "1": "#a22c29",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/663392854227419136/Cardinals_Logo.png"
    },
    "cougars": {
      "1": "#f7b32b",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/324268285703094273/696145820034269224/Cougars_Logo_2.png"
    },
    "embers": {
      "1": "#dc493a",
      "2": "#a22c29",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771072411239972904/Embers_Logo.png"
    },
    "eskimos": {
      "1": "#e3ebff",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/324268285703094273/655261559970594826/Eskimos_Logo.png"
    },
    "genesis": {
      "1": "#4392f1",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/324268285703094273/641101909658173450/genesisfinal2.png"
    },
    "gulls": {
      "1": "#f49d37",
      "2": "#000001",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/324268285703094273/648718182772768768/Gulls_Logo.png"
    },
    "jesters": {
      "1": "#fed766",
      "2": "#2ab7ca",
      "3": "#fe4a49",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/654074080810631178/Jesters_Logo.png"
    },
    "leopards": {
      "1": "#f42b03",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771056600773165146/Leopards_Logo_2.png"
    },
    "miners": {
      "1": "#e8c547",
      "2": "#698f3f",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771056602873724938/Miners_Logo_3.png"
    },
    "pelicans": {
      "1": "#5c80bc",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/663779353095700530/Pelicans_Logo.png"
    },
    "rattlers": {
      "1": "#a2c7e5",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/654740981815574529/Rattlers_Logo.png"
    },
    "ravens": {
      "1": "#bd1e1e",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/663389781732098068/Ravens_Logo.png"
    },
    "stallions": {
      "1": "#d68c45",
      "2": "#e0e0ce",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/654074869943762955/Stallions_Logo.png"
    },
    "tempest": {
      "1": "#e6c229",
      "2": "#000001",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771056606829084702/Tempest_Logo_2.png"
    },
    "titans": {
      "1": "#698f3f",
      "2": "#c1b2ab",
      "3": "#18020c",
      "logo": "https://cdn.discordapp.com/attachments/324268285703094273/648720610704228362/Titans_Logo.png"
    },
    "wranglers": {
      "1": "#ff2e00",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771056608150290462/Wranglers_Logo.png"
    },
    "admirals": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058776466784286/Admirals_Logo.png",
      "1": "#00EDFF"
    },
    "dragons": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058785246511175/Dragons_Logo.png",
      "1": "#DF0600"
    },
    "beavers": {
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/715361176707399741/Beavers_Logo.png",
      "1": "#FFB54A"
    },
    "cyclones": {
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/717733534101668010/Cyclones_Logo.png",
      "1": "#6D94F1"
    },
    "grizzlies": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058779232010250/Bears_Logo.png",
      "1": "#754C24"
    },
    "centurions": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058781915578399/Centurions_Logo.png",
      "1": "#FF7E2A"
    },
    "yellow jackets": {
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/730457373126426654/Yellow_Jackets_logo.png",
      "1": "#FBFF00"
    },
    "galaxy": {
      "logo": "https://cdn.discordapp.com/attachments/755840403080478832/767476330643193886/Galaxy_Logo.png",
      "1": "#CC55FF"
    },
    "sockeyes": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058789113397268/Sockeyes_Logo.png",
      "1": "#DF1900"
    },
    "wolves": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058773192212496/Wolves_Logo.png",
      "1": "#AAFDFF"
    },
    "wildcats": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058794045767730/Wildcats_Logo.png",
      "1": "#2A54FF"
    },
    "rhinos": {
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/734490021079548005/Rhinos_Logo.png",
      "1": "#B3B3B3"
    },
    "scorpions": {
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/730457572397678592/Scorpions_Logo.png",
      "1": "#B40014"
    },
    "thrashers": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058791676117012/Thrashers_Logo.png",
      "1": "#754C24"
    },
    "toucans": {
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/730457120654229584/Toucans_logo.png",
      "1": "#FF9F15"
    },
    "wizards": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058797326106694/Wizards_Logo.png",
      "1": "#A700AA"
    },
    "captains": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060591338061874/Captains_Logo.png",
      "1": "#002FAA"
    },
    "yetis": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060585554378762/Yetis_Logo.png",
      "1": "#36CCCC"
    },
    "otters": {
      "logo": "https://cdn.discordapp.com/attachments/421796377303973888/755863732193591418/Otters_Logo.png",
      "1": "#FFB54A"
    },
    "tides": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060583024820254/Tides_Logo.png",
      "1": "#2AC0FF"
    },
    "pandas": {
      "logo": "https://cdn.discordapp.com/attachments/324268285703094273/730511590088245268/Pandas_Logo.png",
      "1": "#754C24"
    },
    "samurai": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060577840660490/Samurai_Logo.png",
      "1": "#FFC494"
    },
    "hornets": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060644685545512/Hornets_Logo.png",
      "1": "#FBFF00"
    },
    "solar": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771075279300329512/Solar_Logo.png",
      "1": "#FFC31F"
    },
    "piranhas": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060572245983303/Piranhas_Logo.png",
      "1": "#FF0A11"
    },
    "terriers": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060579968090122/Terriers_Logo.png",
      "1": "#F4000D"
    },
    "jackrabbits": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060566437396500/Jackrabbits_Logo_2.png",
      "1": "#3595FF"
    },
    "zebras": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060588239126528/Zebras_Logo.png",
      "1": "#B3B3B3"
    },
    "camels": {
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/738138000264790106/Camels_Logo.png",
      "1": "#666666"
    },
    "raptors": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771079922302713856/Raptors_Logo.png",
      "1": "#C98200"
    },
    "macaws": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060569527681064/Macaws_Logo.png",
      "1": "#2DB400"
    },
    "mages": {
      "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771077495772020751/Mages_Logo.png",
      "1": "#A700AA"
    },
    "turtles": {
      "1": "#ff2e00",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/715062285554548746/Turtles_logo.png"
    },
    "rams": {
      "1": "#ff2e00",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/421796377303973888/758719416321441892/Rams_Logo_2.png"
    },
    "cowboys": {
      "1": "#ff2e00",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/421796377303973888/758723087909781543/Cowboys_Logo_2.png"
    },
    "flowerhorns": {
      "1": "#ff2e00",
      "2": "#18020c",
      "3": "#000001",
      "logo": "https://cdn.discordapp.com/attachments/394574231066640387/715062260480999464/Flowerhorns_Logo.png"
    }
  };

WsSubscribers.subscribe("ws", "open", function() {
    WsSubscribers.send("cb", "first_connect", {
        'name': 'Scorebug'
    });
    setInterval(function () {
        WsSubscribers.send("cb", "heartbeat", "heartbeat");
    }, 1000);
});

WsSubscribers.init(49322, false, [
    "game:update_state",
    "cb:heartbeat"
]);

WsSubscribers.subscribe("sos", "casters_update", (d) => {
    if (d['casters']['left']['obs'] == '') {
      stop = true;
    }else {
      pbpVideo.set(d['casters']['left']['obs']);
      colorVideo.set(d['casters']['right']['obs']);
      stop = true;
    }
    console.log(d['casters']['cams']);
    cameraOption.set(d['casters']['cams']);

});


let game1 = {};
let game2 = {};
let game3 = {};

WsSubscribers.subscribe("sos", "intermission_update", (d) => {
  stop = true;
  var tempAr = '';
  if (d['intermission']['scene'] == '') {
    currentScene.set('default');
  }else {
    currentScene.set(d['intermission']['scene']);
  }
  if (d['intermission']['game1'] != '') {
    tempAr = d['intermission']['game1'].split(",");
    game1 = {top:185,time:tempAr[3], team1:tempAr[0], team2:tempAr[1], league:tempAr[2]};
  }
  if (d['intermission']['game2'] != '') {
    tempAr = d['intermission']['game2'].split(",");
    game2 = {top:395,time:tempAr[3], team1:tempAr[0], team2:tempAr[1], league:tempAr[2]};
  }
  if (d['intermission']['game3'] != '') {
    tempAr = d['intermission']['game3'].split(",");
    game3 = {top:610,time:tempAr[3], team1:tempAr[0], team2:tempAr[1], league:tempAr[2]};
  }
  if (d['intermission']['ticker'] != '') {
    var tempAr2 = d['intermission']['ticker'].split(";");
    var tickerInfoLocal = '';
    tempAr2.forEach(async function(tempN) {
      var tempAr = tempN.split(",");
      tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
    })
    tickerInfo.set(tickerInfoLocal);
  }
  if (d['intermission']['power'] != '') {
    var i = 1;
    var powerRankingsLocal = [];
    var tempAr2 = d['intermission']['power'].split(",");
    console.log(tempAr2);
    tempAr2.forEach(function(tempN) {
      var powerRankingsLocalTemp = {id:i}
      if (i > 8){
        powerRankingsLocalTemp['left'] = 500;
        powerRankingsLocalTemp['top'] = (i-8) * 100;
      }else {
        powerRankingsLocalTemp['left'] = 0;
        powerRankingsLocalTemp['top'] = (i) * 100;
      }
      powerRankingsLocalTemp['team'] = tempN.trim();
      var lower = tempN.trim().toLowerCase();
      if (teamMap.hasOwnProperty(lower.toLowerCase())) {
          powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
      }
      powerRankingsLocal.push(powerRankingsLocalTemp);
      i = i + 1;
    })
  }
  
  if (d['intermission']['teamLeft'] != '') {
    matchupTeam1.set(d['intermission']['teamLeft']);
    var lower = d['intermission']['teamLeft'].toLowerCase();
    if (teamMap.hasOwnProperty(lower)) {
      matchupTeam1Color.set(teamMap[lower.toLowerCase()]['1']);
      matchupTeam1logo.set(teamMap[lower]['logo']);
    }
  }
  if (d['intermission']['teamRight'] != '') {
    matchupTeam2.set(d['intermission']['teamRight']);
    var lower = d['intermission']['teamRight'].toLowerCase();
    if (teamMap.hasOwnProperty(lower)) {
      matchupTeam2Color.set(teamMap[lower.toLowerCase()]['1']);
      matchupTeam2logo.set(teamMap[lower]['logo']);
    }
  }
  var games = [];
  
  games.push(game1);
  games.push(game2);
  games.push(game3);
  powerRankings.set(powerRankingsLocal);

  tonightGames.set(games);

});

function updateCasters() {
    var temp = []

    var tickerInfoLocal = '';
    temp.forEach(async function(tempN) {
      var tempAr = tempN.split(",");
      tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
    })
    var powerRankingsLocal = [];
    var games1 = {};
    var games2 = {};
    var games3 = {};
    var games4 = {};
    var games = [];
    var player1 = {};
    var player2 = {};
    var player3 = {};
    var player4 = {};
    var player5 = {};
    var player6 = {};
    var player7 = {};
    var player8 = {};
    var team1 = [];
    var team2 = [];
    
}
var myVar = setInterval(updateCasters, 1200);
updateCasters();

export default {
	pbpVideo: pbpVideo.subscribe,
	colorVideo: colorVideo.subscribe,
	pbpName: pbpName.subscribe,
	colorName: colorName.subscribe,
	pbpImage: pbpImage.subscribe,
	colorImage: colorImage.subscribe,
	currentScene: currentScene.subscribe,
	tickerInfo: tickerInfo.subscribe,
	powerRankings: powerRankings.subscribe,
	league: league.subscribe,
	tonightGames: tonightGames.subscribe,
	teamPlayers1: teamPlayers1.subscribe,
	teamPlayers2: teamPlayers2.subscribe,
	casterDisplay: casterDisplay.subscribe,
	deskDisplay: deskDisplay.subscribe,
	deskVideo: deskVideo.subscribe,
	anal1Video: anal1Video.subscribe,
	anal2Video: anal2Video.subscribe,
	numb: numb.subscribe,
  cameraOption: cameraOption.subscribe,
  vidOption: vidOption.subscribe,
	matchupTeam1: matchupTeam1.subscribe,
	matchupTeam1logo: matchupTeam1logo.subscribe,
	matchupTeam2logo: matchupTeam2logo.subscribe,
	matchupTeam2: matchupTeam2.subscribe,
	matchupTeam1Record: matchupTeam1Record.subscribe,
	matchupTeam2Record: matchupTeam2Record.subscribe,
	matchupTeam1Color: matchupTeam1Color.subscribe,
	matchupTeam2Color: matchupTeam2Color.subscribe
    
}