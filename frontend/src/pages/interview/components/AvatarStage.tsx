import React from 'react';
import { PhotorealisticAvatarStage, Viseme } from './PhotorealisticAvatarStage';

export type { Viseme };

export interface AvatarStageProps {
  speaking: boolean;
  listening: boolean;
  viseme: Viseme;
  className?: string;
  isEvaluating?: boolean;
}

export const AvatarStage: React.FC<AvatarStageProps> = ({
  speaking,
  listening,
  viseme,
  className,
  isEvaluating = false,
}) => {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-950 ${className || 'h-[360px] sm:h-[480px]'}`}>
      <PhotorealisticAvatarStage
        speaking={speaking}
        listening={listening}
        isThinking={isEvaluating}
        viseme={viseme}
        className="w-full h-full"
      />
    </div>
  );
};

export default AvatarStage;
