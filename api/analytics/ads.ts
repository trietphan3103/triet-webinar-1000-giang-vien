import type { VercelRequest, VercelResponse } from '@vercel/node'

const FIELDS = 'ad_id,campaign_name,adset_name,ad_name,impressions,reach,clicks,spend,cpm,cpc,ctr,actions,cost_per_action_type'

interface RawAd {
  ad_id: string; campaign_name: string; adset_name: string; ad_name: string
  impressions: string; reach: string; clicks: string; spend: string
  cpm: string; cpc: string; ctr: string
  actions?: Array<{ action_type: string; value: string }>
  cost_per_action_type?: Array<{ action_type: string; value: string }>
}

function normalizeActions(raw: RawAd['actions']) {
  const out: Record<string, number> = {}
  for (const a of raw ?? []) out[a.action_type] = Number(a.value)
  return out
}

function getLpv(actions: Record<string, number>) {
  return actions['landing_page_view'] || actions['link_click'] || 0
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { days = '7', from, to } = req.query as Record<string, string>
    const sinceDate = from || new Date(Date.now() - parseInt(days) * 86400000).toISOString().split('T')[0]
    const untilDate = to || new Date().toISOString().split('T')[0]
    const token = process.env.META_ACCESS_TOKEN!

    const params = new URLSearchParams({
      access_token: token, fields: FIELDS,
      time_range: JSON.stringify({ since: sinceDate, until: untilDate }),
      level: 'ad', limit: '50',
    })

    const adsData = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/insights?${params}`
    ).then(r => r.json())

    const rawAds: RawAd[] = adsData.data || []

    // Batch fetch post URLs
    const adIds = rawAds.map(a => a.ad_id).filter(Boolean)
    const postUrls: Record<string, string> = {}
    if (adIds.length) {
      try {
        const batchRes = await fetch(
          `https://graph.facebook.com/v19.0/?ids=${adIds.join(',')}&fields=creative{effective_object_story_id}&access_token=${token}`
        ).then(r => r.json())
        for (const [id, val] of Object.entries(batchRes as Record<string, { creative?: { effective_object_story_id?: string } }>)) {
          const storyId = val?.creative?.effective_object_story_id
          if (storyId) {
            const [pageId, postId] = storyId.split('_')
            if (pageId && postId) {
              postUrls[id] = `https://www.facebook.com/permalink.php?story_fbid=${postId}&id=${pageId}`
            }
          }
        }
      } catch { /* post URLs are optional */ }
    }

    // Normalize ad rows
    const ads = rawAds.map(a => {
      const actions = normalizeActions(a.actions)
      return {
        ad_id: a.ad_id,
        post_url: postUrls[a.ad_id] || null,
        campaign_name: a.campaign_name,
        adset_name: a.adset_name,
        ad_name: a.ad_name,
        impressions: Number(a.impressions) || 0,
        reach: Number(a.reach) || 0,
        clicks: Number(a.clicks) || 0,
        landing_page_views: getLpv(actions),
        spend: Number(a.spend) || 0,
        cpm: Number(a.cpm) || 0,
        cpc: Number(a.cpc) || 0,
        ctr: Number(a.ctr) || 0,
        actions,
      }
    })

    // Campaign-level rollup
    const campaignMap = new Map<string, typeof ads[0]>()
    for (const ad of ads) {
      if (!campaignMap.has(ad.campaign_name)) {
        campaignMap.set(ad.campaign_name, { ...ad, ad_id: '', post_url: null, adset_name: '', ad_name: '' })
      } else {
        const c = campaignMap.get(ad.campaign_name)!
        c.impressions += ad.impressions
        c.reach += ad.reach
        c.clicks += ad.clicks
        c.landing_page_views += ad.landing_page_views
        c.spend += ad.spend
        for (const [k, v] of Object.entries(ad.actions)) c.actions[k] = (c.actions[k] || 0) + v
      }
    }
    const campaigns = Array.from(campaignMap.values()).map(c => ({
      ...c,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    }))

    res.json({ ads, campaigns, since: sinceDate, until: untilDate })
  } catch (err) {
    console.error('Ads analytics error:', err)
    res.status(500).json({ error: 'Failed to fetch ads analytics' })
  }
}
