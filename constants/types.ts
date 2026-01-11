import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Href, Link } from "expo-router";
import { SymbolViewProps } from "expo-symbols";
import { type ComponentProps } from "react";
import { type TextProps, type ViewProps } from "react-native";

// ────────────────────────────────────────────────────────
// Post Types
// ────────────────────────────────────────────────────────

export type Post = {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  created_at: string;
  upvotes: number;
  nr_of_comments: number;
  group: {
    name: string;
    image: string;
  };
};

export type PostListItemProps = {
  post: Post;
};

// ────────────────────────────────────────────────────────
// Themed Component Types
// ────────────────────────────────────────────────────────

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

// ────────────────────────────────────────────────────────
// Link Types
// ────────────────────────────────────────────────────────

export type ExternalLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { 
  href: Href & string 
};

// ────────────────────────────────────────────────────────
// Icon Types
// ────────────────────────────────────────────────────────

export type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
export type IconSymbolName = keyof typeof ICON_MAPPING;

// Icon mapping constant
export const ICON_MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
} as const satisfies Record<string, ComponentProps<typeof MaterialIcons>['name']>;

// ────────────────────────────────────────────────────────
// Auth Types
// ────────────────────────────────────────────────────────

export type AuthMode = 'login' | 'register';
