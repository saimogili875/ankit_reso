import React from 'react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

export interface AuthHeaderProps {
  title: string;
  subtitle: string;
  isAdmin?: boolean;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({ title, subtitle, isAdmin = false }) => {
  return (
    <div className="space-y-4 text-center sm:text-left">
      {/* Brand Header & Role Badge */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/95 flex items-center justify-center p-1.5 shadow-lg shadow-blue-500/20 border border-slate-700/60 flex-shrink-0">
            <Image
              src="/images/logo-icon.png"
              alt="Adept Eduverse Logo"
              width={36}
              height={36}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1">
              ADEPT <span className="text-blue-500">EDUVERSE</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-rose-400 block -mt-0.5">
              {isAdmin ? 'ADMIN PORTAL' : 'A SKILLFUL LEARNING'}
            </span>
          </div>
        </div>

        {isAdmin ? (
          <Badge variant="purple" className="bg-purple-950/60 text-purple-300 border-purple-800/60 px-3 py-1">
            🔒 Secure Admin Gateway
          </Badge>
        ) : (
          <Badge variant="blue" className="bg-blue-950/60 text-blue-300 border-blue-800/60 px-3 py-1">
            JEE Main & Advanced 2025
          </Badge>
        )}
      </div>

      {/* Title & Subtitle */}
      <div className="space-y-1 pt-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
};
