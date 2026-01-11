import { Gyroscope } from 'expo-sensors';
import * as LucideIcons from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

/* ---------------- CONFIG ---------------- */

const ICON_SIZE_MIN = 10;
const ICON_SIZE_MAX = 36;

const MAX_ICONS = 100;

/* Spread control */
const GRID_PADDING = 200;     // larger padding = wider spread
const GRID_JITTER = 500;       // randomness inside grid cell

const GYRO_STRENGTH = 28;
const GYRO_SMOOTHING = 0.07;
const GYRO_CLAMP = 48;

/* ---------------- ICON LISTS ---------------- */

const techIcons = [
  'Code','Cpu','Terminal','Database','Cloud',
  'Shield','Bug','Server','Network','Globe','Binary',
  'Smartphone','Laptop','Tablet','Router','GitBranch',
  'GitCommit','GitMerge','GitPullRequest',
  'Braces','Brackets','FileCode','Command',
] as const;

const creativeIcons = [
  'Music','Palette','Brush','Paintbrush',
  'Camera','Video','Film','Mic','Headphones',
  'Image','Sparkles','Star','Heart',
] as const;

const generalIcons = [
  'Lightbulb','Zap','Rocket','Target','Compass',
  'Layers','Grid','Activity','TrendingUp',
  'Book','Bookmark','GraduationCap',
  'MessageCircle','MessagesSquare',
] as const;

/* ---------------- TYPES ---------------- */

interface FloatingIcon {
  id: string;
  Icon: React.ComponentType<any>;
  x: number;
  y: number;
  size: number;
  duration: number;
  depth: number;
}

/* ---------------- HELPERS ---------------- */

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

/* -------- SPREAD-OUT GENERATOR -------- */

function generateIcons(): FloatingIcon[] {
  const iconNames = [
    ...techIcons,
    ...creativeIcons,
    ...generalIcons,
  ];

  // Duplicate slightly for density
  while (iconNames.length < MAX_ICONS) {
    iconNames.push(
      iconNames[Math.floor(Math.random() * iconNames.length)]
    );
  }

  const names = iconNames.slice(0, MAX_ICONS);

  // Grid dimensions
  const cols = Math.ceil(Math.sqrt(names.length));
  const rows = Math.ceil(names.length / cols);

  const cellW = (width + GRID_PADDING * 2) / cols;
  const cellH = (height + GRID_PADDING * 2) / rows;

  return names.map((name, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const baseX = col * cellW - GRID_PADDING;
    const baseY = row * cellH - GRID_PADDING;

    return {
      id: `${name}-${i}`,
      Icon: (LucideIcons as any)[name] || LucideIcons.Code,
      x: baseX + Math.random() * GRID_JITTER,
      y: baseY + Math.random() * GRID_JITTER,
      size: ICON_SIZE_MIN + Math.random() * (ICON_SIZE_MAX - ICON_SIZE_MIN),
      duration: 8000 + Math.random() * 10000,
      depth: Math.random() * 0.6 + 0.4,
    };
  });
}

/* ---------------- ICON COMPONENT ---------------- */

function FloatingIconItem({
  icon,
  gyroX,
  gyroY,
}: {
  icon: FloatingIcon;
  gyroX: ReturnType<typeof useSharedValue>;
  gyroY: ReturnType<typeof useSharedValue>;
}) {
  const floatX = useSharedValue(0);
  const floatY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withTiming(-40 - Math.random() * 60, {
        duration: icon.duration,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    floatX.value = withRepeat(
      withTiming((Math.random() - 0.5) * 70, {
        duration: icon.duration * 1.3,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    rotate.value = withRepeat(
      withTiming(360, {
        duration: icon.duration * 2,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: icon.x + floatX.value + (gyroX.value as number) * icon.depth },
      { translateY: icon.y + floatY.value + (gyroY.value as number) * icon.depth },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', opacity: 0.22 }, style]}>
      <icon.Icon size={icon.size} color="#FFFFFF" />
    </Animated.View>
  );
}

/* ---------------- MAIN ---------------- */

export default function FloatingIconsBackground() {
  const icons = useMemo(generateIcons, []);

  const gyroX = useSharedValue(0);
  const gyroY = useSharedValue(0);

  useEffect(() => {
    Gyroscope.setUpdateInterval(16);

    let smoothX = 0;
    let smoothY = 0;

    const sub = Gyroscope.addListener(({ x, y }) => {
      const targetX = clamp(y * GYRO_STRENGTH, -GYRO_CLAMP, GYRO_CLAMP);
      const targetY = clamp(-x * GYRO_STRENGTH, -GYRO_CLAMP, GYRO_CLAMP);

      smoothX += (targetX - smoothX) * GYRO_SMOOTHING;
      smoothY += (targetY - smoothY) * GYRO_SMOOTHING;

      gyroX.value = smoothX;
      gyroY.value = smoothY;
    });

    return () => sub.remove();
  }, []);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {icons.map(icon => (
        <FloatingIconItem
          key={icon.id}
          icon={icon}
          gyroX={gyroX as any}
          gyroY={gyroY as any}
        />
      ))}
    </View>
  );
}
