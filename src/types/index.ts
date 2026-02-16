export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  joined_at: string;
  total_points: number;
}

export interface Circle {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  prize_description: string | null;
  member_count: number;
}

export interface CircleMembership {
  circle_id: string;
  user_id: string;
  role: "admin" | "member";
  points_this_week: number;
  points_this_month: number;
  joined_at: string;
}

export interface Group {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  circle_id: string | null;
  group_id: string | null;
  visibility: "personal" | "group" | "circle" | "public";
  content: string;
  posted_at: string;
  ai_score: number;
  novelty_score: number;
  engagement_score: number;
  total_score: number;
  flag_count: number;
  is_flagged: boolean;
  // Joined fields
  author?: User;
  circle?: Circle;
  group?: Group;
  media?: Media[];
  reactions?: Reaction[];
  reaction_counts?: ReactionCounts;
  user_reaction?: string | null;
  comment_count?: number;
}

export interface Media {
  id: string;
  post_id: string;
  type: "image" | "video" | "file";
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  uploaded_at: string;
}

export interface Reaction {
  post_id: string;
  user_id: string;
  type: "thumbsup" | "heart" | "thumbsdown";
  created_at: string;
}

export interface ReactionCounts {
  thumbsup: number;
  heart: number;
  thumbsdown: number;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  visibility: "author_only" | "public";
  created_at: string;
  author?: User;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  status: "pending" | "accepted";
  created_at: string;
  accepted_at: string | null;
}

export type FollowStatus = "none" | "pending" | "accepted";

export interface CircleWithUnseen extends Circle {
  unseen_count: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "new_post" | "reaction" | "comment" | "leaderboard" | "invite" | "mention" | "follow_request" | "follow_accepted";
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  related_post_id: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  rank: number;
  post_count: number;
}

export interface ScoringResult {
  score: number;
  reasoning: string;
}
