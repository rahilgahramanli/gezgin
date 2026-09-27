import {
  useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient,
} from '@tanstack/react-query';
import { api } from '@/api/client';
import { alertError } from '@/lib/errors';
import { qs } from '@/api/hooks/content';
import { meKeys } from '@/api/hooks/me';
import type { XpReward } from '@/api/hooks/gamification';

/**
 * Sprint 7 — sosial lent, hekayə, profil, çat, bildiriş, rəy yazma.
 * Formalar `apps/api/src/modules/{posts,users,stories,chat,community,reviews}`
 * cavablarıdır; `__tests__/contract.test.ts` onları canlı API ilə yoxlayır.
 */

// ─────────────────── tiplər ───────────────────

export interface UserCard {
  username: string;
  fullName: string;
  avatarUrl: string | null;
  level: number;
  tier: string;
  role: string;
  isLocalExpert: boolean;
  isVerified: boolean;
}

export interface PostMedia {
  url: string | null;
  type: 'image' | 'video';
  width: number | null;
  height: number | null;
  blurhash: string | null;
}

export type PostVisibility = 'public' | 'followers' | 'private';
export type FeedTab = 'for_you' | 'following' | 'nearby';

export interface Post {
  publicId: string;
  body: string | null;
  hashtags: string[];
  visibility: PostVisibility;
  createdAt: string;
  author: UserCard;
  media: PostMedia[];
  place: { slug: string; name: string; region: string | null; rating: number } | null;
  route: { slug: string; title: string; days: number } | null;
  /** "Quba, Azərbaycan" */
  location: string | null;
  counts: { likes: number; comments: number; shares: number; saves: number };
  viewer: { liked: boolean; saved: boolean; followsAuthor: boolean; isMine: boolean };
  /** Yalnız Nearby tabında. */
  distanceKm?: number | null;
}

export interface CreatedPost extends Post {
  rewards: XpReward | null;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export interface OffsetPage<T> {
  data: T[];
  nextOffset: number | null;
  total: number;
}

export interface PostComment {
  publicId: string;
  body: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  isMine: boolean;
  canDelete: boolean;
  author: UserCard;
  replies: PostComment[];
}

export interface StoryRing {
  user: UserCard;
  storyCount: number;
  hasUnseen: boolean;
  latestAt: string;
  coverUrl: string | null;
  isMine: boolean;
}

export interface Story {
  publicId: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'video';
  width: number | null;
  height: number | null;
  caption: string | null;
  place: { slug: string; name: string; region: string | null } | null;
  createdAt: string;
  expiresAt: string;
  viewed: boolean;
  /** Yalnız müəllifə gəlir. */
  viewCount?: number;
}

export interface UserProfile extends UserCard {
  bio: string | null;
  coverUrl: string | null;
  homeRegion: { slug: string; name: string } | null;
  isPublic: boolean;
  gezginScore: number;
  stats: { posts: number; followers: number; following: number; routes: number; badges: number };
  expert: { rating: number; ratingCount: number; experienceCount: number; specialties: string[] } | null;
  viewer: { isMe: boolean; isFollowing: boolean; followsYou: boolean; canMessage: boolean };
  /** Qapalı hesabda yad adam üçün `false`. */
  canViewContent: boolean;
  joinedAt: string;
}

export interface FollowRow extends UserCard {
  isFollowing: boolean;
  isMe: boolean;
}

export interface SuggestedUser extends UserCard {
  region: string | null;
  isFollowing: boolean;
  reason: string;
}

export interface UserRoute {
  slug: string;
  title: string;
  days: number;
  difficulty: string;
  categories: string[];
  stopCount: number;
  rating: number;
  ratingCount: number;
  copyCount: number;
  visibility: string;
  coverUrl: string | null;
  region: { slug: string; name: string };
}

export interface UserBadge {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  tier: string | null;
  conditionValue: number;
  progress: number;
  percent: number;
  earned: boolean;
  earnedAt: string | null;
}

export interface AppNotification {
  publicId: string;
  type: string;
  category: 'social' | 'system';
  title: string;
  body: string | null;
  imageUrl: string | null;
  deepLink: string | null;
  targetType: string | null;
  actor: UserCard | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsPage extends CursorPage<AppNotification> {
  unreadCount: number;
}

export type ConversationFilter = 'all' | 'experts' | 'business' | 'travelers';

export interface ConversationItem {
  publicId: string;
  type: 'direct' | 'support';
  other: UserCard | null;
  title: string;
  lastMessage: { preview: string | null; at: string } | null;
  unreadCount: number;
  isMuted: boolean;
}

export interface ConversationsResponse {
  data: ConversationItem[];
  nextOffset: number | null;
  total: number;
  unreadTotal: number;
}

export interface ConversationDetail {
  publicId: string;
  type: 'direct' | 'support';
  other: (UserCard & { isOnline: boolean; lastActiveAt: string | null }) | null;
  participants: UserCard[];
  unreadCount: number;
  isBlocked: boolean;
  createdAt: string;
}

export interface ExperienceCardPayload {
  kind: 'experience';
  slug: string;
  title: string;
  priceAzn: number;
  durationText: string | null;
  rating: number;
  region: string | null;
  imageUrl: string | null;
}

export interface RouteCardPayload {
  kind: 'route';
  slug: string;
  title: string;
  days: number;
  stopCount: number;
  rating: number;
  region: string | null;
  imageUrl: string | null;
}

export interface ChatMessage {
  publicId: string;
  type: 'text' | 'image' | 'experience_card' | 'route_card' | 'booking_card' | 'system';
  body: string | null;
  mediaUrl: string | null;
  payload: ExperienceCardPayload | RouteCardPayload | null;
  createdAt: string;
  sender: { username: string };
  isMine: boolean;
  /** Yalnız öz mesajlarında. */
  isRead?: boolean;
}

export type ReviewTargetType = 'place' | 'route' | 'experience' | 'business';

export interface WrittenReview {
  publicId: string;
  rating: number;
  body: string | null;
  tags: string[];
  isMine: boolean;
  rewards?: XpReward | null;
}

// ─────────────────── keş açarları ───────────────────

export const socialKeys = {
  feed: (tab: FeedTab, near?: string) => ['feed', tab, near ?? null] as const,
  post: (publicId: string) => ['post', publicId] as const,
  comments: (publicId: string) => ['post', publicId, 'comments'] as const,
  stories: ['stories'] as const,
  userStories: (username: string) => ['stories', 'user', username] as const,
  user: (username: string) => ['user', username] as const,
  userPosts: (username: string) => ['user', username, 'posts'] as const,
  userRoutes: (username: string) => ['user', username, 'routes'] as const,
  userBadges: (username: string) => ['user', username, 'badges'] as const,
  followList: (username: string, kind: 'followers' | 'following') => ['user', username, kind] as const,
  suggested: ['users', 'suggested'] as const,
  notifications: (tab: string) => ['notifications', tab] as const,
  notificationBadge: ['notifications', 'badge'] as const,
  conversations: (filter: ConversationFilter) => ['conversations', filter] as const,
  chatBadge: ['conversations', 'badge'] as const,
  conversation: (publicId: string) => ['conversation', publicId] as const,
  messages: (publicId: string) => ['conversation', publicId, 'messages'] as const,
};

// ─────────────────── lent (ekran 05, 06) ───────────────────

export function useFeed(tab: FeedTab, near?: { lat: number; lng: number } | null) {
  const nearKey = near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : undefined;
  return useInfiniteQuery({
    queryKey: socialKeys.feed(tab, nearKey),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<CursorPage<Post>>(
        `/feed${qs({ tab, cursor: pageParam, limit: 10, ...(tab === 'nearby' && near ? { lat: near.lat, lng: near.lng } : {}) })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Nearby mövqesiz sorğu göndərmir — server 400 qaytarardı
    enabled: tab !== 'nearby' || !!near,
  });
}

export const usePost = (publicId: string) =>
  useQuery({ queryKey: socialKeys.post(publicId), queryFn: () => api<Post>(`/posts/${publicId}`) });

/** Paylaşımın bütün keşlərdəki nüsxəsi — lent, profil və detal eyni anda dəyişir. */
function patchPost(qc: QueryClient, publicId: string, patch: (p: Post) => Post): void {
  const inPage = (page: CursorPage<Post>) => ({
    ...page,
    data: page.data.map((p) => (p.publicId === publicId ? patch(p) : p)),
  });
  const inPages = (data: InfiniteData<CursorPage<Post>> | undefined) =>
    data ? { ...data, pages: data.pages.map(inPage) } : data;

  qc.setQueriesData<InfiniteData<CursorPage<Post>>>({ queryKey: ['feed'] }, inPages);
  qc.setQueriesData<InfiniteData<CursorPage<Post>>>(
    { predicate: (q) => q.queryKey[0] === 'user' && q.queryKey[2] === 'posts' },
    inPages,
  );
  qc.setQueryData<Post>(socialKeys.post(publicId), (p) => (p ? patch(p) : p));
}

export interface CreatePostInput {
  body?: string;
  media?: string[];
  place?: string;
  route?: string;
  visibility?: PostVisibility;
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePostInput) => api<CreatedPost>('/posts', { method: 'POST', body }),
    onSuccess: (post) => {
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: socialKeys.userPosts(post.author.username) });
      void qc.invalidateQueries({ queryKey: meKeys.stats });
      void qc.invalidateQueries({ queryKey: meKeys.profile });
    },
  });
}

export function useLikePost() {
  const qc = useQueryClient();
  const toggle = (publicId: string, liked: boolean) =>
    patchPost(qc, publicId, (p) => ({
      ...p,
      viewer: { ...p.viewer, liked },
      counts: { ...p.counts, likes: Math.max(0, p.counts.likes + (liked ? 1 : -1)) },
    }));

  return useMutation({
    mutationFn: ({ publicId, like }: { publicId: string; like: boolean }) =>
      api<{ liked: boolean; likeCount: number }>(`/posts/${publicId}/like`, { method: like ? 'POST' : 'DELETE' }),
    // Ürək dərhal dolur; server cavabı sayı dəqiqləşdirir, xəta olsa geri qaytarılır
    onMutate: ({ publicId, like }) => toggle(publicId, like),
    onSuccess: (res, { publicId }) =>
      patchPost(qc, publicId, (p) => ({
        ...p,
        viewer: { ...p.viewer, liked: res.liked },
        counts: { ...p.counts, likes: res.likeCount },
      })),
    onError: (error, { publicId, like }) => {
      toggle(publicId, !like);
      alertError(error, 'Bəyənmək alınmadı');
    },
  });
}

export function useSavePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, save }: { publicId: string; save: boolean }) =>
      api<{ saved: boolean; saveCount: number }>(`/posts/${publicId}/save`, { method: save ? 'POST' : 'DELETE' }),
    onMutate: ({ publicId, save }) =>
      patchPost(qc, publicId, (p) => ({ ...p, viewer: { ...p.viewer, saved: save } })),
    onSuccess: (res, { publicId }) => {
      patchPost(qc, publicId, (p) => ({
        ...p,
        viewer: { ...p.viewer, saved: res.saved },
        counts: { ...p.counts, saves: res.saveCount },
      }));
      void qc.invalidateQueries({ queryKey: ['saved'] });
    },
    onError: (error, { publicId, save }) => {
      patchPost(qc, publicId, (p) => ({ ...p, viewer: { ...p.viewer, saved: !save } }));
      alertError(error, 'Saxlamaq alınmadı');
    },
  });
}

export function useSharePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) =>
      api<{ shareUrl: string; shareCount: number }>(`/posts/${publicId}/share`, { method: 'POST' }),
    onSuccess: (res, publicId) =>
      patchPost(qc, publicId, (p) => ({ ...p, counts: { ...p.counts, shares: res.shareCount } })),
  });
}

export const REPORT_REASONS = [
  { code: 'spam', label: 'Spam və ya reklam' },
  { code: 'inappropriate', label: 'Uyğunsuz kontent' },
  { code: 'harassment', label: 'Təhqir və ya təzyiq' },
  { code: 'false_info', label: 'Yanlış məlumat' },
  { code: 'copyright', label: 'Müəllif hüququ' },
  { code: 'other', label: 'Digər' },
] as const;

export const useReportUser = () =>
  useMutation({
    mutationFn: ({ username, reason }: { username: string; reason: string }) =>
      api<{ reported: boolean; duplicate: boolean }>(`/users/${username}/report`, { method: 'POST', body: { reason } }),
  });

/** Bloklama: qarşılıqlı izləmələr silinir, onun kontenti lentdən, söhbət siyahısından çıxır. */
export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => api(`/me/blocked/${username}`, { method: 'POST' }),
    onSuccess: (_r, username) => {
      qc.removeQueries({ queryKey: socialKeys.user(username) });
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: socialKeys.stories });
      void qc.invalidateQueries({ queryKey: ['me', 'blocked'] });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      void qc.invalidateQueries({ queryKey: meKeys.stats });
    },
  });
}

export const useReportPost = () =>
  useMutation({
    mutationFn: ({ publicId, reason }: { publicId: string; reason: string }) =>
      api<{ reported: boolean; duplicate: boolean }>(`/posts/${publicId}/report`, { method: 'POST', body: { reason } }),
  });

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => api<{ deleted: boolean }>(`/posts/${publicId}`, { method: 'DELETE' }),
    onSuccess: (_r, publicId) => {
      qc.removeQueries({ queryKey: socialKeys.post(publicId) });
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'user' && q.queryKey[2] === 'posts' });
      void qc.invalidateQueries({ queryKey: meKeys.stats });
    },
  });
}

// ─────────────────── şərhlər (ekran 06) ───────────────────

export const useComments = (publicId: string) =>
  useInfiniteQuery({
    queryKey: socialKeys.comments(publicId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<CursorPage<PostComment> & { total: number }>(`/posts/${publicId}/comments${qs({ cursor: pageParam })}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export function useAddComment(postPublicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body: string; parent?: string }) =>
      api<PostComment & { commentCount: number }>(`/posts/${postPublicId}/comments`, { method: 'POST', body }),
    onSuccess: (res) => {
      patchPost(qc, postPublicId, (p) => ({ ...p, counts: { ...p.counts, comments: res.commentCount } }));
      void qc.invalidateQueries({ queryKey: socialKeys.comments(postPublicId) });
    },
  });
}

export function useDeleteComment(postPublicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentPublicId: string) =>
      api<{ deleted: boolean; commentCount: number }>(`/comments/${commentPublicId}`, { method: 'DELETE' }),
    onSuccess: (res) => {
      patchPost(qc, postPublicId, (p) => ({ ...p, counts: { ...p.counts, comments: res.commentCount } }));
      void qc.invalidateQueries({ queryKey: socialKeys.comments(postPublicId) });
    },
  });
}

export function useLikeComment(postPublicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, like }: { publicId: string; like: boolean }) =>
      api<{ liked: boolean; likeCount: number }>(`/comments/${publicId}/like`, { method: like ? 'POST' : 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: socialKeys.comments(postPublicId) }),
  });
}

// ─────────────────── hekayələr (ekran 05, 40) ───────────────────

export const useStoryRings = () =>
  useQuery({
    queryKey: socialKeys.stories,
    queryFn: () => api<{ data: StoryRing[]; hasMine: boolean }>('/stories'),
  });

export const useUserStories = (username: string) =>
  useQuery({
    queryKey: socialKeys.userStories(username),
    queryFn: () => api<{ user: UserCard; data: Story[] }>(`/stories/${username}`),
  });

/** Öz hekayəni silmək — dairələr və müəllifin hekayə siyahısı yenilənir. */
export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => api(`/stories/${publicId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: socialKeys.stories });
    },
  });
}

/** Baxış keşi dərhal yeniləmir — dairələr baxış ekranı bağlananda bir dəfə yenilənir. */
export const useViewStory = () =>
  useMutation({
    mutationFn: (publicId: string) => api<{ viewed: boolean }>(`/stories/${publicId}/view`, { method: 'POST' }),
  });

export function useCreateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { media: string; caption?: string; place?: string }) =>
      api<{ publicId: string; expiresAt: string }>('/stories', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: socialKeys.stories }),
  });
}

// ─────────────────── istifadəçilər (ekran 41, 42) ───────────────────

export const useUserProfile = (username: string) =>
  useQuery({ queryKey: socialKeys.user(username), queryFn: () => api<UserProfile>(`/users/${username}`) });

export const useUserPosts = (username: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: socialKeys.userPosts(username),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<CursorPage<Post>>(`/users/${username}/posts${qs({ cursor: pageParam, limit: 18 })}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });

export const useUserRoutes = (username: string, enabled = true) =>
  useQuery({
    queryKey: socialKeys.userRoutes(username),
    queryFn: () => api<OffsetPage<UserRoute>>(`/users/${username}/routes?limit=30`),
    enabled,
  });

export const useUserBadges = (username: string, enabled = true) =>
  useQuery({
    queryKey: socialKeys.userBadges(username),
    queryFn: () => api<{ earnedCount: number; totalCount: number; badges: UserBadge[] }>(`/users/${username}/badges`),
    enabled,
  });

export const useFollowList = (username: string, kind: 'followers' | 'following') =>
  useInfiniteQuery({
    queryKey: socialKeys.followList(username, kind),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api<OffsetPage<FollowRow>>(`/users/${username}/${kind}${qs({ offset: pageParam })}`),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });

export const useSuggested = (enabled = true) =>
  useQuery({
    queryKey: socialKeys.suggested,
    queryFn: () => api<{ data: SuggestedUser[] }>('/users/suggested'),
    enabled,
  });

export function useFollow() {
  const qc = useQueryClient();
  const patchLists = (username: string, isFollowing: boolean) =>
    qc.setQueriesData<InfiniteData<OffsetPage<FollowRow>>>(
      { predicate: (q) => q.queryKey[0] === 'user' && (q.queryKey[2] === 'followers' || q.queryKey[2] === 'following') },
      (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            data: p.data.map((r) => (r.username === username ? { ...r, isFollowing } : r)),
          })),
        },
    );

  return useMutation({
    mutationFn: ({ username, follow }: { username: string; follow: boolean }) =>
      api<{ following: boolean; followers: number }>(`/users/${username}/follow`, { method: follow ? 'POST' : 'DELETE' }),
    onMutate: ({ username, follow }) => {
      const previous = qc.getQueryData<UserProfile>(socialKeys.user(username));
      qc.setQueryData<UserProfile>(socialKeys.user(username), (u) =>
        u && {
          ...u,
          viewer: { ...u.viewer, isFollowing: follow },
          stats: { ...u.stats, followers: Math.max(0, u.stats.followers + (follow ? 1 : -1)) },
        },
      );
      patchLists(username, follow);
      return { previous };
    },
    onSuccess: (res, { username }) =>
      qc.setQueryData<UserProfile>(socialKeys.user(username), (u) =>
        u && { ...u, viewer: { ...u.viewer, isFollowing: res.following }, stats: { ...u.stats, followers: res.followers } },
      ),
    onError: (error, { username, follow }, ctx) => {
      patchLists(username, !follow);
      // Profil kartı da əvvəlki vəziyyətinə qayıdır — qonaqda "İzləyirsən" və +1 qalırdı
      if (ctx?.previous) qc.setQueryData(socialKeys.user(username), ctx.previous);
      alertError(error, 'İzləmək alınmadı');
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['feed', 'following'] });
      void qc.invalidateQueries({ queryKey: socialKeys.suggested });
      void qc.invalidateQueries({ queryKey: meKeys.stats });
    },
  });
}

// ─────────────────── bildirişlər (ekran 07) ───────────────────

export const useNotifications = (tab: 'all' | 'social' | 'system') =>
  useInfiniteQuery({
    queryKey: socialKeys.notifications(tab),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api<NotificationsPage>(`/notifications${qs({ tab, cursor: pageParam })}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** Zəng ikonundakı nöqtə — `notification.new` gələndə körpü bunu yeniləyir. */
export const useNotificationBadge = () =>
  useQuery({
    queryKey: socialKeys.notificationBadge,
    queryFn: async () => (await api<NotificationsPage>('/notifications?limit=1')).unreadCount,
  });

export function useReadAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ unreadCount: number }>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useReadNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => api<{ unreadCount: number }>(`/notifications/${publicId}/read`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ─────────────────── çat (ekran 08, 09) ───────────────────

export const useConversations = (filter: ConversationFilter) =>
  useQuery({
    queryKey: socialKeys.conversations(filter),
    queryFn: () => api<ConversationsResponse>(`/conversations${qs({ filter: filter === 'all' ? undefined : filter })}`),
  });

export const useChatBadge = () =>
  useQuery({
    queryKey: socialKeys.chatBadge,
    queryFn: async () => (await api<ConversationsResponse>('/conversations?limit=1')).unreadTotal,
  });

export const useConversation = (publicId: string) =>
  useQuery({
    queryKey: socialKeys.conversation(publicId),
    queryFn: () => api<ConversationDetail>(`/conversations/${publicId}`),
  });

/** Yenidən köhnəyə — ekran tərsinə (inverted) göstərir. */
export const useMessages = (publicId: string) =>
  useInfiniteQuery({
    queryKey: socialKeys.messages(publicId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<CursorPage<ChatMessage>>(`/conversations/${publicId}/messages${qs({ before: pageParam })}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** Yeni mesajı siyahının başına qoyur — HTTP cavabı da, socket hadisəsi də gələ bilər, ona görə təkrarsız. */
export function insertMessage(qc: QueryClient, conversation: string, message: ChatMessage): void {
  qc.setQueryData<InfiniteData<CursorPage<ChatMessage>>>(socialKeys.messages(conversation), (data) => {
    if (!data) return data;
    if (data.pages.some((p) => p.data.some((m) => m.publicId === message.publicId))) return data;
    const [first, ...rest] = data.pages;
    return {
      ...data,
      pages: [{ nextCursor: first?.nextCursor ?? null, data: [message, ...(first?.data ?? [])] }, ...rest],
    };
  });
}

export interface SendMessageInput {
  type?: 'text' | 'image' | 'experience_card' | 'route_card';
  body?: string;
  media?: string;
  target?: string;
}

export function useSendMessage(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SendMessageInput) =>
      api<ChatMessage>(`/conversations/${publicId}/messages`, { method: 'POST', body }),
    onSuccess: (message) => {
      insertMessage(qc, publicId, message);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useReadConversation(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ unreadCount: number }>(`/conversations/${publicId}/read`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export const useOpenConversation = () =>
  useMutation({
    mutationFn: (username: string) =>
      api<ConversationDetail>('/conversations', { method: 'POST', body: { username } }),
  });

// ─────────────────── rəy yazma (ekran 27) ───────────────────

export interface ReviewInput {
  targetType: ReviewTargetType;
  target: string;
  rating: number;
  body?: string;
  tags?: string[];
  photos?: string[];
}

export function useWriteReview() {
  const qc = useQueryClient();
  return useMutation({
    /** `publicId` verilsə mövcud rəy redaktə olunur (409-dan sonra) — fotolar yalnız yaradarkən gedir. */
    mutationFn: ({ publicId, ...input }: ReviewInput & { publicId?: string }) =>
      publicId
        ? api<WrittenReview>(`/reviews/${publicId}`, {
            method: 'PATCH',
            body: { rating: input.rating, body: input.body, tags: input.tags },
          })
        : api<WrittenReview>('/reviews', { method: 'POST', body: input }),
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: ['reviews', v.targetType, v.target] });
      void qc.invalidateQueries({ queryKey: [v.targetType, v.target] });
      void qc.invalidateQueries({ queryKey: meKeys.stats });
    },
  });
}
