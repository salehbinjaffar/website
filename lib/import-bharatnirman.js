const { fetchUrl } = require("./rss");
const { readSite, writeSite, newId, slugify } = require("./store");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchBharatnirmanContent() {
  const baseUrl = "https://bharatnirmannews.com";
  const html = await fetchUrl(baseUrl);
  
  // Extract post links from homepage
  const postLinks = [];
  const linkRegex = /href="([^"]*\?p=\d+)"[^>]*>([^<]+)<\/a>/g;
  let match;
  const seen = new Set();
  
  while ((match = linkRegex.exec(html)) !== null) {
    let url = match[1];
    const title = match[2];
    // Check if URL already includes the base URL
    if (url.startsWith('http')) {
      url = url;
    } else {
      url = baseUrl + url;
    }
    if (!seen.has(url) && url.includes('?p=')) {
      seen.add(url);
      postLinks.push({ url, title });
    }
  }
  
  console.log(`Found ${postLinks.length} posts`);
  return postLinks;
}

async function fetchPostDetails(url) {
  try {
    const html = await fetchUrl(url);
    
    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const title = titleMatch ? titleMatch[1].trim() : "";
    
    // Extract content
    const contentMatch = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const content = contentMatch ? contentMatch[1] : "";
    
    // Extract image
    const imgMatch = html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*wp-post-image[^"]*"[^>]*>/);
    const imageUrl = imgMatch ? imgMatch[1] : "";
    
    // Extract date
    const dateMatch = html.match(/<time[^>]*datetime="([^"]+)"/);
    const date = dateMatch ? dateMatch[1].split('T')[0] : new Date().toISOString().slice(0, 10);
    
    // Extract category
    const catMatch = html.match(/<a[^>]*rel="category"[^>]*>([^<]+)<\/a>/);
    const category = catMatch ? catMatch[1].trim() : "समाचार";
    
    return {
      title,
      content,
      imageUrl,
      date,
      category
    };
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function importBharatnirmanPosts(limit = 10) {
  const site = readSite();
  const posts = await fetchBharatnirmanContent();
  
  // Get or create category
  let categoryId = site.categories.find(c => c.name === "भारत निर्माण")?.id;
  if (!categoryId) {
    categoryId = newId();
    site.categories.push({ id: categoryId, name: "भारत निर्माण" });
  }
  
  let imported = 0;
  for (let i = 0; i < Math.min(limit, posts.length); i++) {
    const post = posts[i];
    const details = await fetchPostDetails(post.url);
    
    if (details && details.title) {
      const article = {
        id: newId(),
        slug: slugify(details.title),
        title: details.title,
        categoryId: categoryId,
        excerpt: details.content.substring(0, 200),
        body: details.content.split(/\n\n+/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join(""),
        imageUrl: details.imageUrl,
        publishedAt: details.date,
        featured: false,
        tags: ["भारत निर्माण", "समाचार"]
      };
      
      site.articles.unshift(article);
      imported++;
      console.log(`Imported: ${details.title}`);
    }
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  writeSite(site);
  console.log(`Successfully imported ${imported} posts`);
  return imported;
}

// Run the import
if (require.main === module) {
  importBharatnirmanPosts(5).catch(console.error);
}

module.exports = { importBharatnirmanPosts, fetchBharatnirmanContent };
