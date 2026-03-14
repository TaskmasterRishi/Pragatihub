import { useEffect, useState } from 'react';

type Listener = (visible: boolean) => void;
const listeners = new Set<Listener>();
let isTabBarVisible = true;

export const setTabBarVisible = (visible: boolean) => {
  if (isTabBarVisible !== visible) {
    isTabBarVisible = visible;
    listeners.forEach((listener) => listener(visible));
  }
};

export const getTabBarVisible = () => isTabBarVisible;

export const useTabBarVisibility = () => {
  const [visible, setVisible] = useState(isTabBarVisible);

  useEffect(() => {
    const listener: Listener = (v) => setVisible(v);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return visible;
};
