import type { Source } from "../types";

const list: Source[] = [
  { id: "loc-cels", title: "Animation: from cels to pixels (cel animation history)", publisher: "Library of Congress", url: "https://www.loc.gov/loc/lcib/9906/animate.html" },
  { id: "moma-steamboat", title: "Walt Disney, Ub Iwerks: Steamboat Willie, 1928", publisher: "MoMA Learning", url: "https://www.moma.org/momaorg/shared/flattened_pages/moma_learning/walt-disney-ub-iwerks-steamboat-willie-1928/" },
  { id: "wdfm-flowers", title: "Flowers and Trees: the first full-color cartoon", publisher: "The Walt Disney Family Museum", url: "https://www.waltdisney.org/blog/flowers-and-trees-first-color-movie" },
  { id: "loc-snow-white", title: "Snow White and the Seven Dwarfs (National Film Registry essay)", publisher: "Library of Congress", url: "https://www.loc.gov/static/programs/national-film-preservation-board/documents/snow_white_dwarfs.rev.pdf" },
  { id: "d23-multiplane", title: "Multiplane camera", publisher: "D23", url: "https://d23.com/a-to-z/multiplane-camera/" },
  { id: "wdfm-pinocchio", title: "Machine of imagination: Pinocchio and the multiplane camera", publisher: "The Walt Disney Family Museum", url: "https://www.waltdisney.org/blog/machine-imagination-walt-disneys-pinocchio-and-multiplane-camera" },
  { id: "awn-hb", title: "Unlimited Imagination (Hanna-Barbera production practice)", publisher: "Animation World Network", url: "https://www.awn.com/animationworld/unlimited-imagination" },
  { id: "tezuka-astro", title: "Astro Boy (1963 television series)", publisher: "Tezuka Osamu Official", url: "https://tezukaosamu.net/en/anime/30.html" },
  { id: "wdfm-dalmatians", title: "The making of One Hundred and One Dalmatians", publisher: "The Walt Disney Family Museum", url: "https://www.waltdisney.org/blog/making-101-dalmatians" },
  { id: "d23-rescuers", title: "The Rescuers Down Under (film)", publisher: "D23", url: "https://d23.com/a-to-z/rescuers-down-under-the-film/" },
  { id: "d23-ballroom", title: "The history and magic behind the ballroom in Beauty and the Beast", publisher: "D23", url: "https://d23.com/ever-a-surprise-the-history-and-the-magic-behind-the-ballroom-in-beauty-and-the-beast/" },
  { id: "d23-tarzan", title: "Seven swinging facts about Disney's Tarzan", publisher: "D23", url: "https://d23.com/seven-swinging-facts-disneys-tarzan/" },
  { id: "pixar-story", title: "Our story", publisher: "Pixar Animation Studios", url: "https://www.pixar.com/our-story" },
  { id: "sbp-rigging", title: "The Science Behind Pixar: Rigging", publisher: "Pixar & Museum of Science", url: "https://sciencebehindpixar.org/pipeline/rigging" },
  { id: "sbp-animation", title: "The Science Behind Pixar: Animation", publisher: "Pixar & Museum of Science", url: "https://sciencebehindpixar.org/pipeline/animation" },
  { id: "pixar-fur", title: "Pixar history: Monsters, Inc. and Sulley's fur", publisher: "Pixar Animation Studios", url: "https://www.pixar.com/may" },
  { id: "wdas-matterhorn", title: "Matterhorn (snow simulation)", publisher: "Walt Disney Animation Studios", url: "https://disneyanimation.com/technology/matterhorn/" },
  { id: "wdas-hyperion", title: "Hyperion renderer", publisher: "Walt Disney Animation Studios", url: "https://www.disneyanimation.com/technology/hyperion/" },
  { id: "spi-spiderverse", title: "Spider-Man: Into the Spider-Verse production breakdown", publisher: "Sony Pictures Imageworks", url: "https://www.imageworks.com/our-craft/feature-animation/movies/spider-man-spider-verse" },
  { id: "siggraph-puss", title: "Crafting the enchanted universe of Puss in Boots: The Last Wish", publisher: "ACM SIGGRAPH Blog", url: "https://blog.siggraph.org/2024/02/crafting-the-enchanted-universe-of-puss-in-boots-the-last-wish.html/" },
  { id: "google-longform", title: "Coherent long-form video generation", publisher: "Google Research", url: "https://research.google/blog/coherent-long-form-video-generation/" },
  { id: "fal-seedance-ref", title: "Seedance 2.5 (US) reference-to-video API schema", publisher: "fal", url: "https://fal.ai/models/bytedance/seedance-2.5/us/reference-to-video/api" },
  { id: "bluey", title: "Bluey behind the scenes", publisher: "Bluey official site", url: "https://www.bluey.tv/blog/bluey-behind-the-scenes/" },
  { id: "laika", title: "LAIKA blends digital and physical", publisher: "Autodesk", url: "https://www.autodesk.com/customer-stories/laika-blends-digital-and-physical" },
  { id: "bluezoo-rt", title: "Blue Zoo's new real-time department", publisher: "Blue Zoo Animation Studio", url: "https://www.blue-zoo.co.uk/blog/blue-zoos-new-real-time-department/" },
];

export const SOURCES: Record<string, Source> = Object.fromEntries(list.map((s) => [s.id, s]));
