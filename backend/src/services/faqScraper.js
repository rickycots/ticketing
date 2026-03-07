const cheerio = require('cheerio');
const db = require('../db/database');

const BASE_URL = 'https://support.supremainc.com';
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FAQ_CATEGORIA = 'FAQ Suprema';

// Folder IDs to scrape (from support.supremainc.com)
const FOLDERS = [
  { id: '24000003537', name: 'New Features' },
  { id: '24000005099', name: 'Announcements' },
  { id: '24000001228', name: 'Database & Integration' },
  { id: '24000002163', name: 'Known Issues' },
  { id: '24000001233', name: 'General' },
  { id: '6000145258', name: 'Getting Started' },
  { id: '24000001230', name: 'Connection' },
  { id: '24000001231', name: 'Device' },
  { id: '24000001232', name: 'Server' },
  { id: '24000006512', name: 'User' },
  { id: '24000002787', name: 'Card' },
  { id: '24000001229', name: 'SDK' },
];

function getLastSyncTime() {
  const row = db.prepare(
    "SELECT valore FROM impostazioni WHERE chiave = 'faq_suprema_last_sync'"
  ).get();
  return row ? new Date(row.valore).getTime() : 0;
}

function setLastSyncTime() {
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT chiave FROM impostazioni WHERE chiave = 'faq_suprema_last_sync'").get();
  if (existing) {
    db.prepare("UPDATE impostazioni SET valore = ? WHERE chiave = 'faq_suprema_last_sync'").run(now);
  } else {
    db.prepare("INSERT INTO impostazioni (chiave, valore) VALUES ('faq_suprema_last_sync', ?)").run(now);
  }
}

function needsSync() {
  return (Date.now() - getLastSyncTime()) > SYNC_INTERVAL_MS;
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * Get all article URLs from a folder (follows pagination)
 */
async function getArticleUrls(folderId) {
  const urls = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${BASE_URL}/en/support/solutions/folders/${folderId}?page=${page}`;
    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      const links = $('a.c-article__title, a[data-article-id], .article-title a, .list-lead a');
      if (links.length === 0) {
        // Try broader selector for Freshdesk
        $('a[href*="/articles/"]').each((_, el) => {
          const href = $(el).attr('href');
          if (href && href.includes('/solutions/articles/')) {
            const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
            if (!urls.includes(fullUrl)) urls.push(fullUrl);
          }
        });
      } else {
        links.each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
            if (!urls.includes(fullUrl)) urls.push(fullUrl);
          }
        });
      }

      // Check pagination
      const nextLink = $('a[rel="next"], .pagination a:contains("Next"), .pagination a:contains("»")');
      hasMore = nextLink.length > 0 && page < 50; // safety limit
      page++;
    } catch (err) {
      console.error(`[FAQ Scraper] Errore pagina ${url}:`, err.message);
      hasMore = false;
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  return urls;
}

/**
 * Scrape a single article and return its content
 */
async function scrapeArticle(articleUrl) {
  try {
    const html = await fetchPage(articleUrl);
    const $ = cheerio.load(html);

    const title = $('h1, .article-title, .c-article__title').first().text().trim();
    if (!title) return null;

    // Get article body
    const bodyEl = $('.article-body, .article__body, .c-article__body, [itemprop="articleBody"], .article-content');
    let body = '';

    if (bodyEl.length > 0) {
      // Remove scripts, styles, images
      bodyEl.find('script, style, img, iframe, video').remove();
      body = bodyEl.text().replace(/\s+/g, ' ').trim();
    }

    if (!body) {
      // Fallback: get main content area
      const main = $('main, .main-content, #main-content, .article');
      if (main.length) {
        main.find('script, style, img, iframe, video, nav, header, footer').remove();
        body = main.text().replace(/\s+/g, ' ').trim();
      }
    }

    // Truncate very long articles (max 8000 chars for AI context)
    if (body.length > 8000) {
      body = body.substring(0, 8000) + '...';
    }

    if (!body || body.length < 20) return null;

    // Extract article ID from URL
    const idMatch = articleUrl.match(/articles\/(\d+)/);
    const articleId = idMatch ? idMatch[1] : articleUrl;

    return { title, body, articleId, url: articleUrl };
  } catch (err) {
    console.error(`[FAQ Scraper] Errore articolo ${articleUrl}:`, err.message);
    return null;
  }
}

/**
 * Main sync function: scrape all folders, upsert into documenti_repository
 */
async function syncFaq() {
  console.log('[FAQ Scraper] Inizio sincronizzazione FAQ Suprema...');
  const startTime = Date.now();

  let totalArticles = 0;
  let newArticles = 0;
  let updatedArticles = 0;

  for (const folder of FOLDERS) {
    console.log(`[FAQ Scraper] Scansione cartella: ${folder.name}...`);

    try {
      const articleUrls = await getArticleUrls(folder.id);
      console.log(`[FAQ Scraper] ${folder.name}: ${articleUrls.length} articoli trovati`);

      for (const url of articleUrls) {
        const article = await scrapeArticle(url);
        if (!article) continue;

        totalArticles++;

        // Use article URL as unique identifier (stored in descrizione field)
        const existing = db.prepare(
          "SELECT id, contenuto_testo FROM documenti_repository WHERE descrizione = ? AND categoria = ?"
        ).get(article.url, FAQ_CATEGORIA);

        const content = `[${folder.name}] ${article.title}\n\n${article.body}`;

        if (existing) {
          // Update only if content changed
          if (existing.contenuto_testo !== content) {
            db.prepare(
              "UPDATE documenti_repository SET nome_originale = ?, contenuto_testo = ? WHERE id = ?"
            ).run(article.title, content, existing.id);
            updatedArticles++;
          }
        } else {
          // Insert new
          db.prepare(`
            INSERT INTO documenti_repository (nome_originale, nome_file, categoria, descrizione, contenuto_testo, dimensione)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            article.title,
            `faq-suprema-${article.articleId}.txt`,
            FAQ_CATEGORIA,
            article.url,
            content,
            content.length
          );
          newArticles++;
        }

        // Rate limiting between articles
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (err) {
      console.error(`[FAQ Scraper] Errore cartella ${folder.name}:`, err.message);
    }
  }

  setLastSyncTime();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[FAQ Scraper] Sincronizzazione completata in ${elapsed}s — ${totalArticles} articoli totali, ${newArticles} nuovi, ${updatedArticles} aggiornati`);
}

/**
 * Check if sync is needed and run it (called from poller)
 */
async function checkAndSync() {
  if (!needsSync()) return;
  try {
    await syncFaq();
  } catch (err) {
    console.error('[FAQ Scraper] Errore sync:', err.message);
  }
}

module.exports = { syncFaq, checkAndSync, needsSync };
