import fetch from 'node-fetch';

/**
 * Substack Article Parser
 * Detects format (screenplay vs prose), extracts scenes, maps to cinematic universe
 * 
 * Request:  { url?, text?, theme? }
 * Response: { title, episode, division, show, theme, format, scenes[] }
 *
 * Each scene: { num, title, text, voiceover, characters, mood, visualPrompt, speakingCharacter }
 */

// ── Theme Engine: 8 Cinematic Universes ──────────────────────────────

const THEMES = {
  'hell-on-wheels': {
    show: 'Hell on Wheels',
    division: 'AFC West',
    name: 'The Kansas City Line',
    teams: ['KC', 'LAC', 'DEN', 'LV'],
    palette: { primary: '#8B6914', secondary: '#4A3728', accent: '#D4A437' },
    mood: 'dusty amber, lantern-lit, frontier grit, iron and steam',
    visualStyle: 'American frontier 1860s, railroad camps, dusty plains, wooden saloons, steam locomotives, lantern light, leather and iron',
    narratorVoice: { provider: 'elevenlabs', voiceId: 'pNInz6obpgDQGcFmaJgB', style: 'gravelly, slow, dangerous, world-weary' },
    sceneTransitions: ['dust settling', 'train whistle in distance', 'lantern flickering', 'wind across prairie'],
    keywords: ['frontier', 'railroad', 'territory', 'camp', 'saloon', 'locomotive', 'foreman', 'sheriff']
  },
  'the-revenant': {
    show: 'The Revenant',
    division: 'AFC North',
    name: 'Blood & Ice',
    teams: ['BAL', 'CIN', 'CLE', 'PIT'],
    palette: { primary: '#4A5568', secondary: '#1A202C', accent: '#C53030' },
    mood: 'frozen wilderness, blood on snow, bare-knuckle survival, tribal violence',
    visualStyle: 'Frozen 1820s wilderness, gray skies, frozen mud, snow-covered forests, blood on white snow, fur pelts, bare hands, campfire smoke',
    narratorVoice: { provider: 'elevenlabs', voiceId: 'VR6AewLTigWG4xSOukaG', style: 'low, exhausted, primal, whispering through frost' },
    sceneTransitions: ['breath freezing in air', 'blood dripping on snow', 'wolves howling', 'ice cracking'],
    keywords: ['survival', 'blood', 'ice', 'frozen', 'crawl', 'grudge', 'territory', 'scar']
  },
  'texas-rising': {
    show: 'Texas Rising',
    division: 'AFC South',
    name: 'The Wall',
    teams: ['HOU', 'IND', 'JAX', 'TEN'],
    palette: { primary: '#C05621', secondary: '#744210', accent: '#D69E2E' },
    mood: 'Texas revolution, Alamo siege, desert warfare, frontier justice',
    visualStyle: '1836 Texas frontier, Alamo walls, desert landscapes, cavalry charges, adobe forts, burning sagebrush, rifle smoke, lone stars',
    narratorVoice: { provider: 'elevenlabs', voiceId: 'TxGEqnHWrfWFTfGW9XjX', style: 'defiant, sun-scorched, righteous fury' },
    sceneTransitions: ['dust devil crossing', 'cannon smoke clearing', 'sun beating down', 'boots on dry earth'],
    keywords: ['wall', 'siege', 'revolution', 'desert', 'cavalry', 'fortress', 'stand', 'defend']
  },
  'the-departed': {
    show: 'The Departed',
    division: 'AFC East',
    name: 'Atlantic Command',
    teams: ['BUF', 'MIA', 'NE', 'NYJ'],
    palette: { primary: '#2B6CB0', secondary: '#1A365D', accent: '#E53E3E' },
    mood: 'Boston underworld, double agents, betrayal, paranoia, rain-slicked streets',
    visualStyle: 'Modern Boston noir, rain-slicked streets, neon bar signs, interrogation rooms, wire taps, cold harbor fog, parked sedans, courthouse steps',
    narratorVoice: { provider: 'elevenlabs', voiceId: 'pNInz6obpgDQGcFmaJgB', style: 'tense, clipped, Boston edge, suspicious' },
    sceneTransitions: ['rain on windshield', 'phone buzzing in dark', 'elevator doors closing', 'harbor fog rolling in'],
    keywords: ['undercover', 'betrayal', 'command', 'Atlantic', 'paranoia', 'agent', 'wire', 'harbor']
  },
  'game-of-thrones': {
    show: 'Game of Thrones',
    division: 'NFC North',
    name: 'The Frozen Front',
    teams: ['CHI', 'DET', 'GB', 'MIN'],
    palette: { primary: '#4A5568', secondary: '#1A202C', accent: '#63B3ED' },
    mood: 'ice walls, war councils, frozen battlefields, throne rooms, winter warfare',
    visualStyle: 'Medieval fantasy frozen north, ice walls, stone castles, torchlit war rooms, snow-covered battlefields, iron thrones, raven messengers, fur cloaks',
    narratorVoice: { provider: 'elevenlabs', voiceId: 'VR6AewLTigWG4xSOukaG', style: 'cold, measured, ancient wisdom, chronicles of war' },
    sceneTransitions: ['ravens taking flight', 'torch guttering in wind', 'war drums distant', 'snow falling on iron'],
    keywords: ['winter', 'crown', 'kingdom', 'war', 'throne', 'frost', 'storm', 'survive']
  },
  'black-sails': {
    show: 'Black Sails',
    division: 'NFC South',
    name: 'No Quarter',
    teams: ['TB', 'NO', 'ATL', 'CAR'],
    palette: { primary: '#0D9488', secondary: '#134E4A', accent: '#D97706' },
    mood: 'pirate warfare, ship decks, cannon smoke, port towns, mutiny',
    visualStyle: '1700s Caribbean piracy, ship decks at sunset, cannon smoke, port taverns, treasure maps, black flags, rope and sail, crashing waves',
    narratorVoice: { provider: 'elevenlabs', voiceId: 'TxGEqnHWrfWFTfGW9XjX', style: 'salty, ruthless, sea-weathered, captains log' },
    sceneTransitions: ['cannon blast fading', 'waves against hull', 'rum pouring', 'anchor chains rattling'],
    keywords: ['quarter', 'ship', 'captain', 'port', 'cannon', 'mutiny', 'treasure', 'sail']
  },
  'we-own-this-city': {
    show: 'We Own This City',
    division: 'NFC East',
    name: 'Eastern Front',
    teams: ['DAL', 'NYG', 'PHI', 'WSH'],
    palette: { primary: '#718096', secondary: '#2D3748', accent: '#ED8936' },
    mood: 'institutional warfare, city streets, back rooms, wire taps, power plays',
    visualStyle: 'Modern urban grit, sodium-lit streets, abandoned buildings, courtrooms, unmarked cars, badge and gun, city skyline at night, concrete and steel',
    narratorVoice: { provider: 'elevenlabs', voiceId: 'pNInz6obpgDQGcFmaJgB', style: 'street-smart, investigative, hard truth, no illusions' },
    sceneTransitions: ['sirens fading', 'gavel striking', 'phone ringing in empty room', 'streetlight buzzing'],
    keywords: ['city', 'streets', 'front', 'power', 'institution', 'badge', 'territory', 'own']
  },
  'the-audacity': {
    show: 'The Audacity',
    division: 'NFC West',
    name: 'The Pacific Coast',
    teams: ['SF', 'SEA', 'ARI', 'LAR'],
    palette: { primary: '#3182CE', secondary: '#2C5282', accent: '#ECC94B' },
    mood: 'rule-breaking innovation, modern mythology, heist-film swagger, tech empire drama',
    visualStyle: 'Sleek modern mythology, neon war rooms, glass towers over Pacific, holographic playbooks, innovation labs, sunset-lit coastline, chrome and light, heist-film aesthetics',
    narratorVoice: { provider: 'elevenlabs', voiceId: 'TxGEqnHWrfWFTfGW9XjX', style: 'cocky, confident, almost laughing, daring you to doubt' },
    sceneTransitions: ['glass doors sliding', 'server lights blinking', 'Pacific waves crashing', 'scoreboard flickering'],
    keywords: ['audacity', 'coast', 'innovation', 'impossible', 'blueprint', 'rule', 'disrupt', 'dare']
  }
};

// ── Format Detection ─────────────────────────────────────────────────

function detectFormat(text) {
  const sceneMarkers = (text.match(/\[(EXT|INT)\./gi) || []).length;
  const voiceoverMarkers = (text.match(/\(V\.O\./gi) || []).length;
  const characterDialogue = (text.match(/^[A-Z]{2,}(\s\([^)]+\))?:/gm) || []).length;

  if (sceneMarkers >= 3 || (voiceoverMarkers >= 2 && characterDialogue >= 3)) {
    return 'screenplay';
  }
  return 'prose';
}

// ── Theme Detection ──────────────────────────────────────────────────

function detectTheme(text) {
  const lower = text.toLowerCase();

  const scores = {};
  for (const [key, theme] of Object.entries(THEMES)) {
    let score = 0;
    for (const kw of theme.keywords) {
      const regex = new RegExp(kw, 'gi');
      const matches = lower.match(regex);
      if (matches) score += matches.length;
    }
    // Also check for show name and division name
    if (lower.includes(theme.show.toLowerCase())) score += 10;
    if (lower.includes(theme.name.toLowerCase())) score += 10;
    scores[key] = score;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : null;
}

// ── Screenplay Parser ────────────────────────────────────────────────

function parseScreenplay(text) {
  const scenes = [];
  // Split on scene markers like [EXT. LOCATION – TIME] or [INT. LOCATION – TIME]
  const parts = text.split(/(?=\[(EXT|INT)\.\s)/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(/^\[(EXT|INT)\.\s*([^\]]+)\]/i);
    if (!headerMatch) continue;

    const location = headerMatch[2].trim();
    const lines = trimmed.split('\n').slice(1);

    // Extract voiceover lines
    const voiceovers = [];
    const dialogues = [];
    const directions = [];

    for (const line of lines) {
      const voMatch = line.match(/^([A-Z\s]+)\(V\.O\.[^)]*\):?\s*(.*)/);
      const diaMatch = line.match(/^([A-Z]{2,})\s*(\([^)]+\))?\s*:\s*(.*)/);
      const dirMatch = line.match(/^_(.+)_$/);

      if (voMatch) {
        voiceovers.push({ character: voMatch[1].trim(), text: voMatch[2].trim() });
      } else if (diaMatch) {
        dialogues.push({ character: diaMatch[1].trim(), text: diaMatch[3].trim() });
      } else if (dirMatch) {
        directions.push(dirMatch[1].trim());
      }
    }

    scenes.push({
      num: scenes.length + 1,
      title: location,
      text: trimmed,
      voiceover: voiceovers.map(v => v.text).join(' ') || null,
      characters: [...new Set([
        ...voiceovers.map(v => v.character),
        ...dialogues.map(d => d.character)
      ])],
      mood: directions.join('. ') || null,
      speakingCharacter: voiceovers[0]?.character || dialogues[0]?.character || null
    });
  }

  return scenes;
}

// ── Prose Parser ─────────────────────────────────────────────────────

function parseProse(text) {
  const scenes = [];

  // Strategy 1: Split by bold headers (team sections like **CHICAGO — THE RISE...**)
  const boldHeaders = text.split(/(?=\*[A-Z][A-Z\s—:–\-']+\*)/);

  // Strategy 2: Split by dramatic breaks (3+ newlines or *** dividers)
  // Strategy 3: Split by named section indicators

  // Try bold headers first
  if (boldHeaders.length >= 3) {
    for (const section of boldHeaders) {
      const trimmed = section.trim();
      if (!trimmed || trimmed.length < 50) continue;

      const headerMatch = trimmed.match(/^\*([^*]+)\*/);
      const title = headerMatch ? headerMatch[1].trim() : `Scene ${scenes.length + 1}`;

      // Extract character names (capitalized words that appear multiple times)
      const words = trimmed.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g) || [];
      const wordCounts = {};
      for (const w of words) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
      const characters = Object.entries(wordCounts)
        .filter(([, count]) => count >= 2)
        .map(([name]) => name)
        .filter(name => !['The', 'This', 'That', 'They', 'And', 'But', 'Not', 'Every', 'Here', 'Where'].includes(name));

      scenes.push({
        num: scenes.length + 1,
        title,
        text: trimmed,
        voiceover: trimmed.replace(/\*[^*]+\*/g, '').trim().slice(0, 500),
        characters,
        mood: null,
        speakingCharacter: null
      });
    }
  }

  // Fallback: Split into roughly even chunks by paragraph breaks
  if (scenes.length < 2) {
    const paragraphs = text.split(/\n{2,}/);
    const chunkSize = Math.ceil(paragraphs.length / Math.max(4, Math.ceil(paragraphs.length / 8)));

    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      const chunk = paragraphs.slice(i, i + chunkSize).join('\n\n');
      if (chunk.trim().length < 30) continue;

      scenes.push({
        num: scenes.length + 1,
        title: `Scene ${scenes.length + 1}`,
        text: chunk.trim(),
        voiceover: chunk.trim().slice(0, 500),
        characters: [],
        mood: null,
        speakingCharacter: null
      });
    }
  }

  return scenes;
}

// ── Substack Fetcher ─────────────────────────────────────────────────

async function fetchSubstackArticle(url) {
  // Try fetching RSS/JSON feed first
  const domain = new URL(url).origin;
  const slug = url.split('/').pop();

  try {
    // Substack API endpoint
    const apiUrl = `${domain}/api/v1/posts/${slug}`;
    const res = await fetch(apiUrl);
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title,
        subtitle: data.subtitle,
        body: data.body_text || data.body_html?.replace(/<[^>]+>/g, ' ') || '',
        publishDate: data.post_date,
        url
      };
    }
  } catch (e) {
    // Fallback to HTML scraping
  }

  // Fallback: fetch and parse HTML
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Director-X/1.0' }
  });
  const html = await res.text();

  // Extract title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

  // Extract body text (strip HTML)
  const bodyMatch = html.match(/<div[^>]*class="[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const body = bodyMatch
    ? bodyMatch[1].replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    : html.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  return { title, body, url };
}

// ── Title & Episode Extraction ───────────────────────────────────────

function extractTitleInfo(text) {
  // Try to find title patterns like "HELL ON WHEELS — EPISODE 003" or "THE FROZEN FRONT"
  const episodeMatch = text.match(/(?:EPISODE|EP\.?)\s*(\d+)/i);
  const titleMatch = text.match(/^(?:HELL ON WHEELS|THE REVENANT|TEXAS RISING|THE DEPARTED|GAME OF THRONES|BLACK SAILS|WE OWN THIS CITY|THE AUDACITY)[—:\s]+(.+)/im)
    || text.match(/^([A-Z][A-Z\s—:–\-']+)$/m);

  return {
    episode: episodeMatch ? parseInt(episodeMatch[1]) : null,
    title: titleMatch ? titleMatch[1]?.trim() || titleMatch[0]?.trim() : null
  };
}

// ── Main Handler ─────────────────────────────────────────────────────

export async function handleSubstackParse(req, res) {
  try {
    const { url, text, theme: requestedTheme } = req.body;

    if (!url && !text) {
      return res.status(400).json({ error: 'Provide either url (Substack URL) or text (raw article text)' });
    }

    // Get the article text
    let articleText;
    let articleTitle;

    if (url) {
      const article = await fetchSubstackArticle(url);
      articleText = article.body;
      articleTitle = article.title;
    } else {
      articleText = text;
    }

    // Detect format
    const format = detectFormat(articleText);

    // Detect or use provided theme
    const themeKey = requestedTheme || detectTheme(articleText);
    const theme = themeKey ? THEMES[themeKey] : null;

    // Extract title info
    const titleInfo = extractTitleInfo(articleText);

    // Parse scenes
    let scenes;
    if (format === 'screenplay') {
      scenes = parseScreenplay(articleText);
    } else {
      scenes = parseProse(articleText);
    }

    // Enrich scenes with theme-specific visual prompts
    if (theme) {
      scenes = scenes.map(scene => ({
        ...scene,
        visualPrompt: `${theme.visualStyle}. ${scene.mood || theme.mood}. Scene: ${scene.title}. ${scene.text.slice(0, 200)}`,
        voiceProvider: theme.narratorVoice.provider,
        voiceId: theme.narratorVoice.voiceId,
        voiceStyle: theme.narratorVoice.style
      }));
    }

    res.json({
      title: articleTitle || titleInfo.title || 'Untitled',
      episode: titleInfo.episode,
      division: theme?.division || null,
      show: theme?.show || null,
      themeName: theme?.name || null,
      themeKey: themeKey,
      format,
      palette: theme?.palette || null,
      sceneCount: scenes.length,
      scenes
    });

  } catch (err) {
    console.error('Substack parse error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// Export theme data for other modules
export { THEMES };
