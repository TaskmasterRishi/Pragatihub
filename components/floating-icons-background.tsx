import * as LucideIcons from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tech icons (Lucide icon names)
const techIcons = [
  'Code',
  'Cpu',
  'Terminal',
  'Database',
  'Cloud',
  'Shield',
  'Bug',
  'Server',
  'Network',
  'Globe',
  'Smartphone',
  'Laptop',
  'Router',
  'Code2',
  'GitBranch',
] as const;

// Non-tech icons (music, art, etc.)
const nonTechIcons = [
  'Music',
  'Palette',
  'Brush',
  'Camera',
  'Video',
  'Mic',
  'Headphones',
  'Film',
  'Image',
  'Sparkles',
  'Heart',
  'Star',
  'Paintbrush',
  'Music2',
  'VideoIcon',
] as const;

interface FloatingIcon {
  iconName: string;
  IconComponent: React.ComponentType<any>;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  isTech: boolean;
}

function generateRandomIcons(count: number): FloatingIcon[] {
  const icons: FloatingIcon[] = [];
  
  for (let i = 0; i < count; i++) {
    const isTech = Math.random() > 0.4; // 60% tech, 40% non-tech
    const iconList = isTech ? techIcons : nonTechIcons;
    const randomIconName = iconList[Math.floor(Math.random() * iconList.length)];
    const IconComponent = (LucideIcons as any)[randomIconName] || LucideIcons.Code;
    
    icons.push({
      iconName: randomIconName,
      IconComponent,
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: 24 + Math.random() * 16, // 24-40px
      duration: 8000 + Math.random() * 12000, // 8-20 seconds
      delay: Math.random() * 2000,
      opacity: 0.15 + Math.random() * 0.2, // 0.15-0.35
      isTech,
    });
  }
  
  return icons;
}

interface FloatingIconComponentProps {
  icon: FloatingIcon;
}

function FloatingIconComponent({ icon }: FloatingIconComponentProps) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    // Vertical floating animation
    translateY.value = withRepeat(
      withTiming(
        -50 - Math.random() * 100,
        {
          duration: icon.duration,
          easing: Easing.inOut(Easing.sin),
        }
      ),
      -1,
      true
    );

    // Horizontal floating animation (subtle)
    translateX.value = withRepeat(
      withTiming(
        (Math.random() - 0.5) * 40,
        {
          duration: icon.duration * 1.3,
          easing: Easing.inOut(Easing.sin),
        }
      ),
      -1,
      true
    );

    // Rotation animation
    rotate.value = withRepeat(
      withTiming(360, {
        duration: icon.duration * 2,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const IconComponent = icon.IconComponent;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: icon.x,
          top: icon.y,
          opacity: icon.opacity,
        },
        animatedStyle,
      ]}
    >
      <IconComponent
        size={icon.size}
        color="#ffffff"
      />
    </Animated.View>
  );
}

interface FloatingIconsBackgroundProps {
  iconCount?: number;
}

export default function FloatingIconsBackground({
  iconCount = 20,
}: FloatingIconsBackgroundProps) {
  const [icons] = React.useState(() => generateRandomIcons(iconCount));

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        overflow: 'hidden',
      }}
      pointerEvents="none"
    >
      {icons.map((icon, index) => (
        <FloatingIconComponent key={index} icon={icon} />
      ))}
    </View>
  );
}
