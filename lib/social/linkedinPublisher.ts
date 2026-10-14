import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export interface LinkedinPublishOptions {
  text?: string;
  mediaUrl?: string;
  link?: string;
  title?: string;
}

export interface LinkedinPublishResult {
  success: boolean;
  postId: string;
  permalink?: string;
  error?: string;
}

export interface LinkedinProfileDetails {
  id: string;
  name: string;
  vanityName?: string;
  email?: string;
  pictureUrl?: string;
  authorType: 'ORGANIZATION' | 'PERSON';
}

export class LinkedinPublisher {
  private static readonly API_BASE = 'https://api.linkedin.com/v2';

  /**
   * Retrieves decrypted credentials for a tenant's connected LinkedIn account
   */
  static async getTenantCredentials(tenantId: string): Promise<{
    authorUrn: string;
    accessToken: string;
    accountName: string;
    authorType: 'ORGANIZATION' | 'PERSON';
  }> {
    // 1. Try PlatformConnection for LINKEDIN
    const conn = await (prisma as any).platformConnection.findUnique({
      where: {
        tenantId_platform: { tenantId, platform: 'LINKEDIN' },
      },
    });

    if (conn && conn.accessToken) {
      let accessToken = conn.accessToken;
      try {
        accessToken = decrypt(accessToken);
      } catch {
        // Fallback if stored unencrypted
      }

      let authorUrn = '';
      let accountName = conn.accountName || 'LinkedIn Account';

      // accountName can store "urn:li:... | Name" or just URN
      if (accountName.includes('|')) {
        const parts = accountName.split('|');
        authorUrn = parts[0].trim();
        accountName = parts[1].trim();
      } else if (accountName.startsWith('urn:li:')) {
        authorUrn = accountName.trim();
      }

      // If authorUrn isn't formatted, format by numeric or default
      if (!authorUrn.startsWith('urn:li:')) {
        if (authorUrn.match(/^\d+$/)) {
          authorUrn = `urn:li:organization:${authorUrn}`;
        } else if (authorUrn) {
          authorUrn = `urn:li:person:${authorUrn}`;
        }
      }

      const authorType = authorUrn.includes('organization') ? 'ORGANIZATION' : 'PERSON';

      return {
        authorUrn,
        accessToken,
        accountName,
        authorType,
      };
    }

    // 2. Fallback to environment variables if provided
    if (process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN) {
      const authorUrn = process.env.LINKEDIN_AUTHOR_URN;
      return {
        authorUrn,
        accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
        accountName: 'Default LinkedIn Account',
        authorType: authorUrn.includes('organization') ? 'ORGANIZATION' : 'PERSON',
      };
    }

    throw new Error(
      `No LinkedIn credentials found for tenant ${tenantId}. Please connect LinkedIn in Settings.`
    );
  }

  /**
   * Verifies LinkedIn access token and retrieves profile or company details
   */
  static async verifyConnection(tenantId: string): Promise<{
    valid: boolean;
    profile?: LinkedinProfileDetails;
    error?: string;
  }> {
    try {
      const { authorUrn, accessToken, authorType } = await this.getTenantCredentials(tenantId);

      if (!accessToken) {
        return { valid: false, error: 'Incomplete credentials: Access token required.' };
      }

      // 1. If Person, test OpenID /userinfo endpoint
      if (authorType === 'PERSON') {
        const res = await fetch(`${this.API_BASE}/userinfo`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            valid: false,
            error: data?.message || `LinkedIn API verification failed with HTTP ${res.status}`,
          };
        }

        return {
          valid: true,
          profile: {
            id: authorUrn || `urn:li:person:${data.sub}`,
            name: data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim() || 'LinkedIn Member',
            email: data.email,
            pictureUrl: data.picture,
            authorType: 'PERSON',
          },
        };
      }

      // 2. If Organization, test organization or entity endpoint
      const orgId = authorUrn.replace('urn:li:organization:', '');
      const orgRes = await fetch(`${this.API_BASE}/organizations/${orgId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      const orgData = await orgRes.json().catch(() => ({}));

      if (!orgRes.ok) {
        // Fallback: Check userinfo to confirm token is at least valid
        const userCheck = await fetch(`${this.API_BASE}/userinfo`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (userCheck.ok) {
          return {
            valid: true,
            profile: {
              id: authorUrn,
              name: `Organization (${orgId})`,
              authorType: 'ORGANIZATION',
            },
          };
        }

        return {
          valid: false,
          error: orgData?.message || `LinkedIn Organization verification failed with HTTP ${orgRes.status}`,
        };
      }

      const orgName = orgData.localizedName || orgData.vanityName || `Organization (${orgId})`;
      return {
        valid: true,
        profile: {
          id: authorUrn,
          name: orgName,
          vanityName: orgData.vanityName,
          authorType: 'ORGANIZATION',
        },
      };
    } catch (err: any) {
      console.error('[LinkedinPublisher.verifyConnection] Exception:', err);
      return { valid: false, error: err?.message || 'Verification exception occurred' };
    }
  }

  /**
   * Registers a digital asset for media upload on LinkedIn
   */
  private static async registerMediaUpload(
    authorUrn: string,
    accessToken: string,
    recipe: 'urn:li:digitalmediaRecipe:feedshare-image' | 'urn:li:digitalmediaRecipe:feedshare-video'
  ): Promise<{ uploadUrl: string; assetUrn: string }> {
    const res = await fetch(`${this.API_BASE}/assets?action=registerUpload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: [recipe],
          owner: authorUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.value) {
      throw new Error(data?.message || `Failed to register LinkedIn asset upload (HTTP ${res.status})`);
    }

    const uploadMechanism = data.value.uploadMechanism?.[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ];
    const uploadUrl = uploadMechanism?.uploadUrl;
    const assetUrn = data.value.asset;

    if (!uploadUrl || !assetUrn) {
      throw new Error('LinkedIn did not return an uploadUrl or asset URN');
    }

    return { uploadUrl, assetUrn };
  }

  /**
   * Publishes content to LinkedIn via the UGC Posts API
   */
  static async publishPost(
    tenantId: string,
    options: LinkedinPublishOptions
  ): Promise<LinkedinPublishResult> {
    const { authorUrn, accessToken } = await this.getTenantCredentials(tenantId);
    const { text = '', mediaUrl, link, title } = options;

    if (!authorUrn || !accessToken) {
      throw new Error('Missing LinkedIn Author URN or Access Token');
    }

    const isVideo = mediaUrl && !!mediaUrl.match(/\.(mp4|mov|webm)(\?.*)?$/i);
    const isImage = mediaUrl && !isVideo;

    try {
      let shareMediaCategory = 'NONE';
      let mediaPayload: any[] = [];

      // 1. Handle Image / Video uploads if mediaUrl is present
      if (isImage || isVideo) {
        try {
          const recipe = isVideo
            ? 'urn:li:digitalmediaRecipe:feedshare-video'
            : 'urn:li:digitalmediaRecipe:feedshare-image';

          const { uploadUrl, assetUrn } = await this.registerMediaUpload(authorUrn, accessToken, recipe);

          // Fetch the media file from mediaUrl and upload binary to LinkedIn
          const mediaFetch = await fetch(mediaUrl);
          if (mediaFetch.ok) {
            const arrayBuf = await mediaFetch.arrayBuffer();
            const uploadRes = await fetch(uploadUrl, {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': isVideo ? 'video/mp4' : 'image/jpeg',
              },
              body: arrayBuf,
            });

            if (uploadRes.ok) {
              shareMediaCategory = isVideo ? 'VIDEO' : 'IMAGE';
              mediaPayload = [
                {
                  status: 'READY',
                  description: { text },
                  media: assetUrn,
                  title: { text: title || 'Post Media' },
                },
              ];
            }
          }
        } catch (mediaErr) {
          console.warn('[LinkedinPublisher] Media upload failed, falling back to link/article preview:', mediaErr);
        }
      }

      // 2. If no direct binary media uploaded, check if link or mediaUrl is used as an article link
      if (shareMediaCategory === 'NONE' && (link || mediaUrl)) {
        shareMediaCategory = 'ARTICLE';
        mediaPayload = [
          {
            status: 'READY',
            description: { text },
            originalUrl: link || mediaUrl,
            title: { text: title || 'Shared Post' },
          },
        ];
      }

      // 3. Construct UGC Post Request Body
      const ugcBody: Record<string, any> = {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text,
            },
            shareMediaCategory,
            ...(mediaPayload.length > 0 ? { media: mediaPayload } : {}),
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      const res = await fetch(`${this.API_BASE}/ugcPosts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(ugcBody),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.id) {
        throw new Error(data?.message || `Failed to publish post to LinkedIn (HTTP ${res.status})`);
      }

      const postId = data.id; // e.g. "urn:li:ugcPost:7123456789"
      const permalink = `https://www.linkedin.com/feed/update/${postId}`;

      return {
        success: true,
        postId,
        permalink,
      };
    } catch (err: any) {
      console.error('[LinkedinPublisher.publishPost] Publish failed:', err);
      throw err;
    }
  }
}
