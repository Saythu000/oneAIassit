import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export interface FacebookPublishOptions {
  message?: string;
  mediaUrl?: string;
  link?: string;
  title?: string;
}

export interface FacebookPublishResult {
  success: boolean;
  postId: string;
  permalink?: string;
  error?: string;
}

export interface FacebookPageDetails {
  id: string;
  name: string;
  category?: string;
  link?: string;
  fanCount?: number;
  pictureUrl?: string;
  isPublished?: boolean;
}

export class FacebookPublisher {
  private static readonly GRAPH_API_VERSION = 'v21.0';
  private static readonly BASE_URL = `https://graph.facebook.com/${this.GRAPH_API_VERSION}`;

  /**
   * Retrieves decrypted credentials for a tenant's connected Facebook Page
   * Checks dedicated PlatformConnection (FACEBOOK) first, then falls back to InstagramAccount's linked Facebook Page.
   */
  static async getTenantCredentials(tenantId: string): Promise<{
    pageId: string;
    accessToken: string;
    pageName: string;
  }> {
    // 1. Try PlatformConnection for FACEBOOK
    const conn = await (prisma as any).platformConnection.findUnique({
      where: {
        tenantId_platform: { tenantId, platform: 'FACEBOOK' },
      },
    });

    if (conn && conn.accessToken) {
      let accessToken = conn.accessToken;
      try {
        accessToken = decrypt(accessToken);
      } catch {
        // Fallback if stored unencrypted
      }

      // Check if accountName stores Page ID or Page Name
      let pageId = conn.accountName || '';
      // If accountName has format "id:name", parse it
      if (pageId.includes('|')) {
        const [id, name] = pageId.split('|');
        return { pageId: id.trim(), accessToken, pageName: name.trim() };
      }

      // If pageId is not numeric, check if InstagramAccount has the numeric pageId
      if (!pageId.match(/^\d+$/)) {
        const ig = await prisma.instagramAccount.findUnique({ where: { tenantId } });
        if (ig?.pageId) {
          return { pageId: ig.pageId, accessToken, pageName: conn.accountName || 'Facebook Page' };
        }
      }

      return {
        pageId,
        accessToken,
        pageName: conn.accountName || 'Facebook Page',
      };
    }

    // 2. Fallback to InstagramAccount model (Instagram accounts are linked directly to Facebook Pages)
    const igAccount = await prisma.instagramAccount.findUnique({
      where: { tenantId },
    });

    if (igAccount && igAccount.pageId && igAccount.pageAccessToken) {
      let accessToken = igAccount.pageAccessToken;
      try {
        accessToken = decrypt(accessToken);
      } catch {}

      return {
        pageId: igAccount.pageId,
        accessToken,
        pageName: igAccount.username ? `${igAccount.username} (Page)` : 'Facebook Page',
      };
    }

    // 3. Fallback to environment variables if provided
    if (process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
      return {
        pageId: process.env.FACEBOOK_PAGE_ID,
        accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
        pageName: 'Default Facebook Page',
      };
    }

    throw new Error(
      `No Facebook Page credentials found for tenant ${tenantId}. Please connect Facebook or Instagram in Settings.`
    );
  }

  /**
   * Verifies Page credentials and retrieves live Page information from Meta
   */
  static async verifyPage(tenantId: string): Promise<{
    valid: boolean;
    page?: FacebookPageDetails;
    error?: string;
  }> {
    try {
      const { pageId, accessToken } = await this.getTenantCredentials(tenantId);

      if (!pageId || !accessToken) {
        return { valid: false, error: 'Incomplete credentials: Page ID and Page Access Token required.' };
      }

      const url = `${this.BASE_URL}/${pageId}?fields=id,name,category,link,picture,fan_count,is_published&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data?.error?.message || `Meta Graph API verification failed with HTTP ${res.status}`;
        console.error('[FacebookPublisher.verifyPage] Meta API Error:', data);
        return { valid: false, error: errorMsg };
      }

      return {
        valid: true,
        page: {
          id: data.id,
          name: data.name,
          category: data.category,
          link: data.link || `https://www.facebook.com/${data.id}`,
          fanCount: data.fan_count,
          pictureUrl: data.picture?.data?.url,
          isPublished: data.is_published,
        },
      };
    } catch (err: any) {
      console.error('[FacebookPublisher.verifyPage] Exception:', err);
      return { valid: false, error: err?.message || 'Verification exception occurred' };
    }
  }

  /**
   * Publishes content to the connected Facebook Page:
   * - Photo if mediaUrl is an image
   * - Video if mediaUrl is a video
   * - Status / Link feed update if no mediaUrl
   */
  static async publishPost(
    tenantId: string,
    options: FacebookPublishOptions
  ): Promise<FacebookPublishResult> {
    const { pageId, accessToken } = await this.getTenantCredentials(tenantId);
    const { message = '', mediaUrl, link, title } = options;

    if (!pageId || !accessToken) {
      throw new Error('Missing Facebook Page ID or Access Token');
    }

    // Determine post type based on mediaUrl
    const isVideo = mediaUrl && !!mediaUrl.match(/\.(mp4|mov|webm)(\?.*)?$/i);
    const isImage = mediaUrl && !isVideo;

    try {
      if (isVideo) {
        // 1. Post Video: POST /{page-id}/videos
        const videoRes = await fetch(`${this.BASE_URL}/${pageId}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_url: mediaUrl,
            description: message,
            title: title || undefined,
            access_token: accessToken,
          }),
        });

        const videoData = await videoRes.json().catch(() => ({}));
        if (!videoRes.ok || !videoData.id) {
          throw new Error(videoData?.error?.message || `Failed to publish video to Facebook (HTTP ${videoRes.status})`);
        }

        const permalink = `https://www.facebook.com/${pageId}/videos/${videoData.id}`;
        return {
          success: true,
          postId: videoData.id,
          permalink,
        };
      } else if (isImage) {
        // 2. Post Photo: POST /{page-id}/photos
        const photoRes = await fetch(`${this.BASE_URL}/${pageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: mediaUrl,
            caption: message,
            published: true,
            access_token: accessToken,
          }),
        });

        const photoData = await photoRes.json().catch(() => ({}));
        if (!photoRes.ok || !photoData.id) {
          throw new Error(photoData?.error?.message || `Failed to publish photo to Facebook (HTTP ${photoRes.status})`);
        }

        const effectivePostId = photoData.post_id || photoData.id;
        const permalink = `https://www.facebook.com/${effectivePostId.replace('_', '/posts/')}`;
        return {
          success: true,
          postId: effectivePostId,
          permalink,
        };
      } else {
        // 3. Post Feed Text / Link: POST /{page-id}/feed
        const feedBody: Record<string, any> = {
          message,
          access_token: accessToken,
        };
        if (link) {
          feedBody.link = link;
        }

        const feedRes = await fetch(`${this.BASE_URL}/${pageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedBody),
        });

        const feedData = await feedRes.json().catch(() => ({}));
        if (!feedRes.ok || !feedData.id) {
          throw new Error(feedData?.error?.message || `Failed to publish post to Facebook Page (HTTP ${feedRes.status})`);
        }

        // Post IDs on feed are typically formatted as "{page-id}_{post-id}"
        const permalink = `https://www.facebook.com/${feedData.id.replace('_', '/posts/')}`;
        return {
          success: true,
          postId: feedData.id,
          permalink,
        };
      }
    } catch (err: any) {
      console.error('[FacebookPublisher.publishPost] Publish failed:', err);
      throw err;
    }
  }
}
