const Parser = require('rss-parser');
const xml2js = require('xml2js');
const fs = require('fs').promises;

const parser = new Parser({
    customFields: {
        feed: ['itunes:image', 'itunes:author', 'itunes:category'],
        item: ['itunes:duration', 'itunes:image']
    }
});

// دالة لإنشاء معرف فريد
function generateUniqueId(podcast) {
    const str = `${podcast.title}-${podcast.author}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString();
}

(async () => {
    try {
        // قراءة ملف OPML
        const opmlData = await fs.readFile('subscriptions.opml', 'utf8');
        const opml = await xml2js.parseStringPromise(opmlData);

        // استخراج روابط RSS
        const rssFeeds = opml.opml.body[0].outline.map(item => item.$.xmlUrl);

        // جلب بيانات كل خلاصة RSS
        const podcasts = [];
        for (const rssUrl of rssFeeds) {
            try {
                const feed = await parser.parseURL(rssUrl);
                
                // تحديد رابط صورة البودكاست الأصلي
                const podcastCover = feed.itunes?.image?.['$']?.href || feed.itunes?.image || feed.image?.url || '';

                podcasts.push({
                    id: generateUniqueId({ title: feed.title || 'غير معروف', author: feed.itunes?.author || 'غير معروف' }),
                    title: feed.title || 'غير معروف',
                    author: feed.itunes?.author || 'غير معروف',
                    cover: podcastCover,
                    description: feed.description || 'لا يوجد وصف',
                    category: feed.itunes?.category?.[0]?.['$']?.text || 'غير معروف',
                    episodes: feed.items.map(item => ({
                        title: item.title || 'غير معروف',
                        date: item.pubDate || 'غير معروف',
                        audioUrl: item.enclosure?.url || '',
                        duration: item.itunes?.duration || 'غير معروف',
                        cover: item.itunes?.image?.['$']?.href || item.itunes?.image || podcastCover
                    }))
                });
            } catch (error) {
                console.error(`خطأ في جلب الخلاصة ${rssUrl}:`, error);
            }
        }

        // التأكد من وجود المجلد قبل الكتابة
        await fs.mkdir('data', { recursive: true });

        // كتابة البيانات إلى podcasts.json
        await fs.writeFile('data/podcasts.json', JSON.stringify(podcasts, null, 2), 'utf8');
        console.log('تم تحديث podcasts.json بنجاح (بدون Cloudinary)');
    } catch (error) {
        console.error('خطأ في تحليل OPML:', error);
        process.exit(1);
    }
})();
