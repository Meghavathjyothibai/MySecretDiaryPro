import React, { useEffect } from 'react';

const AnimatedBackground = () => {
  useEffect(() => {
    const bg = document.querySelector('.animated-bg');
    for (let i = 0; i < 15; i++) {
      const span = document.createElement('span');
      span.style.left = `${Math.random() * 100}%`;
      span.style.top = `${Math.random() * 100}%`;
      span.style.animationDelay = `${Math.random() * 5}s`;
      span.style.animationDuration = `${Math.random() * 10 + 5}s`;
      span.style.background = `linear-gradient(135deg, 
        hsl(${Math.random() * 60 + 250}, 70%, 50%), 
        hsl(${Math.random() * 60 + 300}, 70%, 50%))`;
      bg.appendChild(span);
    }

    return () => {
      bg.innerHTML = '';
    };
  }, []);

  return <div className="animated-bg"></div>;
};

export default AnimatedBackground;