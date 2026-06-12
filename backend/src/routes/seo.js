import { THEMES } from './substack.js';

/**
 * SEO Metadata Engine
 * Generates platform-specific titles, descriptions, tags, and CTAs
 * with Substack backlinks baked into every output.
 * 
 * POST /api/seo/generate
 * Request:  { title, theme, episode?, scenes[], substackUrl?, platforms[] }
 * Response: { platforms: { youtube: {...}, tiktok: {...}, instagram: {...}, facebook: {...} } }
 */

// ── Platform-Specific SEO Templates ──────────────────────────────────

const PLATFORM_CONFIGS = {
  youtube: {
    titleMax: 100,
    descMax: 5000,
    tagMax: 500,      // characters total
    maxTags: 30,
    aspectRatio: '16:9',
    hashtagStyle: 'description',  // YouTube uses tags + description hashtags
    ctaPlacement: 'description_top'
  },
  tiktok: {
    titleMax: 0,       // TikTok uses caption instead
    captionMax: 2200,
    maxTags: 10,       // hashtags in caption
    aspectRatio: '9:16',
    hashtagStyle: 'inline',
    ctaPlacement: 'caption_end'
  },
  instagram: {
    captionMax: 2200,
    maxTags: 30,
    aspectRatio: '1:1',  // or 9:16 for Reels
    hashtagStyle: 'comment_or_caption',
    ctaPlacement: 'caption_end'
  },
  facebook: {
    titleMax: 0,
    captionMax: 63206,
    maxTags: 10,
    aspectRatio: '16:9',
    hashtagStyle: 'inline_few',
    ctaPlacement: 'caption_top'
  }
};

// ── Core Tag Generation ──────────────────────────────────────────────

function generateCoreTags(theme, title, episode) {
  const base = ['NFL', 'football', 'sports', 'NFLAnalysis'];
  const themeData = theme ? THEMES[theme] : null;

  if (themeData) {
    // Division teams
    base.push(...themeData.teams.map(t => t.toLowerCase()));
    base.push(themeData.division.replace(/\s/g, ''));
    // Show-themed tags
    const showTag = themeData.show.replace(/\s/g, '');
    const nameTag = themeData.name.replace(/\s/g, '');
    base.push(showTag, nameTag);
    // Keywords
    base.push(...themeData.keywords.slice(0, 5));
  }

  // Brand tags always present
  base.push('RiseAndClaim', 'OwnYourGreatness', 'JerryWright');

  // Extract notable words from title
  if (title) {
    const titleWords = title.replace(/[^a-zA-Z\s]/g, '').split(/\s+/)
      .filter(w => w.length > 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    base.push(...titleWords.slice(0, 5));
  }

  // Episode tag
  if (episode) {
    base.push(`Episode${episode}`, `Ep${episode}`);
  }

  // Deduplicate
  return [...new Set(base)];
}

// ── YouTube SEO ──────────────────────────────────────────────────────

function generateYouTubeSEO({ title, theme, episode, scenes, substackUrl }) {
  const themeData = theme ? THEMES[theme] : null;
  const coreTags = generateCoreTags(theme, title, episode);
  const showName = themeData?.show || 'Rise and Claim';
  const divisionName = themeData?.division || '';

  // Title: attention-grabbing, keyword-rich
  const ytTitle = episode
    ? `${showName} EP ${String(episode).padStart(3, '0')}: ${title} | ${divisionName} NFL Breakdown`
    : `${title} | ${showName} | ${divisionName} NFL Analysis`;

  // Description: CTA first, then content summary, then SEO keywords
  const scenePreview = scenes.slice(0, 3).map((s, i) =>
    `${i + 1}. ${s.title || `Scene ${s.num}`}`
  ).join('\n');

  const ytDescription = [
    // CTA Block
    `📰 READ THE FULL ARTICLE: ${substackUrl || 'https://riseandclaim.substack.com'}`,
    `🔔 Subscribe for weekly ${showName} episodes — NFL like you've never seen it.`,
    '',
    // Summary
    themeData
      ? `Welcome to ${themeData.name} — the ${themeData.division} told through the lens of ${themeData.show}. ${themeData.mood}.`
      : `A Rise and Claim original production.`,
    '',
    `📋 IN THIS EPISODE:`,
    scenePreview,
    '',
    // Timestamps placeholder
    '⏱️ TIMESTAMPS:',
    ...scenes.map((s, i) => `0:${String(i * 30).padStart(2, '0')} — ${s.title || `Scene ${s.num}`}`),
    '',
    // Brand
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🏆 OWN YOUR GREATNESS',
    `📰 Substack: ${substackUrl || 'https://riseandclaim.substack.com'}`,
    '📱 TikTok: @riseandclaim',
    '📷 Instagram: @riseandclaim',
    '',
    // Hashtags in description (YouTube shows up to 3 above the title)
    `#NFL #${(themeData?.show || 'RiseAndClaim').replace(/\s/g, '')} #${(themeData?.name || 'OwnYourGreatness').replace(/\s/g, '')} #${divisionName.replace(/\s/g, '')} #Football`
  ].join('\n');

  // Tags (YouTube Studio tag field)
  const ytTags = coreTags.slice(0, PLATFORM_CONFIGS.youtube.maxTags);

  return {
    platform: 'youtube',
    title: ytTitle.slice(0, PLATFORM_CONFIGS.youtube.titleMax),
    description: ytDescription.slice(0, PLATFORM_CONFIGS.youtube.descMax),
    tags: ytTags,
    tagsString: ytTags.join(', '),
    aspectRatio: '16:9',
    thumbnailPrompt: themeData
      ? `${themeData.visualStyle}. Bold text overlay: "${title}". Cinematic poster style, high contrast, dramatic lighting.`
      : `Bold cinematic thumbnail for "${title}". Dark background, dramatic lighting, sports energy.`,
    category: 'Sports',
    language: 'en'
  };
}

// ── TikTok SEO ───────────────────────────────────────────────────────

function generateTikTokSEO({ title, theme, episode, scenes, substackUrl }) {
  const themeData = theme ? THEMES[theme] : null;
  const coreTags = generateCoreTags(theme, title, episode);
  const showName = themeData?.show || 'Rise and Claim';

  // TikTok: short punchy caption, hashtags at end
  const hook = scenes[0]?.voiceover?.slice(0, 100) || title;
  const hashtags = coreTags.slice(0, PLATFORM_CONFIGS.tiktok.maxTags)
    .map(t => `#${t}`).join(' ');

  const caption = [
    `${hook}...`,
    '',
    `${showName}${episode ? ` EP ${episode}` : ''} 🎬`,
    `📰 Full story on Substack — link in bio`,
    '',
    hashtags
  ].join('\n');

  return {
    platform: 'tiktok',
    caption: caption.slice(0, PLATFORM_CONFIGS.tiktok.captionMax),
    hashtags: coreTags.slice(0, 10).map(t => `#${t}`),
    aspectRatio: '9:16',
    sound: 'original',
    bioLink: substackUrl || 'https://riseandclaim.substack.com',
    coverFramePrompt: themeData
      ? `${themeData.visualStyle}. Vertical portrait, dramatic moment, mobile-optimized.`
      : `Vertical cinematic frame for "${title}".`
  };
}

// ── Instagram SEO ────────────────────────────────────────────────────

function generateInstagramSEO({ title, theme, episode, scenes, substackUrl }) {
  const themeData = theme ? THEMES[theme] : null;
  const coreTags = generateCoreTags(theme, title, episode);
  const showName = themeData?.show || 'Rise and Claim';

  // IG Reels caption
  const hook = scenes[0]?.voiceover?.slice(0, 120) || title;
  const hashtags = coreTags.slice(0, PLATFORM_CONFIGS.instagram.maxTags)
    .map(t => `#${t}`).join(' ');

  const caption = [
    `${hook} 🎬`,
    '',
    `${showName}${episode ? ` — Episode ${episode}` : ''}`,
    themeData ? `${themeData.division} like you've never seen it.` : 'NFL analysis reimagined.',
    '',
    `📰 Full article on Substack — link in bio`,
    `🔔 Follow @riseandclaim for more`,
    '',
    '.',
    '.',
    '.',
    hashtags
  ].join('\n');

  return {
    platform: 'instagram',
    caption: caption.slice(0, PLATFORM_CONFIGS.instagram.captionMax),
    hashtags: coreTags.slice(0, 30).map(t => `#${t}`),
    hashtagComment: hashtags,  // Separate comment with hashtags
    aspectRatio: '9:16',       // Reels
    altText: `${showName} ${title} — NFL ${themeData?.division || ''} cinematic breakdown`,
    bioLink: substackUrl || 'https://riseandclaim.substack.com',
    carouselSlides: scenes.slice(0, 10).map((s, i) => ({
      slideNum: i + 1,
      text: s.title || `Scene ${s.num}`,
      prompt: s.visualPrompt || s.text?.slice(0, 200)
    }))
  };
}

// ── Facebook SEO ─────────────────────────────────────────────────────

function generateFacebookSEO({ title, theme, episode, scenes, substackUrl }) {
  const themeData = theme ? THEMES[theme] : null;
  const coreTags = generateCoreTags(theme, title, episode);
  const showName = themeData?.show || 'Rise and Claim';

  const caption = [
    `🎬 NEW ${showName.toUpperCase()}${episode ? ` — EPISODE ${episode}` : ''}`,
    '',
    `"${title}"`,
    '',
    themeData
      ? `The ${themeData.division} told through the world of ${themeData.show}. ${themeData.mood}.`
      : 'A Rise and Claim original.',
    '',
    `📰 READ THE FULL ARTICLE: ${substackUrl || 'https://riseandclaim.substack.com'}`,
    '',
    `What do you think of the ${themeData?.division || 'division'} this season? Drop your take below 👇`,
    '',
    coreTags.slice(0, PLATFORM_CONFIGS.facebook.maxTags).map(t => `#${t}`).join(' ')
  ].join('\n');

  return {
    platform: 'facebook',
    caption: caption.slice(0, PLATFORM_CONFIGS.facebook.captionMax),
    hashtags: coreTags.slice(0, 10).map(t => `#${t}`),
    aspectRatio: '16:9',
    linkPreview: substackUrl || 'https://riseandclaim.substack.com',
    ogTitle: `${showName}: ${title}`,
    ogDescription: themeData
      ? `${themeData.division} breakdown — ${themeData.name}. ${themeData.mood}.`
      : `NFL analysis reimagined by Rise and Claim.`
  };
}

// ── Cross-Platform Backlink Engine ───────────────────────────────────

function generateBacklinks(substackUrl, theme) {
  const themeData = theme ? THEMES[theme] : null;
  const url = substackUrl || 'https://riseandclaim.substack.com';

  return {
    substackUrl: url,
    ctaVariants: [
      `📰 Read the full article: ${url}`,
      `📖 The complete story is on Substack — ${url}`,
      `🔗 Full breakdown with exclusive analysis: ${url}`,
      `📰 Get the uncut version on Substack: ${url}`,
      `💡 Want the deep dive? Full article here: ${url}`
    ],
    bioLink: url,
    watermarkText: themeData
      ? `${themeData.name} | riseandclaim.substack.com`
      : 'riseandclaim.substack.com',
    endCardPrompt: themeData
      ? `End card: "${themeData.name}" logo over ${themeData.visualStyle.split(',')[0]}. Text: "Full article on Substack". URL: ${url}`
      : `End card: "Rise and Claim" logo. Text: "Read more on Substack". URL: ${url}`
  };
}

// ── Main Handler ─────────────────────────────────────────────────────

export async function handleSEOGenerate(req, res) {
  try {
    const { title, theme, episode, scenes, substackUrl, platforms } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Missing required field: title' });
    }

    const requestedPlatforms = platforms || ['youtube', 'tiktok', 'instagram', 'facebook'];
    const params = { title, theme, episode, scenes: scenes || [], substackUrl };

    const result = {
      title,
      theme: theme || null,
      episode: episode || null,
      platforms: {},
      backlinks: generateBacklinks(substackUrl, theme)
    };

    for (const platform of requestedPlatforms) {
      switch (platform) {
        case 'youtube':
          result.platforms.youtube = generateYouTubeSEO(params);
          break;
        case 'tiktok':
          result.platforms.tiktok = generateTikTokSEO(params);
          break;
        case 'instagram':
          result.platforms.instagram = generateInstagramSEO(params);
          break;
        case 'facebook':
          result.platforms.facebook = generateFacebookSEO(params);
          break;
      }
    }

    res.json(result);
  } catch (err) {
    console.error('SEO generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
