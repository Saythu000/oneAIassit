import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export type InstagramMediaType = 'REELS' | 'STORIES' | 'FEED' | 'IMAGE' | 'VIDEO';

export interface InstagramPublishOptions {
  mediaType: InstagramMediaType;
  mediaUrl: string;
  caption?: string;
  coverUrl?: string;
  shareToFeed?: boolean;
}

export interface InstagramPublishResult {
  success: boolean;
  mediaId: string;
  permalink?: string;
  creationId?: string;
  error?: string;
}

export interface InstagramAccountDetails {
  id: string;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  followersCount?: number;
}

export class InstagramPublisher {
  private static readonly GRAPH_API_VERSION = 'v21.0';
  private static readonly BASE_URL = `https://graph.facebook.com/${this.GRAPH_API_VERSION}`;

  /**
   * Retrieves decrypted credentials for a tenant's connected Instagram account
   */
  static async getTenantCredentials(tenantId: string): Promise<{
    instagramId: string;
    accessToken: string;
    username: string;
    pageId: string;
  }> {
    // 1. Try dedicated InstagramAccount model
    const account = await prisma.instagramAccount.findUnique({
      where: { tenantId },
    });

    if (account && account.pageAccessToken) {
      let accessToken = account.pageAccessToken;
      try {
        accessToken = decrypt(accessToken);
      } catch {
        // Fallback if stored unencrypted in development/testing
      }

      return {
        instagramId: account.instagramId,
        accessToken,
        username: account.username || '',
        pageId: account.pageId || '',
      };
    }

    // 2. Fallback to PlatformConnection model if present
    const conn = await (prisma as any).platformConnection.findUnique({
      where: {
        tenantId_platform: { tenantId, platform: 'INSTAGRAM' },
      },
    });

    if (conn && conn.accessToken) {
      let accessToken = conn.accessToken;
      try {
        accessToken = decrypt(accessToken);
      } catch {}

      return {
        instagramId: conn.accountName?.replace(/^@/, '') || '',
        accessToken,
        username: conn.accountName || '',
        pageId: '',
      };
    }

    throw new Error(`No Instagram account credentials found for tenant ${tenantId}. Please connect Instagram in Settings.`);
  }

  /**
   * Verifies account credentials and retrieves live Instagram account information from Meta
   */
  static async verifyAccount(tenantId: string): Promise<{
    valid: boolean;
    account?: InstagramAccountDetails;
    error?: string;
  }> {
    try {
      const { instagramId, accessToken } = await this.getTenantCredentials(tenantId);

      if (!instagramId || !accessToken) {
        return { valid: false, error: 'Incomplete credentials: Instagram Account ID and Access Token required.' };
      }

      const url = `${this.BASE_URL}/${instagramId}?fields=id,username,name,profile_picture_url,followers_count&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data?.error?.message || `Meta Graph API verification failed with HTTP ${res.status}`;
        console.error('[InstagramPublisher.verifyAccount] Meta API Error:', data);
        return { valid: false, error: errorMsg };
      }

      return {
        valid: true,
        account: {
          id: data.id,
          username: data.username,
          name: data.name,
          profilePictureUrl: data.profile_picture_url,
          followersCount: data.followers_count,
        },
      };
    } catch (err: any) {
      console.error('[InstagramPublisher.verifyAccount] Exception:', err);
      return { valid: false, error: err?.message || 'Verification exception occurred' };
    }
  }

  /**
   * Publishes content (Reel, Story, or Feed Post) to Instagram using Meta's 3-step Container Workflow
   */
  static async publishMedia(tenantId: string, options: InstagramPublishOptions): Promise<InstagramPublishResult> {
    const { instagramId, accessToken } = await this.getTenantCredentials(tenantId);
    const { mediaType, mediaUrl, caption = '', coverUrl, shareToFeed = true } = options;

    if (!mediaUrl) {
      throw new Error('mediaUrl is required for Instagram publishing');
    }

    const isVideo = mediaUrl.match(/\.(mp4|mov|webm)(\?.*)?$/i) !== null || mediaType === 'REELS';
    const isReel = mediaType === 'REELS';
    const requiresPolling = isVideo || isReel;

    console.log(`[InstagramPublisher] Starting publish for tenant ${tenantId} | Type: ${mediaType} | Media: ${mediaUrl}`);

    // =========================================================================
    // STEP 1: CREATE MEDIA CONTAINER
    // =========================================================================
    const containerParams: Record<string, any> = {
      access_token: accessToken,
    };

    if (mediaType === 'REELS') {
      containerParams.media_type = 'REELS';
      containerParams.video_url = mediaUrl;
      if (caption) containerParams.caption = caption;
      if (coverUrl) containerParams.cover_url = coverUrl;
      containerParams.share_to_feed = shareToFeed;
    } else if (mediaType === 'STORIES') {
      containerParams.media_type = 'STORIES';
      if (isVideo) {
        containerParams.video_url = mediaUrl;
      } else {
        containerParams.image_url = mediaUrl;
      }
    } else {
      // FEED POST (Single Image or Single Video)
      if (isVideo) {
        containerParams.media_type = 'VIDEO';
        containerParams.video_url = mediaUrl;
      } else {
        containerParams.image_url = mediaUrl;
      }
      if (caption) containerParams.caption = caption;
    }

    const createContainerUrl = `${this.BASE_URL}/${instagramId}/media`;
    const createRes = await fetch(createContainerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerParams),
    });

    const createData = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !createData.id) {
      const errorMsg = createData?.error?.message || `Failed to create container (HTTP ${createRes.status})`;
      console.error('[InstagramPublisher] Container creation failed:', createData);
      throw new Error(`Meta Graph API Container Error: ${errorMsg}`);
    }

    const creationId = createData.id;
    console.log(`[InstagramPublisher] Container created successfully: ${creationId}`);

    // =========================================================================
    // STEP 2: POLL STATUS CODE FOR PROCESSING (Videos and Reels)
    // =========================================================================
    if (requiresPolling) {
      console.log(`[InstagramPublisher] Polling transcoding status for container ${creationId}...`);
      const isFinished = await this.pollContainerStatus(creationId, accessToken, 20, 3000);
      if (!isFinished) {
        throw new Error(`Media transcoding timed out or failed for container ${creationId}.`);
      }
    }

    // =========================================================================
    // STEP 3: PUBLISH CONTAINER
    // =========================================================================
    const publishUrl = `${this.BASE_URL}/${instagramId}/media_publish`;
    const publishRes = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    });

    const publishData = await publishRes.json().catch(() => ({}));
    if (!publishRes.ok || !publishData.id) {
      const errorMsg = publishData?.error?.message || `Publish call failed (HTTP ${publishRes.status})`;
      console.error('[InstagramPublisher] Media publish failed:', publishData);
      throw new Error(`Meta Graph API Publish Error: ${errorMsg}`);
    }

    const publishedMediaId = publishData.id;
    console.log(`[InstagramPublisher] Media published live! ID: ${publishedMediaId}`);

    // =========================================================================
    // STEP 4: FETCH PERMALINK
    // =========================================================================
    let permalink: string | undefined = undefined;
    try {
      const detailsUrl = `${this.BASE_URL}/${publishedMediaId}?fields=permalink,shortcode&access_token=${encodeURIComponent(accessToken)}`;
      const detailsRes = await fetch(detailsUrl);
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        permalink = detailsData.permalink || (detailsData.shortcode ? `https://www.instagram.com/p/${detailsData.shortcode}/` : undefined);
      }
    } catch (detailsErr) {
      console.warn('[InstagramPublisher] Could not fetch permalink:', detailsErr);
    }

    return {
      success: true,
      mediaId: publishedMediaId,
      creationId,
      permalink: permalink || `https://www.instagram.com/p/${publishedMediaId}/`,
    };
  }

  /**
   * Helper that polls container status until FINISHED or ERROR
   */
  private static async pollContainerStatus(
    creationId: string,
    accessToken: string,
    maxAttempts = 20,
    delayMs = 3000
  ): Promise<boolean> {
    const statusUrl = `${this.BASE_URL}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      try {
        const res = await fetch(statusUrl);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          console.warn(`[InstagramPublisher.poll] Attempt ${attempt} failed with HTTP ${res.status}`);
          continue;
        }

        const statusCode = data.status_code;
        console.log(`[InstagramPublisher.poll] Attempt ${attempt}/${maxAttempts} - Container status: ${statusCode}`);

        if (statusCode === 'FINISHED') {
          return true;
        }

        if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
          throw new Error(`Container processing failed with status '${statusCode}'. Meta reason: ${data.status || 'unknown'}`);
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Container processing failed')) {
          throw err;
        }
        console.warn(`[InstagramPublisher.poll] Poll attempt ${attempt} warning:`, err?.message || err);
      }
    }

    return false;
  }
}
