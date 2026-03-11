import { ReactNode, useState, useEffect } from 'react';

interface ResponsiveViewProps {
  desktop: ReactNode;
  mobile: ReactNode;
  breakpoint?: number;
}

export function ResponsiveView({ 
  desktop, 
  mobile, 
  breakpoint = 768 
}: ResponsiveViewProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return <>{isMobile ? mobile : desktop}</>;
}

// Hook version for components that need more control
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}
