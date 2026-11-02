export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isSmallScreen = () => matchMedia('(max-width: 767px)').matches;

export function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// Efeitos em WebGL só quando o aparelho aguenta e a pessoa não pediu menos movimento
export const canUseEffects = () => !reducedMotion && hasWebGL();
